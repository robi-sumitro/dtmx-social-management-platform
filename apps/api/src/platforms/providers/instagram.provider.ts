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
const ACCOUNT_INSIGHTS_METRICS = ['reach', 'impressions', 'total_interactions', 'website_clicks'];

/**
 * Instagram business/sidecar publishing via Graph API.
 * Creates a container then publishes it. Uses `instagramId` (the IG account id).
 */
@Injectable()
export class InstagramProvider implements PlatformAdapter {
  readonly provider = 'instagram';
  private readonly logger = new Logger(InstagramProvider.name);

  async publish(account: SocialAccount, post: PublishContext): Promise<PlatformResult> {
    if (!account.accessToken) throw new Error('Instagram: access token tidak dikonfigurasi');
    const igUserId = account.instagramId ?? account.platformId;
    const token = account.accessToken;
    const caption = [post.caption, post.hashtags].filter(Boolean).join('\n') || '';

    const images = post.media.filter((m) => m.mimeType?.startsWith('image/'));
    const video = post.media.find((m) => m.mimeType?.startsWith('video/'));

    let mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL' = 'IMAGE';
    let mediaUrls: string[] = [];
    let isVideo = false;

    if (video) {
      mediaType = 'VIDEO';
      isVideo = true;
      mediaUrls = [`${post.mediaBaseUrl}/${video.filename}`];
    } else if (images.length > 1) {
      mediaType = 'CAROUSEL';
      mediaUrls = images.map((m) => `${post.mediaBaseUrl}/${m.filename}`);
    } else if (images.length === 1) {
      mediaUrls = [`${post.mediaBaseUrl}/${images[0].filename}`];
    } else {
      throw new Error('Instagram: posting wajib berisi media (gambar/video)');
    }

    const base = { access_token: token, caption };

    let remoteId: string;

    if (mediaType === 'CAROUSEL') {
      const children: string[] = [];
      for (const url of mediaUrls) {
        const { data: cont } = await axios.post(
          `${GRAPH}/${igUserId}/media`,
          { image_url: url, is_carousel_item: true, ...base },
        );
        children.push(cont.id);
      }
      const { data: container } = await axios.post(
        `${GRAPH}/${igUserId}/media`,
        { media_type: 'CAROUSEL', children, ...base },
      );
      remoteId = container.id;
    } else {
      const { data: container } = await axios.post(
        `${GRAPH}/${igUserId}/media`,
        {
          media_type: mediaType,
          image_url: isVideo ? undefined : mediaUrls[0],
          video_url: isVideo ? mediaUrls[0] : undefined,
          ...base,
        },
      );
      remoteId = container.id;
    }

    const { data: published } = await axios.post(
      `${GRAPH}/${igUserId}/media_publish`,
      { creation_id: remoteId, access_token: token },
    );
    this.logger.log(`Instagram post published: ${published.id}`);
    return { ok: true, remoteId: published.id };
  }

  async reply(account: SocialAccount, ctx: ReplyContext): Promise<PlatformResult> {
    if (!account.accessToken) throw new Error('Instagram: token tidak dikonfigurasi');
    const igUserId = account.instagramId ?? account.platformId;

    if (ctx.kind === 'dm' && ctx.authorId) {
      // DM: POST /{ig-id}/messages with recipient + text.
      const { data } = await axios.post(
        `${GRAPH}/${igUserId}/messages`,
        {
          recipient: { id: ctx.authorId },
          message: { text: ctx.text },
          access_token: account.accessToken,
        },
      );
      return { ok: true, remoteId: data?.message_id ?? data?.id };
    }

    if (!ctx.targetId) return { ok: false };
    // Comment reply: POST /{comment-id}/replies
    const { data } = await axios.post(
      `${GRAPH}/${ctx.targetId}/replies`,
      { message: ctx.text, access_token: account.accessToken },
    );
    return { ok: true, remoteId: data?.id };
  }

  /** Pull IG comments + DMs. Needs instagram_basic + instagram_manage_comments/messages. */
  async pullInbox(account: SocialAccount): Promise<InboxPullItem[]> {
    if (!account.accessToken) throw new Error('Instagram: token tidak dikonfigurasi');
    const igUserId = account.instagramId ?? account.platformId;
    const items: InboxPullItem[] = [];

    try {
      const comments = await this.pullComments(igUserId, account.accessToken);
      items.push(...comments);
    } catch (err) {
      this.logger.warn(`IG comments pull failed for ${igUserId}: ${(err as Error).message}`);
    }

    try {
      const dms = await this.pullDMs(igUserId, account.accessToken);
      items.push(...dms);
    } catch (err) {
      this.logger.warn(`IG DMs pull failed for ${igUserId}: ${(err as Error).message}`);
    }

    return items;
  }

  private async pullComments(igUserId: string, token: string): Promise<InboxPullItem[]> {
    const { data: media } = await axios.get(`${GRAPH}/${igUserId}/media`, {
      params: {
        access_token: token,
        limit: 20,
        fields: 'id',
      },
    });
    const posts: any[] = media?.data ?? [];
    const items: InboxPullItem[] = [];
    for (const post of posts) {
      const { data } = await axios.get(`${GRAPH}/${post.id}/comments`, {
        params: { access_token: token, limit: 100, fields: 'id,text,username,timestamp' },
      });
      for (const c of data?.data ?? []) {
        items.push({
          kind: 'comment',
          sourceId: c.id,
          authorId: c.username,
          authorName: c.username,
          content: c.text || '',
        });
      }
    }
    return items;
  }

  private async pullDMs(igUserId: string, token: string): Promise<InboxPullItem[]> {
    const { data: conv } = await axios.get(`${GRAPH}/${igUserId}/conversations`, {
      params: { access_token: token, platform: 'instagram', limit: 25 },
    });
    const conversations: any[] = conv?.data ?? [];
    const items: InboxPullItem[] = [];
    for (const conversation of conversations.slice(0, 10)) {
      const { data } = await axios.get(`${GRAPH}/${conversation.id}/messages`, {
        params: {
          access_token: token,
          platform: 'instagram',
          limit: 25,
          fields: 'id,from{id,username},created_time,text,media',
        },
      });
      for (const m of data?.data ?? []) {
        if (!m?.from?.id) continue;
        items.push({
          kind: 'dm',
          sourceId: m.id,
          authorId: m.from.id,
          authorName: m.from.username || 'Pengguna',
          content: m.text || '',
          mediaUrl: m.media?.image?.uri ?? m.media?.video?.uri ?? undefined,
        });
      }
    }
    return items;
  }

  /** Aggregate IG account insights (last 30 days). Needs instagram_basic. */
  async insights(account: SocialAccount, since?: Date): Promise<PlatformInsights> {
    if (!account.accessToken) return { reach: 0, impressions: 0, engagementCount: 0, linkClicks: 0 };
    const igUserId = account.instagramId ?? account.platformId;
    const until = new Date();
    const from = since ?? new Date(until.getTime() - 30 * 24 * 3600 * 1000);

    const { data } = await axios.get(`${GRAPH}/${igUserId}/insights`, {
      params: {
        access_token: account.accessToken,
        metric: ACCOUNT_INSIGHTS_METRICS.join(','),
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
      reach: values['reach'] ?? 0,
      impressions: values['impressions'] ?? 0,
      engagementCount: values['total_interactions'] ?? 0,
      linkClicks: values['website_clicks'] ?? 0,
    };
  }
}