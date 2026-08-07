export interface User {
  id: string;
  email: string;
  username?: string;
  fullName?: string;
  avatar?: string;
  role: 'user' | 'admin';
  isActive?: boolean;
  quotaAi?: number;
  timezone?: string;
  lastLoginAt?: string;
  createdAt: string;
  postCount?: number;
  accountCount?: number;
  activeSubscription?: Subscription | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  billingPeriodDays: number;
  maxAccounts: number;
  maxPostsPerMonth: number;
  aiPerMonth: number;
  isActive: boolean;
  createdAt?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  paymentMethod: string;
  paymentProof?: string;
  startedAt?: string;
  expiresAt?: string;
  activeAiQuota: number;
  plan?: Plan;
  createdAt?: string;
}

export interface Payment {
  id: string;
  subscriptionId?: string;
  userId: string;
  planId: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  providerRef?: string;
  proofFile?: string;
  metadata?: Record<string, unknown>;
  plan?: Plan;
  createdAt?: string;
}

export interface SocialAccount {
  id: string;
  userId: string;
  provider: 'facebook' | 'instagram' | 'youtube' | 'tiktok';
  accountType: string;
  accountName: string;
  platformId: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  tokenExpiresAt?: string;
  instagramId?: string;
  avatarUrl?: string;
  followersCount?: number;
  parentId?: string | null;
  isActive: boolean;
  lastSyncAt?: string;
  createdAt: string;
}

export interface MediaFile {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  fileType: string;
  mimeType?: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
  folder: string;
  createdAt: string;
}

export interface PostAccount {
  id: string;
  postId: string;
  accountId: string;
  account?: SocialAccount;
}

export interface PostMedia {
  id: string;
  postId: string;
  mediaId: string;
  order: number;
  media?: MediaFile;
}

export interface Post {
  id: string;
  userId: string;
  title?: string;
  caption?: string;
  hashtags?: string;
  platform?: string;
  postType: string;
  status: string;
  scheduledAt?: string;
  publishedAt?: string;
  overrides?: Record<string, unknown>;
  allowRepost?: boolean;
  errorMessage?: string;
  retryCount?: number;
  createdAt: string;
  updatedAt: string;
  accounts?: PostAccount[];
  media?: PostMedia[];
}

export interface InboxItem {
  id: string;
  userId: string;
  accountId: string;
  kind: 'comment' | 'dm' | 'mention';
  sourceId?: string;
  authorName?: string;
  authorId?: string;
  content?: string;
  mediaUrl?: string;
  parentId?: string;
  status: 'new' | 'replied' | 'ignored' | 'queued';
  repliedAt?: string;
  replyContent?: string;
  createdAt: string;
  account?: SocialAccount;
}

export interface AutoReplyRule {
  id: string;
  userId: string;
  accountId?: string;
  name: string;
  matchType: string;
  matchText?: string;
  replyTemplate?: string;
  useAI: boolean;
  aiProvider?: string;
  aiPrompt?: string;
  enabled: boolean;
  createdAt?: string;
  account?: SocialAccount | null;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
  updatedAt?: string;
}

export interface AiStatus {
  provider: string;
  quota: number;
  used: number;
  remaining: number;
  limitReached: boolean;
}

export interface UsageResponse {
  plan: Plan | null;
  accountsUsed: number;
  postsUsed: number;
  aiUsed: number;
  limits: { accounts?: number; posts?: number; ai?: number };
}

export interface AdminDashboard {
  totalUsers: number;
  totalPosts: number;
  totalMedia: number;
  totalSubscribers: number;
  totalPlans: number;
  revenue: number;
  enabledFlags: number;
}

export interface InboxListResponse {
  items: InboxItem[];
  total: number;
  page: number;
  limit: number;
  counts?: Record<string, number>;
}

export type { AnalyticsSummary, AccountInsights } from '@dtmx/shared';

export interface PendingSubscription {
  id: string;
  status: string;
  paymentMethod: string;
  paymentProof?: string;
  user: { email: string; fullName?: string };
  plan: Plan;
  payment?: Payment[];
  createdAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface PaymentSetting {
  id: string;
  key: string;
  label: string;
  value?: string;
  placeholder?: string;
  order: number;
  updatedAt?: string;
}

export interface ManualPaymentInfo {
  enabled: boolean;
  info: Record<string, string>;
  fields: PaymentSetting[];
}

export interface AiSetting {
  id: string;
  key: string;
  label: string;
  value?: string;
  placeholder?: string;
  order: number;
  updatedAt?: string;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'partial' | 'failed' | 'cancelled';
export type PostType = 'text' | 'image' | 'video' | 'carousel' | 'short_video';
export type PaymentMethod = 'manual' | 'stripe' | 'tripay' | 'midtrans';
