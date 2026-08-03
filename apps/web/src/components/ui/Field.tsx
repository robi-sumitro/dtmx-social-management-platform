import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const baseField =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-100 focus:border-brand-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

interface FieldProps {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  icon?: ReactNode;
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldProps
>(({ className, label, error, hint, required, icon, id, ...props }, ref) => {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} htmlFor={inputId}>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(baseField, 'h-11', icon ? 'pl-10' : undefined, error && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100', className)}
          {...props}
        />
      </div>
    </FieldShell>
  );
});
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps
>(({ className, label, error, hint, required, id, ...props }, ref) => {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} htmlFor={inputId}>
      <textarea
        ref={ref}
        id={inputId}
        className={cn(baseField, 'py-2.5', error && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100', className)}
        {...props}
      />
    </FieldShell>
  );
});
Textarea.displayName = 'Textarea';

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(({ className, label, error, hint, required, id, children, ...props }, ref) => {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} htmlFor={inputId}>
      <select
        ref={ref}
        id={inputId}
        className={cn(baseField, 'h-11 appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2020%2020%27%20fill%3D%27%2394a3b8%27%3E%3Cpath%20fill-rule%3D%27evenodd%27%20d%3D%27M5.293%207.293a1%201%200%20011.414%200L10%2010.586l3.293-3.293a1%201%200%20111.414%201.414l-4%204a1%201%200%2001-1.414%200l-4-4a1%201%200%20010-1.414z%27%20clip-rule%3D%27evenodd%27%2F%3E%3C%2Fsvg%3E")] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10', error && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100', className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});
Select.displayName = 'Select';

function FieldShell({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
}: {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-600">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
      {!error && hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
