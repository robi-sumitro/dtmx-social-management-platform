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

    // Semua video dipublish sebagai REELS. Meta telah menonaktifkan
    // `media_type: VIDEO` (error subcode 2207067): untuk video feed pun kini
    // wajib memakai `media_type: REELS` (dengan share_to_feed=true agar tetap
    // muncul di Feed). Gambar tetap memakai container IMAGE biasa.
    let mediaType: 'IMAGE' | 'REELS' | 'CAROUSEL' = 'IMAGE';
    let mediaUrls: string[] = [];
    let isVideo = false;

    if (video) {
      mediaType = 'REELS';
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

    const base: Record<string, unknown> = { access_token: token, caption };
    if (mediaType === 'REELS') base.share_to_feed = 'true';

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
      // media_type TIDAK diizinkan untuk post feed gambar (IMAGE) — Meta
      // membalas "Invalid parameter (HTTP 400)". Namun untuk VIDEO / REELS /
      // CAROUSEL media_type justru WAJIB: tanpa media_type=VIDEO Meta
      // menduga container itu gambar lalu menuntut image_url.
      const containerBody: Record<string, unknown> = {
        image_url: isVideo ? undefined : mediaUrls[0],
        video_url: isVideo ? mediaUrls[0] : undefined,
        ...base,
      };
      if (mediaType === 'REELS') containerBody.media_type = mediaType;
      const { data: container } = await axios.post(
        `${GRAPH}/${igUserId}/media`,
        containerBody,
      );
      remoteId = container.id;
    }

    // Media container may still be processing (transcoding/upload), so poll its
    // status until FINISHED before publishing. Otherwise Meta replies with HTTP
    // 400 + subcode 2207027 ("media is not ready for publishing").
    await this.waitUntilReady(igUserId, remoteId, token);

    // Publish the prepared container the media, with a short retry for the
    // transient "not ready yet" (subcode 2207027) error.
    let published;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data } = await axios.post(
          `${GRAPH}/${igUserId}/media_publish`,
          { creation_id: remoteId, access_token: token },
        );
        published = data;
        break;
      } catch (err: any) {
        const subcode = err?.response?.data?.error?.error_subcode;
        const isNotReady = err?.response?.status === 400 && subcode === 2207027;
        if (!isNotReady || attempt === 2) throw err;
        this.logger.warn(
          `Instagram media not ready on publish (attempt ${attempt + 1}/3), retrying in 3s...`,
        );
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    this.logger.log(`Instagram post published: ${published.id}`);
    return { ok: true, remoteId: published.id };
  }

  /**
   * Poll `GET /{ig-user-id}/media/{containerId}?fields=status_code` until the
   * container returns status FINISHED. Meta requires waiting for this before
   * calling media_publish, otherwise it answers HTTP 400 / subcode 2207027.
   * REELS/VIDEO transcoding from an image_url/video_url can be slow, so the
   * default wait is generous (5 min). Throws after timing out so the caller
   * surfaces a readable error.
   */
  private async waitUntilReady(
    igUserId: string,
    containerId: string,
    token: string,
    timeoutMs: number | undefined = undefined,
    intervalMs = 4000,
  ): Promise<void> {
    const raw = timeoutMs ?? Number(process.env.IG_READY_TIMEOUT_MS ?? 300_000);
    const effective = Number.isFinite(raw) && raw > 0 ? raw : 300_000;
    const deadline = Date.now() + effective;
    let lastSeen = '';
    let unknownStreak = 0;
    while (Date.now() < deadline) {
      try {
        const { data } = await axios.get(`${GRAPH}/${containerId}`, {
          params: { access_token: token, fields: 'status_code,error' },
        });
        const status = data?.status_code;
        if (status === 'FINISHED' || status === 'PUBLISHED') return;
        if (status === 'ERROR') {
          const msg = data?.error?.message ?? 'unknown status_code ERROR';
          throw new Error(`Instagram container failed to process media: ${msg}`);
        }
        if (!status) {
          unknownStreak += 1;
          if (unknownStreak <= 3) {
            this.logger.warn(
              `Instagram container ${containerId} menanggapi tanpa status_code. Respon: ${JSON.stringify(data)}`,
            );
          }
          if (unknownStreak >= 15) {
            throw new Error(
              `Instagram: container ${containerId} tidak mengekspos status_code. Respon: ${JSON.stringify(data)}`,
            );
          }
        } else {
          unknownStreak = 0;
          if (status !== lastSeen) {
            this.logger.log(`Instagram container ${containerId} status: ${status}`);
            lastSeen = status;
          }
        }
      } catch (err: any) {
        const httpStatus = err?.response?.status;
        const g = err?.response?.data?.error;
        const sub = g?.error_subcode;
        const msg = g?.message || (err?.message ?? String(err));
        // Jeda publish yang masih aman: "media belum siap" — terus tunggu.
        const notReady = httpStatus === 400 && (sub === 2207027 || /not ready/i.test(msg));
        const transient =
          !err?.response || // network/axios blip tanpa respon
          httpStatus === 429 ||
          (httpStatus >= 500 && httpStatus <= 599);
        if (notReady) {
          if (lastSeen !== 'not-ready') {
            this.logger.log(`Instagram container ${containerId} masih memproses media...`);
            lastSeen = 'not-ready';
          }
        } else if (!transient) {
          // Error keras (400/403 lainnya, object tak ketemu, bogus token...).
          // Jangan diam-diam mengulang sampai timeout — munculkan pesannya.
          throw new Error(`Instagram container status gagal dibaca (HTTP ${httpStatus || '?'}): ${msg}`);
        } else {
          this.logger.warn(`Instagram container ${containerId} poll gagal sementara: ${msg}`);
        }
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(
      `Instagram: media tidak siap publishing setelah ${Math.round(effective / 1000)}s (container ${containerId}, status terakhir: ${lastSeen || 'unknown'})`,
    );
  }

  async reply(account: SocialAccount, ctx: ReplyContext): Promise<PlatformResult> {
    if (!account.accessToken) throw new Error('Instagram: token tidak dikonfigurasi');
    const igUserId = account.instagramId ?? account.platformId;

    if (ctx.kind === 'dm' && ctx.authorId) {
      // DM: POST /{ig-id}/messages with recipient + text. messaging_type is a
      // required field for the IG messaging send API (same contract as
      // Messenger), otherwise Meta replies with HTTP 400.
      const { data } = await axios.post(
        `${GRAPH}/${igUserId}/messages`,
        {
          recipient: { id: ctx.authorId },
          message: { text: ctx.text },
          messaging_type: 'RESPONSE',
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

  /** Delete an IG comment from the post. */
  async deleteComment(account: SocialAccount, targetId: string): Promise<PlatformResult> {
    if (!account.accessToken) throw new Error('Instagram: token tidak dikonfigurasi');
    await axios.delete(`${GRAPH}/${targetId}`, {
      params: { access_token: account.accessToken },
    });
    return { ok: true };
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