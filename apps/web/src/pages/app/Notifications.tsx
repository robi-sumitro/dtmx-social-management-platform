import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Trash2, CheckCheck, ChevronDown, ExternalLink, Info } from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api } from '@/lib/api';
import type { Notification } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { TYPE_ICON } from '@/components/notifications/NotificationBell';
import { PageHeader, ErrorPanel } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

export function Notifications() {
  const toast = useToast();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Notification | null>(null);

  const { data, loading, error, refetch } = useFetch<Notification[]>(() => api.get('/notifications?limit=200'));
  const items = data ?? [];

  const openDetail = async (n: Notification) => {
    setExpanded((prev) => (prev === n.id ? null : n.id));
    if (!n.isRead) {
      try {
        await api.patch(`/notifications/${n.id}/read`);
        refetch();
      } catch {
        /* noop */
      }
    }
  };

  const markAll = async () => {
    try {
      await api.patch('/notifications/read-all');
      toast.success('Semua notifikasi ditandai dibaca');
      refetch();
    } catch (err) {
      toast.error('Gagal menandai dibaca', err instanceof Error ? err.message : 'Terjadi kesalahan');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/notifications/${deleteTarget.id}`);
      toast.success('Notifikasi dihapus');
      refetch();
    } catch (err) {
      toast.error('Gagal menghapus', err instanceof Error ? err.message : 'Terjadi kesalahan');
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Notifikasi"
        description="Riwayat semua pemberitahuan aktivitas akun dan postingan."
        action={
          <Button variant="outline" size="sm" icon={<CheckCheck className="h-4 w-4" />} onClick={() => void markAll()}>
            Tandai Semua Dibaca
          </Button>
        }
      />

      {loading ? (
        <PageLoader label="Memuat notifikasi..." />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refetch} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="h-6 w-6" />}
            title="Tidak ada notifikasi"
            description="Pembaruan penting akan muncul di sini."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-slate-50">
            {items.map((n) => {
              const meta = TYPE_ICON[n.type] ?? TYPE_ICON.info ?? { icon: <Info className="h-4 w-4" />, className: 'bg-slate-50 text-slate-500' };
              const isOpen = expanded === n.id;
              return (
                <div key={n.id} className={cn('transition hover:bg-slate-50/60', !n.isRead && 'bg-brand-50/30')}>
                  <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', meta.className)}>
                      {meta.icon}
                    </span>
                    <button
                      onClick={() => void openDetail(n)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn('truncate text-sm', n.isRead ? 'font-medium text-slate-700' : 'font-semibold text-slate-900')}>
                          {n.title}
                        </span>
                        {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                      </span>
                      {!isOpen && n.message && <span className="mt-0.5 block truncate text-xs text-slate-500">{n.message}</span>}
                      <span className="mt-0.5 block text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => void openDetail(n)} icon={<ChevronDown className={cn('h-4 w-4 transition', isOpen && 'rotate-180')} />}>
                        Detail
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => setDeleteTarget(n)} icon={<Trash2 className="h-4 w-4" />}>
                        Hapus
                      </Button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mx-4 mb-3 rounded-xl border border-slate-100 bg-white p-4 sm:mx-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Detail</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{n.message || 'Tidak ada detail tambahan.'}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span>Jenis: {n.type}</span>
                        <span>Status: {n.isRead ? 'Sudah dibaca' : 'Belum dibaca'}</span>
                        {n.data && Object.keys(n.data as object).length > 0 && (
                          <span>Data: {Object.keys(n.data as object).join(', ')}</span>
                        )}
                      </div>
                      {n.link && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          icon={<ExternalLink className="h-3.5 w-3.5" />}
                          onClick={() => navigate(n.link as string)}
                        >
                          Buka
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        danger
        title="Hapus notifikasi?"
        description="Notifikasi ini akan dihapus permanen dan tidak bisa dikembalikan."
        confirmLabel="Ya, Hapus"
        onConfirm={handleDelete}
      />
    </div>
  );
}
