import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SocialAccount } from '@prisma/client';
import {
  InboxPullItem,
  PlatformAdapter,
  PlatformResult,
  PublishContext,
  ReplyContext,
} from '../platform.types';

const API = 'https://open.tiktokapis.com/v2';

/**
 * TikTok Direct/Posting API (v2). Publish video to a TikTok account.
 * Token must carry `video.publish` scope.
 */
@Injectable()
export class TiktokProvider implements PlatformAdapter {
  readonly provider = 'tiktok';
  private readonly logger = new Logger(TiktokProvider.name);

  private headers(account: SocialAccount) {
    return { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' };
  }

  async publish(account: SocialAccount, post: PublishContext): Promise<PlatformResult> {
    if (!account.accessToken) throw new Error('TikTok: access token tidak dikonfigurasi');
    const video = post.media.find((m) => m.mimeType?.startsWith('video/') || m.fileType === 'video');
    if (!video) throw new Error('TikTok: posting wajib berisi video');

    // Step 1: initialize upload
    const { data: init } = await axios.post(
      `${API}/post/publish/video/init/`,
      {
        post_info: { title: post.caption || post.title || '', privacy_level: 'PUBLIC_TO_EVERYONE' },
        source_info: { source: 'PULL_FROM_URL', video_url: `${post.mediaBaseUrl}/${video.filename}` },
      },
      { headers: this.headers(account) },
    );
    const pubId = init?.data?.publish_id;
    if (!pubId) throw new Error(`TikTok: inisialisasi gagal (${init?.error?.message || 'no publish_id'})`);
    this.logger.log(`TikTok publish initialized: ${pubId}`);
    return { ok: true, remoteId: pubId };
  }

  async reply(account: SocialAccount, ctx: ReplyContext): Promise<PlatformResult> {
    if (!account.accessToken) return { ok: false };
    const commentId = ctx.targetId;
    if (!commentId) return { ok: false };
    const { data } = await axios.post(
      `${API}/comment/reply/`,
      { comment_id: commentId, reply_text: ctx.text },
      { headers: this.headers(account) },
    );
    return { ok: true, remoteId: data?.data?.reply_id ?? data?.data?.comment_id };
  }

  /** Pull comments from the user's videos. Needs video.list + comment.list scopes. */
  async pullInbox(account: SocialAccount): Promise<InboxPullItem[]> {
    if (!account.accessToken) throw new Error('TikTok: token tidak dikonfigurasi');
    const { data: vids } = await axios.post(
      `${API}/video/list/`,
      { fields: ['id'], max_count: 20, cursor: 0 },
      { headers: this.headers(account) },
    );
    const videos: any[] = vids?.data?.videos ?? [];
    const items: InboxPullItem[] = [];

    for (const video of videos.slice(0, 10)) {
      try {
        const { data: res } = await axios.post(
          `${API}/comment/list/`,
          { video_id: video.id, max_count: 50, cursor: 0, fields: ['id', 'text', 'create_time', 'commenter'] },
          { headers: this.headers(account) },
        );
        for (const c of res?.data?.comments ?? []) {
          items.push({
            kind: 'comment',
            sourceId: c.id,
            authorId: c.commenter?.user_id,
            authorName: c.commenter?.display_name || 'Pengguna',
            content: c.text || '',
          });
        }
      } catch (err) {
        this.logger.warn(`TikTok comments pull failed for video ${video.id}: ${(err as Error).message}`);
      }
    }
    return items;
  }
}