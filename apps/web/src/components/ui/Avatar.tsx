import { cn, initials } from '@/lib/utils';

interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const gradient = [
    'from-indigo-500 to-violet-500',
    'from-violet-500 to-fuchsia-500',
    'from-blue-500 to-indigo-500',
    'from-rose-500 to-orange-400',
    'from-emerald-500 to-teal-500',
    'from-cyan-500 to-blue-500',
  ];
  const hash = (name ?? '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const bg = gradient[hash % gradient.length]!;

  if (src) {
    return <img src={src} alt={name ?? 'avatar'} className={cn('shrink-0 rounded-full object-cover ring-1 ring-slate-200', SIZES[size], className)} />;
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-1 ring-white/20',
        bg,
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
