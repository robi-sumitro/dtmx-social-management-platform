import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconSize?: string;
  textClassName?: string;
}

export function Logo({ className, iconSize = 'h-9 w-9', textClassName = 'text-lg' }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative flex items-center justify-center rounded-xl bg-brand-gradient shadow-glow',
          iconSize,
        )}
      >
        <svg viewBox="0 0 64 64" className="h-[58%] w-[58%]" fill="none" aria-hidden>
          <path
            d="M16 16l10 26 6-17 6 17 10-26"
            stroke="#fff"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={cn('font-bold tracking-tight text-slate-900', textClassName)}>
        Dtm<span className="text-brand-600">X</span>
      </span>
    </div>
  );
}

export function LogoLight({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
        <svg viewBox="0 0 64 64" className="h-[58%] w-[58%]" fill="none" aria-hidden>
          <path
            d="M16 16l10 26 6-17 6 17 10-26"
            stroke="#fff"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight text-white">
        Dtm<span className="text-brand-400">X</span>
      </span>
    </div>
  );
}
