import { SocialAccount } from '@prisma/client';

/** Minimal media descriptor passed to platform adapters. */
export interface PlatformMedia {
  filename: string;
  mimeType: string | null;
  fileType: string;
}

export interface PublishContext {
  caption: string | null;
  hashtags: string | null;
  title: string | null;
  postType: string;
  media: PlatformMedia[];
  mediaBaseUrl: string;
}

export interface ReplyContext {
  text: string;
  authorId?: string | null;
  targetId?: string | null;
  /** Inbox item kind (comment|dm) — lets adapters pick the right reply endpoint. */
  kind?: string | null;
}

/** Result of a single platform operation. */
export interface PlatformResult {
  remoteId?: string | null;
  ok: boolean;
  warning?: string;
}

export interface InboxPullItem {
  kind: string;
  sourceId: string;
  authorName?: string;
  authorId?: string;
  content?: string;
  mediaUrl?: string;
  /** When the comment/DM was actually created on the platform (ISO string). */
  publishedAt?: string;
}

/** Aggregated engagement metrics (typically last 30 days). */
export interface PlatformInsights {
  reach: number;
  impressions: number;
  engagementCount: number;
  linkClicks: number;
}

export interface PlatformAdapter {
  readonly provider: string;
  /** Publish a post to a connected account. Throws on hard failure. */
  publish(account: SocialAccount, post: PublishContext): Promise<PlatformResult>;
  /** Push a reply/comment/DM to the platform. Throws on hard failure. */
  reply?(account: SocialAccount, ctx: ReplyContext): Promise<PlatformResult>;
  /** Delete a comment/reply from the platform. Throws on hard failure. */
  deleteComment?(account: SocialAccount, targetId: string): Promise<PlatformResult>;
  /** Pull new comments/DMs/mentions for an account. */
  pullInbox?(account: SocialAccount, since?: Date, existingIds?: string[]): Promise<InboxPullItem[]>;
  /** Fetch aggregated engagement metrics for an account. */
  insights?(account: SocialAccount, since?: Date): Promise<PlatformInsights | null>;
}