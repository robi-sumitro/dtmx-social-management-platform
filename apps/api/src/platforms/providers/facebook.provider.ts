import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SocialAccount } from '@prisma/client';
import {
  InboxPullItem,
  PlatformAdapter,
  PlatformInsights,
  PlatformResult,
  PublishContext,
  ReplyContext,
} from '../platform.types';

const GRAPH = 'https://graph.facebook.com/v24.0';
const INSIGHTS_METRICS = ['page_impressions', 'page_impressions_unique', 'page_post_engagements', 'page_consumptions'];

/**
 * Facebook provider (Graph API).
 * - Page posts: POST /{page-id}/feed (text), POST /{page-id}/photos (image).
 * - Comment replies: POST /{comment-id}/comments.
 * Throws when no token is configured.
 */
@Injectable()
export class FacebookProvider implements PlatformAdapter {
  readonly provider = 'facebook';
  private readonly logger = new Logger(FacebookProvider.name);

  private hasToken(account: SocialAccount): boolean {
    return Boolean(account.accessToken);
  }

  private messageOf(post: PublishContext): string {
    return [post.caption, post.hashtags].filter(Boolean).join('\n') || '';
  }

  async publish(account: SocialAccount, post: PublishContext): Promise<PlatformResult> {
    if (!this.hasToken(account)) {
      throw new Error('Facebook: access token tidak dikonfigurasi pada akun ini');
    }
    const token = account.accessToken!;
    const pageId = account.platformId;
    const tokenParam = { access_token: token };

    const images = post.media.filter((m) => m.mimeType?.startsWith('image/') || m.fileType === 'image');
    const video = post.media.find((m) => m.mimeType?.startsWith('video/') || m.fileType === 'video');

    // Reels: two-phase upload via /{page-id}/video_reels.
    if (post.postType === 'short_video') {
      if (!video) throw new Error('Facebook Reels: posting wajib berisi video');
      return this.publishReel(account, post, video, pageId, token);
    }

    // Regular video post via /{page-id}/videos with file_url (URL-based upload).
    if (post.postType === 'video') {
      if (!video) throw new Error('Facebook video: posting wajib berisi video');
      const { data } = await axios.post(`${GRAPH}/${pageId}/videos`, null, {
        params: {
          file_url: `${post.mediaBaseUrl}/${video.filename}`,
          description: this.messageOf(post),
          ...tokenParam,
        },
      });
      this.logger.log(`Facebook video created: ${data.id}`);
      return { ok: true, remoteId: data.id };
    }

    // Carousel: create each photo unpublished, then attach them to a feed post.
    if (post.postType === 'carousel' && images.length > 1) {
      const mediaFbids: string[] = [];
      for (const image of images) {
        const { data } = await axios.post(`${GRAPH}/${pageId}/photos`, null, {
          params: { url: `${post.mediaBaseUrl}/${image.filename}`, published: 'false', ...tokenParam },
        });
        if (data?.id) mediaFbids.push(data.id);
      }
      if (mediaFbids.length > 0) {
        const { data } = await axios.post(`${GRAPH}/${pageId}/feed`, null, {
          params: {
            message: this.messageOf(post),
            attached_media: JSON.stringify(mediaFbids.map((id) => ({ media_fbid: id }))),
            ...tokenParam,
          },
        });
        this.logger.log(`Facebook carousel created: ${data.id}`);
        return { ok: true, remoteId: data.id };
      }
    }

    // Single image or text-only feed post.
    const image = images[0];
    const payload: Record<string, string> = image
      ? { url: `${post.mediaBaseUrl}/${image.filename}`, caption: this.messageOf(post), ...tokenParam }
      : { message: this.messageOf(post), ...tokenParam };

    const node = image ? `${pageId}/photos` : `${pageId}/feed`;
    const { data } = await axios.post(`${GRAPH}/${node}`, null, { params: payload });
    this.logger.log(`Facebook post created: ${data.id}`);
    return { ok: true, remoteId: data.id };
  }

  /**
   * Publish a Reel to a Facebook Page.
   * Flow: (1) POST /{page-id}/video_reels?upload_phase=start → get video_id +
   * upload_url; (2) upload the video file to the rupload URL; (3) POST
   * /{page-id}/video_reels?upload_phase=finish to publish. Needs
   * pages_manage_posts + pages_read_engagement + pages_show_list.
   */
  private async publishReel(
    account: SocialAccount,
    post: PublishContext,
    video: { filename: string },
    pageId: string,
    token: string,
  ): Promise<PlatformResult> {
    // Phase 1: initialize the upload session.
    const { data: init } = await axios.post(`${GRAPH}/${pageId}/video_reels`, null, {
      params: { upload_phase: 'start', access_token: token },
    });
    const videoId = init?.video_id;
    const uploadUrl = init?.upload_url;
    if (!videoId || !uploadUrl) {
      throw new Error(`Facebook Reels: gagal memulai sesi unggah (${init?.message || 'tanpa video_id'})`);
    }

    // Phase 2: upload the video (URL-based, so no binary streaming needed).
    const uploadRes = await axios.post(uploadUrl, null, {
      headers: {
        Authorization: `OAuth ${token}`,
        'file_url': `${post.mediaBaseUrl}/${video.filename}`,
      },
    });
    if (!uploadRes.data?.success) {
      throw new Error(`Facebook Reels: unggah video gagal (${uploadRes.data?.message || 'status tidak sukses'})`);
    }

    // Phase 3: finish the upload and publish the Reel.
    const { data: fin } = await axios.post(`${GRAPH}/${pageId}/video_reels`, null, {
      params: {
        upload_phase: 'finish',
        video_id: videoId,
        video_state: 'PUBLISHED',
        description: this.messageOf(post),
        access_token: token,
      },
    });
    if (!fin?.success) {
      throw new Error(`Facebook Reels: publikasi ditolak (${fin?.message || 'tidak ada konfirmasi'})`);
    }
    this.logger.log(`Facebook Reel published: ${fin.post_id || videoId}`);
    return { ok: true, remoteId: fin.post_id ?? videoId };
  }

