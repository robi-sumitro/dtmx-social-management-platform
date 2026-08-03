export const APP_NAME = 'DtmX';
export const APP_TAGLINE = 'Social Media Management Platform';

export const DEFAULT_PLAN_LIMITS = {
  free: { maxAccounts: 1, maxPostsPerMonth: 10, aiPerMonth: 20 },
  basic: { maxAccounts: 3, maxPostsPerMonth: 50, aiPerMonth: 200 },
  pro: { maxAccounts: 8, maxPostsPerMonth: 200, aiPerMonth: 1000 },
  enterprise: { maxAccounts: 20, maxPostsPerMonth: 1000, aiPerMonth: 5000 },
} as const;

export const QUOTA_DEFAULTS = {
  ai: 100,
} as const;