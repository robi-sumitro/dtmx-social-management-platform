import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Trash2, Ban, CalendarClock } from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api } from '@/lib/api';
import type { Post } from '@/lib/types';
import { cn, formatDate, postStatusMeta, timeAgo } from '@/lib/utils';
import { PageHeader, PlatformIcon, ErrorPanel } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

type Filter = 'all' | 'draft' | 'scheduled' | 'published' | 'failed';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'published', label: 'Terbit' },
  { value: 'failed', label: 'Gagal' },
];

export function Posts() {
  const [filter, setFilter] = useState<Filter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Post | null>(null);
  const toast = useToast();

  const { data, error, loading, refetch } = useFetch<Post[]>(() => api.get('/posts'), []);
  const posts = (data ?? []).filter((p) => (filter === 'all' ? true : p.status === filter));

  const counts = (status: Filter) =>
    status === 'all' ? data?.length ?? 0 : data?.filter((p) => p.status === status).length ?? 0;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.delete(`/posts/${deleteTarget.id}`);
    toast.success('Postingan dihapus');
    refetch();
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    await api.post(`/posts/${cancelTarget.id}/cancel`);
    toast.success('Postingan dibatalkan');
    refetch();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Postingan"
        description="Kelola semua konten yang dibuat dan dijadwalkan."
        action={
          <Link to="/app/posts/new">
            <Button icon={<Plus className="h-4 w-4" />}>Buat Postingan</Button>
          </Link>
        }
      />

      <Tabs
        className="mb-6 w-fit"
        value={filter}
        onChange={setFilter}
        items={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts(f.value) }))}
      />

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refetch} />
      ) : posts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={filter === 'all' ? 'Belum ada postingan' : `Tidak ada postingan ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()}`}
            description="Buat postingan pertama dan jadwalkan ke platform favoritmu."
            action={
              <Link to="/app/posts/new">
                <Button icon={<Plus className="h-4 w-4" />}>Buat Postingan</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => {
            const meta = postStatusMeta(post.status);
            const preview = post.media?.[0]?.media;
            return (
              <Card key={post.id} className="group overflow-hidden">
                {preview ? (
                  preview.fileType === 'video' ? (
                    <div className="relative flex h-44 items-center justify-center bg-slate-900">
                      <span className="text-4xl">🎬</span>
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">Video</span>
                    </div>
                  ) : (
                    <img src={`/uploads/${preview.filename}`} alt={preview.originalName} className="h-44 w-full object-cover" loading="lazy" />
                  )
                ) : (
                  <div className="flex h-24 items-center justify-center bg-brand-gradient-soft">
                    <span className="text-3xl opacity-40">📝</span>
                  </div>
                )}
                <div className="p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge className={meta.className} dot={meta.dot}>
                      {meta.label}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      {(post.accounts ?? []).slice(0, 4).map((pa) => (
                        <PlatformIcon key={pa.accountId} provider={pa.account?.provider ?? ''} size="h-4 w-4" />
                      ))}
                    </div>
                  </div>
                  <p className="line-clamp-2 min-h-10 text-sm font-medium leading-relaxed text-slate-800">
                    {post.caption || post.title || 'Tanpa caption'}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                    <span>{timeAgo(post.createdAt)}</span>
                    {post.scheduledAt && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatDate(post.scheduledAt)}
                      </span>
                    )}
                  </div>
                  {post.errorMessage && <p className="mt-2 text-xs text-rose-500">{post.errorMessage}</p>}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3.5">
                    <span className="text-xs capitalize text-slate-400">{post.postType}</span>
                    <div className="flex items-center gap-1">
                      {post.status === 'scheduled' && (
                        <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => setCancelTarget(post)}>
                          <Ban className="h-4 w-4" />
                          Batal
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => setDeleteTarget(post)}>
                        <Trash2 className="h-4 w-4" />
                        Hapus
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        danger
        title="Hapus postingan?"
        description="Postingan akan dihapus permanen dan tidak bisa dikembalikan."
        confirmLabel="Ya, Hapus"
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Batalkan postingan?"
        description="Postingan yang terjadwal akan dibatalkan dan tidak akan diterbitkan."
        confirmLabel="Batalkan"
        onConfirm={handleCancel}
      />
    </div>
  );
}