  async reply(account: SocialAccount, ctx: ReplyContext): Promise<PlatformResult> {
    if (!this.hasToken(account)) throw new Error('Facebook: token tidak dikonfigurasi');

    if (ctx.kind === 'dm' && ctx.authorId) {
      // Messenger DM: POST /me/messages (me = page) with recipient PSID + text.
      // messaging_type (RESPONSE) is REQUIRED by the Send API — omitting it
      // makes Meta reject the call with HTTP 400.
      const { data } = await axios.post(
        `${GRAPH}/me/messages`,
        {
          recipient: { id: ctx.authorId },
          message: { text: ctx.text },
          messaging_type: 'RESPONSE',
          access_token: account.accessToken!,
        },
      );
      return { ok: true, remoteId: data?.message_id ?? data?.id };
    }

    const target = ctx.targetId ?? ctx.authorId;
    if (!target) return { ok: false };
    const { data } = await axios.post(
      `${GRAPH}/${target}/comments`,
      { message: ctx.text, access_token: account.accessToken! },
    );
    return { ok: true, remoteId: data.id };
  }

  /** Delete a comment/reply from the page. */
  async deleteComment(account: SocialAccount, targetId: string): Promise<PlatformResult> {
    if (!this.hasToken(account)) throw new Error('Facebook: token tidak dikonfigurasi');
    await axios.delete(`${GRAPH}/${targetId}`, {
      params: { access_token: account.accessToken },
    });
    return { ok: true };
  }

  /** Pull comments made on the page's posts (needs pages_read_user_content). */
  async pullInbox(account: SocialAccount): Promise<InboxPullItem[]> {
    if (!this.hasToken(account)) throw new Error('Facebook: token tidak dikonfigurasi');
    const pageId = account.platformId;

    const items: InboxPullItem[] = [];

    try {
      const { data } = await axios.get(`${GRAPH}/${pageId}/comments`, {
        params: {
          access_token: account.accessToken,
          limit: 100,
          fields: 'id,message,from{id,name},created_time,parent{id}',
        },
      });
      for (const c of data?.data ?? []) {
        if (!c?.from?.id) continue;
        items.push({
          kind: 'comment',
          sourceId: c.id,
          authorId: c.from.id,
          authorName: c.from.name,
          content: c.message || '',
        });
      }
    } catch (err) {
      this.logger.warn(`FB comments pull failed for ${pageId}: ${(err as Error).message}`);
    }

    try {
      const dms = await this.pullMessengerDMs(account);
      items.push(...dms);
    } catch (err) {
      this.logger.warn(`FB Messenger DMs pull failed for ${pageId}: ${(err as Error).message}`);
    }

    return items;
  }

  /** Pull Messenger conversations (needs pages_messaging + page subscribed to messages). */
  private async pullMessengerDMs(account: SocialAccount): Promise<InboxPullItem[]> {
    const pageId = account.platformId;
    const { data } = await axios.get(`${GRAPH}/${pageId}/conversations`, {
      params: {
        access_token: account.accessToken,
        limit: 50,
        fields: 'id,updated_time,messages.limit(25){id,message,from{id,name},created_time,attachments{type,image_data,file_url}}',
      },
    });
    const conversations: any[] = data?.data ?? [];
    const items: InboxPullItem[] = [];
    for (const conv of conversations) {
      for (const m of conv?.messages?.data ?? []) {
        if (!m?.from?.id) continue;
        // Skip messages sent by the page itself.
        if (String(m.from.id) === String(pageId)) continue;
        const attachment = m.attachments?.[0];
        items.push({
          kind: 'dm',
          sourceId: m.id,
          authorId: m.from.id,
          authorName: m.from.name || 'Pengguna',
          content: m.message || '',
          mediaUrl: attachment?.image_data?.url || attachment?.file_url || undefined,
        });
      }
    }
    return items;
  }

  /** Aggregate Page Insights (last 30 days). Needs pages_read_engagement. */
  async insights(account: SocialAccount, since?: Date): Promise<PlatformInsights> {
    if (!this.hasToken(account)) return { reach: 0, impressions: 0, engagementCount: 0, linkClicks: 0 };
    const until = new Date();
    const from = since ?? new Date(until.getTime() - 30 * 24 * 3600 * 1000);

    const { data } = await axios.get(`${GRAPH}/${account.platformId}/insights`, {
      params: {
        access_token: account.accessToken,
        metric: INSIGHTS_METRICS.join(','),
        period: 'day',
        since: Math.floor(from.getTime() / 1000),
        until: Math.floor(until.getTime() / 1000),
      },
    });

    const values: Record<string, number> = {};
    for (const metric of data?.data ?? []) {
      values[metric.name] = (metric.values ?? [])
        .map((v: { value?: number }) => Number(v.value ?? 0))
        .reduce((a: number, b: number) => a + b, 0);
    }

    return {
      reach: values['page_impressions_unique'] ?? 0,
      impressions: values['page_impressions'] ?? 0,
      engagementCount: values['page_post_engagements'] ?? 0,
      linkClicks: values['page_consumptions'] ?? 0,
    };
  }
}