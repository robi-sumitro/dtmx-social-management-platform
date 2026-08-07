export const PLATFORMS = [
  'facebook',
  'instagram',
  'youtube',
  'tiktok',
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const POST_TYPES = [
  'text',
  'image',
  'video',
  'carousel',
  'short_video',
] as const;

export type PostType = (typeof POST_TYPES)[number];

export const POST_STATUS = [
  'draft',
  'scheduled',
  'publishing',
  'published',
  'partial',
  'failed',
  'cancelled',
] as const;

export type PostStatus = (typeof POST_STATUS)[number];

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SUBSCRIPTION_STATUS = [
  'active',
  'pending',
  'cancelled',
  'past_due',
  'expired',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];

export const PAYMENT_METHODS = ['manual', 'stripe', 'tripay', 'midtrans'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUS = [
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const INBOX_TYPES = ['comment', 'dm', 'mention'] as const;
export type InboxType = (typeof INBOX_TYPES)[number];

export const INBOX_STATUS = ['new', 'replied', 'ignored', 'queued'] as const;
export type InboxStatus = (typeof INBOX_STATUS)[number];

export const AI_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];

export const AI_FEATURES = ['auto_reply', 'content_writer', 'caption_help'] as const;
export type AIFeature = (typeof AI_FEATURES)[number];

export interface AccountInsights {
  accountId: string;
  accountName: string;
  provider: string;
  avatarUrl?: string | null;
  reach: number;
  engagementRate: number;
  linkClicks: number;
  error?: string;
}

export interface AnalyticsSummary {
  reach: number;
  engagementRate: number;
  linkClicks: number;
  publishedPosts: number;
  lastSyncedAt: Date | null;
  byAccount: AccountInsights[];
}