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

// The `part` query parameter is mandatory for the resumable upload initiation.
// Without it the YouTube API rejects the request with HTTP 400 "Required parameter: part".
const API = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
const DATA = 'https://www.googleapis.com/youtube/v3';

/** Extract a readable message from a YouTube API error response. */
function extractApiError(err: any): string {
  const detail = err?.response?.data?.error;
  const reason = detail?.errors?.map((e: any) => e.reason).filter(Boolean).join(', ');
  const message = detail?.message;
  if (reason) return `YouTube: ${reason}`;
  if (message) return `YouTube: ${message}`;
  if (err?.response?.status) return `YouTube: permintaan ditolak (HTTP ${err.response.status})`;
  return `YouTube: ${err?.message || 'gagal mengunggah video'}`;
}

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

    try {
      // The resumable session URI is returned in the `Location` response header,
      // not in the response body. Using the body here makes `uploadUrl` undefined
      // and the PUT below fails with axios "Invalid URL".
      const initRes = await axios.post(API, meta, {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': video.mimeType || 'video/mp4',
        },
      });
      const uploadUrl = initRes.headers.location;
      if (!uploadUrl) throw new Error('YouTube: respons init upload tanpa header Location');

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
    } catch (err) {
      throw new Error(extractApiError(err));
    }
  }

  async reply(account: SocialAccount, ctx: ReplyContext): Promise<PlatformResult> {
    if (!account.accessToken) return { ok: false };
    const target = ctx.targetId;
    if (!target) return { ok: false };
    const text = (ctx.text || '').slice(0, 1000).trim();
    if (!text) return { ok: false };
    try {
      const { data } = await axios.post(
        `${DATA}/comments?part=snippet`,
        {
          snippet: { parentId: target, textOriginal: text },
        },
        { headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' } },
      );
      return { ok: true, remoteId: data?.id };
    } catch (err) {
      throw new Error(extractApiError(err));
    }
  }

  /** Pull comments from the channel's videos. Needs youtube.readonly (+ force-ssl to reply). */
  async pullInbox(account: SocialAccount): Promise<InboxPullItem[]> {
    if (!account.accessToken) throw new Error('YouTube: token tidak dikonfigurasi');
    const channelId = account.platformId;
    const items: InboxPullItem[] = [];

    let pageToken: string | undefined;
    do {
      const { data } = await axios.get(`${DATA}/commentThreads`, {
        params: {
          part: 'snippet,replies',
          allThreadsRelatedToChannelId: channelId,
          maxResults: 100,
          textFormat: 'plainText',
          pageToken,
        },
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });

      for (const thread of data?.items ?? []) {
        const top = thread?.snippet?.topLevelComment;
        if (top?.id) {
          items.push({
            kind: 'comment',
            sourceId: top.id,
            authorId: top.snippet?.authorChannelId?.value,
            authorName: top.snippet?.authorDisplayName,
            content: top.snippet?.textDisplay || '',
          });
        }
        for (const reply of thread?.replies?.comments ?? []) {
          items.push({
            kind: 'comment',
            sourceId: reply.id,
            authorId: reply.snippet?.authorChannelId?.value,
            authorName: reply.snippet?.authorDisplayName,
            content: reply.snippet?.textDisplay || '',
          });
        }
      }
      pageToken = data?.nextPageToken;
    } while (pageToken && items.length < 500);

    return items;
  }
}