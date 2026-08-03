import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SocialAccount } from '@prisma/client';
import { PlatformAdapter, PlatformResult, PublishContext, ReplyContext } from '../platform.types';

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
        post_info: { title: post.caption || post.title || '', privacy_level: 'SELF_ONLY' },
        source_info: { source: 'PULL_FROM_URL', video_url: `${post.mediaBaseUrl}/${video.filename}` },
      },
      { headers: this.headers(account) },
    );
    const pubId = init?.data?.publish_id;
    if (!pubId) throw new Error(`TikTok: inisialisasi gagal (${init?.error?.message || 'no publish_id'})`);
    this.logger.log(`TikTok publish initialized: ${pubId}`);
    return { ok: true, remoteId: pubId };
  }

  async reply(): Promise<PlatformResult> {
    return { ok: false, warning: 'TikTok reply via API belum didukung' };
  }
}