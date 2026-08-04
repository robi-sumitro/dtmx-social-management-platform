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

    const image = post.media.find((m) => m.mimeType?.startsWith('image/') || m.fileType === 'image');
    const payload: Record<string, string> = image
      ? { url: `${post.mediaBaseUrl}/${image.filename}`, caption: this.messageOf(post), ...tokenParam }
      : { message: this.messageOf(post), ...tokenParam };

    const node = image ? `${pageId}/photos` : `${pageId}/feed`;
    const { data } = await axios.post(`${GRAPH}/${node}`, null, { params: payload });
    this.logger.log(`Facebook post created: ${data.id}`);
    return { ok: true, remoteId: data.id };
  }

  async reply(account: SocialAccount, ctx: ReplyContext): Promise<PlatformResult> {
    if (!this.hasToken(account)) throw new Error('Facebook: token tidak dikonfigurasi');

    if (ctx.kind === 'dm' && ctx.authorId) {
      // Messenger DM: POST /me/messages (me = page) with recipient PSID + text.
      const { data } = await axios.post(
        `${GRAPH}/me/messages`,
        {
          recipient: { id: ctx.authorId },
          message: { text: ctx.text },
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