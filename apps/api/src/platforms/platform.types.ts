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
}

export interface PlatformAdapter {
  readonly provider: string;
  /** Publish a post to a connected account. Throws on hard failure. */
  publish(account: SocialAccount, post: PublishContext): Promise<PlatformResult>;
  /** Push a reply/comment/DM to the platform. Throws on hard failure. */
  reply?(account: SocialAccount, ctx: ReplyContext): Promise<PlatformResult>;
  /** Pull new comments/DMs/mentions for an account. */
  pullInbox?(account: SocialAccount, since?: Date): Promise<InboxPullItem[]>;
}