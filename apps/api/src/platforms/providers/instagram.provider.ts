import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SocialAccount } from '@prisma/client';
import { PlatformAdapter, PlatformResult, PublishContext, ReplyContext } from '../platform.types';

const GRAPH = 'https://graph.facebook.com/v21.0';

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
    if (!ctx.targetId) return { ok: false };
    const { data } = await axios.post(
      `${GRAPH}/${ctx.targetId}/comments`,
      { message: ctx.text, access_token: account.accessToken },
      { params: { access_token: account.accessToken } },
    );
    return { ok: true, remoteId: data.id };
  }
}