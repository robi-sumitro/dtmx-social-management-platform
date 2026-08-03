import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SocialAccount } from '@prisma/client';
import { PlatformAdapter, PlatformResult, PublishContext, ReplyContext } from '../platform.types';

const API = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable';

/**
 * YouTube provider (Data API v3). Publish a video via resumable upload.
 * Requires a video file accessible by URL and a token with scope.
 */
@Injectable()
export class YoutubeProvider implements PlatformAdapter {
  readonly provider = 'youtube';
  private readonly logger = new Logger(YoutubeProvider.name);

  async publish(account: SocialAccount, post: PublishContext): Promise<PlatformResult> {
    if (!account.accessToken) throw new Error('YouTube: access token tidak dikonfigurasi');
    const video = post.media.find((m) => m.mimeType?.startsWith('video/') || m.fileType === 'video');
    if (!video) throw new Error('YouTube: posting wajib berisi video');

    const snippet = {
      title: post.title || (post.caption || 'DtmX video').slice(0, 100),
      description: [post.caption, post.hashtags].filter(Boolean).join('\n'),
    };
    const meta = {
      snippet,
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
    };

    const { data: location } = await axios.post(API, meta, {
      headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
    });
    const uploadUrl = location.location;

    const fileUrl = `${post.mediaBaseUrl}/${video.filename}`;
    const fileRes = await axios.get(fileUrl, { responseType: 'stream' });
    // Proxy the stream through the resumable upload endpoint.
    const { data: uploaded } = await axios.request({
      method: 'PUT',
      url: uploadUrl,
      data: fileRes.data,
      headers: { 'Content-Type': video.mimeType || 'video/mp4' },
    });
    this.logger.log(`YouTube upload initiated: ${uploaded.id}`);
    return { ok: true, remoteId: uploaded.id };
  }

  async reply(): Promise<PlatformResult> {
    return { ok: false, warning: 'YouTube comments via API belum didukung' };
  }
}