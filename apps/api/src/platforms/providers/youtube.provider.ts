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
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
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

  /** Delete a comment (or reply) from the channel. Needs youtube.force-ssl. */
  async deleteComment(account: SocialAccount, targetId: string): Promise<PlatformResult> {
    if (!account.accessToken) throw new Error('YouTube: token tidak dikonfigurasi');
    try {
      await axios.delete(`${DATA}/comments`, {
        params: { id: targetId },
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });
    } catch (err) {
      // A 404 means the comment is already gone from YouTube — treat that as success.
      if ((err as any)?.response?.status === 404) return { ok: true };
      throw new Error(extractApiError(err));
    }
    return { ok: true };
  }

  /** Pull comments from the channel's videos. Needs youtube.readonly (+ force-ssl to reply). */
  async pullInbox(account: SocialAccount, _since?: Date, existingIds?: string[]): Promise<InboxPullItem[]> {
    if (!account.accessToken) throw new Error('YouTube: token tidak dikonfigurasi');
    const channelId = account.platformId;
    const items: InboxPullItem[] = [];
    const seen = new Set<string>();

    // commentThreads.list with allThreadsRelatedToChannelId never returns the
    // `replies` part, so the only way to get replies is comments.list. Pulling
    // that for every thread on every 5-min sync blows through the YouTube daily
    // API quota (10k units) and makes pullInbox fail wholesale — comments stop
    // landing in the inbox. So only drill into the reply tree for comment
    // threads that are genuinely new, and cap the calls as a safety net.
    const existing = new Set(existingIds ?? []);
    let replyCalls = 0;
    const MAX_REPLY_CALLS = 50;

    const pushComment = (c: any) => {
      if (!c?.id || seen.has(c.id)) return;
      seen.add(c.id);
      items.push({
        kind: 'comment',
        sourceId: c.id,
        authorId: c.snippet?.authorChannelId?.value,
        authorName: c.snippet?.authorDisplayName,
        content: c.snippet?.textDisplay || '',
        publishedAt: c.snippet?.publishedAt || undefined,
      });
    };

    // commentThreads only returns a limited set of replies (1 level, ~5 inline).
    // Fetch the complete reply list — including nested replies — via comments.list.
    const fetchReplies = async (parentId: string) => {
      let replyToken: string | undefined;
      do {
        if (replyCalls >= MAX_REPLY_CALLS) return;
        replyCalls += 1;
        const { data } = await axios.get(`${DATA}/comments`, {
          params: {
            part: 'snippet',
            parentId,
            maxResults: 100,
            textFormat: 'plainText',
            pageToken: replyToken,
          },
          headers: { Authorization: `Bearer ${account.accessToken}` },
        });
        for (const c of data?.items ?? []) {
          pushComment(c);
          if ((c.snippet?.totalReplyCount ?? 0) > 0) await fetchReplies(c.id);
        }
        replyToken = data?.nextPageToken;
      } while (replyToken && items.length < 500);
    };

    let pageToken: string | undefined;
    do {
      const { data } = await axios.get(`${DATA}/commentThreads`, {
        params: {
          part: 'snippet,replies',
          allThreadsRelatedToChannelId: channelId,
          maxResults: 100,
          textFormat: 'plainText',
          order: 'time',
          pageToken,
        },
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });

      for (const thread of data?.items ?? []) {
        const top = thread?.snippet?.topLevelComment;
        pushComment(top);

        // Inline replies are only a subset of the thread; pull the rest via
        // comments.list so sub-comments never get missed for auto-reply.
        const inlineCount = thread?.replies?.comments?.length ?? 0;
        const totalReplies = thread?.snippet?.totalReplyCount ?? 0;
        for (const reply of thread?.replies?.comments ?? []) {
          pushComment(reply);
          if ((reply.snippet?.totalReplyCount ?? 0) > 0) await fetchReplies(reply.id);
        }
        if (top?.id && !existing.has(top.id) && totalReplies > inlineCount) await fetchReplies(top.id);
      }
      pageToken = data?.nextPageToken;
    } while (pageToken && items.length < 500);

    return items;
  }
}