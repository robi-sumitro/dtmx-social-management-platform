import type { ReactNode } from 'react';
import { Facebook, Instagram, Youtube, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2.5">{action}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  hint?: ReactNode;
  accent?: 'brand' | 'emerald' | 'amber' | 'rose' | 'blue';
  className?: string;
}

const ACCENTS = {
  brand: 'bg-brand-50 text-brand-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  blue: 'bg-blue-50 text-blue-600',
};

export function StatCard({ label, value, icon, hint, accent = 'brand', className }: StatCardProps) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:shadow-cardHover', className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', ACCENTS[accent])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function PlatformIcon({ provider, size = 'h-4 w-4', className }: { provider: string; size?: string; className?: string }) {
  const cls = cn('shrink-0', size, className);
  switch (provider) {
    case 'facebook':
      return <Facebook className={cls} style={{ color: '#1877F2' }} />;
    case 'instagram':
      return <Instagram className={cls} style={{ color: '#E4405F' }} />;
    case 'youtube':
      return <Youtube className={cls} style={{ color: '#FF0000' }} />;
    case 'tiktok':
      return <Globe className={cls} style={{ color: '#0f172a' }} />;
    default:
      return <Globe className={cls} style={{ color: '#4f46e5' }} />;
  }
}

interface ErrorPanelProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorPanel({ message, onRetry }: ErrorPanelProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-100 bg-rose-50/60 px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-2xl">⚠️</div>
      <p className="text-sm font-medium text-rose-700">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500">
          Coba lagi
        </button>
      )}
    </div>
  );
}
