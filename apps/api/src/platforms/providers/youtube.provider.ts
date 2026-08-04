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

const API = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable';
const DATA = 'https://www.googleapis.com/youtube/v3';

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

  async reply(account: SocialAccount, ctx: ReplyContext): Promise<PlatformResult> {
    if (!account.accessToken) return { ok: false };
    const target = ctx.targetId;
    if (!target) return { ok: false };
    const { data } = await axios.post(
      `${DATA}/comments?part=snippet`,
      {
        snippet: { parentId: target, textOriginal: ctx.text },
      },
      { headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' } },
    );
    return { ok: true, remoteId: data?.id };
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