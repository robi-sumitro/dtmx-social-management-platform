import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, X, Sparkles, RefreshCw, Receipt, Send, Info } from 'lucide-react';
import { api } from '@/lib/api';
import type { Notification } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<string, { icon: React.ReactNode; className: string }> = {
  payment: { icon: <Receipt className="h-4 w-4" />, className: 'bg-amber-50 text-amber-600' },
  subscription: { icon: <Sparkles className="h-4 w-4" />, className: 'bg-brand-50 text-brand-600' },
  post: { icon: <Send className="h-4 w-4" />, className: 'bg-blue-50 text-blue-600' },
  success: { icon: <Check className="h-4 w-4" />, className: 'bg-emerald-50 text-emerald-600' },
  warning: { icon: <Info className="h-4 w-4" />, className: 'bg-orange-50 text-orange-600' },
  info: { icon: <Info className="h-4 w-4" />, className: 'bg-slate-50 text-slate-600' },
  system: { icon: <Info className="h-4 w-4" />, className: 'bg-slate-50 text-slate-500' },
};

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const [listResult, countResult] = await Promise.allSettled([
        api.get<Notification[]>('/notifications'),
        api.get<number>('/notifications/unread-count'),
      ]);
      const list = listResult.status === 'fulfilled' ? (Array.isArray(listResult.value) ? listResult.value : []) : [];
      setItems(list);
      if (countResult.status === 'fulfilled') {
        setUnread(typeof countResult.value === 'number' ? countResult.value : 0);
      } else {
        setUnread(list.filter((n) => !n.isRead).length);
      }
    } catch (err) {
      console.error('[NotificationBell] load error:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const openNotification = async (n: Notification) => {
    if (!n.isRead) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      try {
        await api.patch(`/notifications/${n.id}/read`);
      } catch (err) {
        console.error('[NotificationBell] markRead error:', err);
        setUnread((u) => u + 1);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: false } : x)));
      }
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    setUnread(0);
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    try {
      await api.patch('/notifications/read-all');
    } catch (err) {
      console.error('[NotificationBell] markAll error:', err);
      void load();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load(true);
        }}
        className="relative rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label="Notifikasi"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-4 z-[90] mt-2 flex max-h-[80vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-cardHover animate-scale-in">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800">Notifikasi</h3>
              {unread > 0 && <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">{unread} baru</span>}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => void markAll()}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand-600 transition hover:bg-brand-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Tandai dibaca
                </button>
              )}
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100" aria-label="Tutup">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-400">
                <RefreshCw className="h-4 w-4 animate-spin" /> Memuat...
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
                  <Bell className="h-5 w-5 text-slate-300" />
                </span>
                <p className="text-sm font-medium text-slate-600">Tidak ada notifikasi</p>
                <p className="text-xs text-slate-400">Pembaruan penting akan muncul di sini.</p>
              </div>
            ) : (
              items.map((n) => {
                const meta = TYPE_ICON[n.type] ?? TYPE_ICON.info ?? { icon: <Info className="h-4 w-4" />, className: 'bg-slate-50 text-slate-500' };
                return (
                  <button
                    key={n.id}
                    onClick={() => void openNotification(n)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50',
                      !n.isRead && 'bg-brand-50/40',
                    )}
                  >
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.className)}>
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-800">{n.title}</span>
                        {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                      </span>
                      {n.message && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{n.message}</span>}
                      <span className="mt-1 block text-[10px] text-slate-400">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
