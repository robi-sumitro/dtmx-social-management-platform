import { getActiveTimezone } from './timezone';

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(value?: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    timeZone: getActiveTimezone(),
    ...(opts ?? { day: 'numeric', month: 'short', year: 'numeric' }),
  });
}

export function formatDateTime(value?: string | Date): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    timeZone: getActiveTimezone(),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(value?: string | Date): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return formatDate(value);
}

export function postTitle(post: { title?: string | null; caption?: string | null; createdAt?: string | Date }): string {
  const title = post.title?.trim();
  if (title) return title;
  const caption = post.caption?.trim();
  if (caption) return caption.length > 60 ? `${caption.slice(0, 60)}…` : caption;
  return formatDateTime(post.createdAt);
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  if (currency === 'IDR') {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds || !Number.isFinite(seconds)) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function postStatusMeta(status: string): { label: string; className: string; dot: string } {
  const map: Record<string, { label: string; className: string; dot: string }> = {
    draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
    scheduled: { label: 'Terjadwal', className: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
    publishing: { label: 'Menerbitkan', className: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
    published: { label: 'Terbit', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
    failed: { label: 'Gagal', className: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
    cancelled: { label: 'Dibatalkan', className: 'bg-slate-100 text-slate-500 ring-slate-200', dot: 'bg-slate-400' },
    paused: { label: 'Dijeda', className: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
  };
  return map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' };
}

export function inboxStatusMeta(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    new: { label: 'Baru', className: 'bg-brand-50 text-brand-700 ring-brand-200' },
    replied: { label: 'Dibalas', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    ignored: { label: 'Diabaikan', className: 'bg-slate-100 text-slate-500 ring-slate-200' },
    queued: { label: 'Antrian', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  };
  return map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600 ring-slate-200' };
}

export function subscriptionStatusMeta(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: 'Aktif', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    pending: { label: 'Menunggu', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
    cancelled: { label: 'Dibatalkan', className: 'bg-slate-100 text-slate-500 ring-slate-200' },
    past_due: { label: 'Tunggakan', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
    expired: { label: 'Kedaluwarsa', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  };
  return map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600 ring-slate-200' };
}

export function paymentStatusMeta(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Menunggu', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
    PAID: { label: 'Dibayar', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    FAILED: { label: 'Gagal', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
    EXPIRED: { label: 'Kedaluwarsa', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
    REFUNDED: { label: 'Refund', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  };
  return map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600 ring-slate-200' };
}

export const PLATFORM_META: Record<string, { label: string; color: string; bg: string }> = {
  facebook: { label: 'Facebook', color: 'text-[#1877F2]', bg: 'bg-[#1877F2]/10' },
  instagram: { label: 'Instagram', color: 'text-[#E4405F]', bg: 'bg-[#E4405F]/10' },
  youtube: { label: 'YouTube', color: 'text-[#FF0000]', bg: 'bg-[#FF0000]/10' },
  tiktok: { label: 'TikTok', color: 'text-slate-900', bg: 'bg-slate-900/10' },
  all: { label: 'Multi-platform', color: 'text-brand-600', bg: 'bg-brand-50' },
  both: { label: 'FB + IG', color: 'text-brand-600', bg: 'bg-brand-50' },
};

export const PAYMENT_METHOD_META: Record<string, { label: string; icon: string }> = {
  manual: { label: 'Transfer Manual', icon: '🏦' },
  stripe: { label: 'Stripe', icon: '💳' },
  tripay: { label: 'TriPay', icon: '🪙' },
  midtrans: { label: 'Midtrans', icon: '💠' },
};

export const PROVIDER_TYPES: Record<string, string[]> = {
  facebook: ['facebook_page'],
  instagram: ['instagram'],
  youtube: ['youtube_channel'],
  tiktok: ['tiktok_account'],
};
