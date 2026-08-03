import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
}

export function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  const [focus, setFocus] = useState(false);
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2.5', disabled && 'cursor-not-allowed opacity-50')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none',
          focus && 'ring-2 ring-brand-300 ring-offset-2',
          checked ? 'bg-brand-600' : 'bg-slate-200',
        )}
      >
        <span
          className={cn(
            'inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform duration-200 h-[18px] w-[18px]',
            checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
          )}
        />
      </button>
      {label && <span className="text-sm text-slate-600">{label}</span>}
    </label>
  );
}
