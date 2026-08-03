import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  className?: string;
  children: ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-card', className)}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, action, icon, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6', className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {icon}
          </div>
        )}
        <div>
          {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: CardProps) {
  return <div className={cn('p-5 sm:p-6', className)}>{children}</div>;
}

export function CardFooter({ className, children }: CardProps) {
  return <div className={cn('border-t border-slate-100 px-5 py-4 sm:px-6', className)}>{children}</div>;
}
