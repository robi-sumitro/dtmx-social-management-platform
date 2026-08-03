import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  color?: 'brand' | 'emerald' | 'amber' | 'rose';
}

const COLORS = {
  brand: 'bg-gradient-to-r from-brand-500 to-violet-500',
  emerald: 'bg-gradient-to-r from-emerald-400 to-teal-500',
  amber: 'bg-gradient-to-r from-amber-400 to-orange-500',
  rose: 'bg-gradient-to-r from-rose-400 to-rose-500',
};

export function ProgressBar({ value, max = 100, className, barClassName, color = 'brand' }: ProgressProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', COLORS[color], barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function UsageBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? value / max : 0;
  const color = pct >= 1 ? 'rose' : pct >= 0.75 ? 'amber' : 'emerald';
  return <ProgressBar value={value} max={max} color={color} />;
}
