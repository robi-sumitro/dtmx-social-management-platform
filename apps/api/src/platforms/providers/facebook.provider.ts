import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SocialAccount } from '@prisma/client';
import { PlatformAdapter, PlatformResult, PublishContext, ReplyContext } from '../platform.types';

const GRAPH = 'https://graph.facebook.com/v21.0';

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
    const target = ctx.targetId ?? ctx.authorId;
    if (!target) return { ok: false };
    const { data } = await axios.post(
      `${GRAPH}/${target}/comments`,
      { message: ctx.text, access_token: account.accessToken! },
    );
    return { ok: true, remoteId: data.id };
  }
}