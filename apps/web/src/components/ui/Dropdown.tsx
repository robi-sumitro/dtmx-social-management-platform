import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface DropdownItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  onClick?: () => void;
  divider?: boolean;
}

interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  anchor: 'left' | 'right';
  items: DropdownItem[];
  className?: string;
}

export function DropdownMenu({ open, onClose, anchor, items, className }: DropdownMenuProps) {
  if (!open) return null;
  return createPortal(
    <div
      className={cn(
        'fixed z-[90] mt-2 min-w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-cardHover animate-scale-in',
        anchor === 'right' ? 'right-4' : 'left-4',
        className,
      )}
    >
      {items.map((item) =>
        item.divider ? (
          <div key={item.key} className="my-1.5 h-px bg-slate-100" />
        ) : (
          <button
            key={item.key}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            className={cn(
              'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-slate-50',
              item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
