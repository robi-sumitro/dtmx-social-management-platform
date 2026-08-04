import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, Trash2, Ban, CalendarClock, Calendar, LayoutGrid, Upload } from 'lucide-react';
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
type ViewMode = 'grid' | 'calendar';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'published', label: 'Terbit' },
  { value: 'failed', label: 'Gagal' },
];

export function Posts() {
  const [filter, setFilter] = useState<Filter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Post | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const navigate = useNavigate();

  const handleCsvImport = async (file: File | null) => {
    if (!file) return;
    setUploadingCsv(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(Boolean);
      let imported = 0;
      // Skip header if any
      const startIndex = lines[0].toLowerCase().includes('caption') ? 1 : 0;
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
        const [title, caption, scheduledAt] = parts;
        if (caption) {
          await api.post('/posts', {
            title: title || 'Bulk Post',
            caption,
            postType: 'text',
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
            action: scheduledAt ? 'schedule' : 'draft',
          });
          imported++;
        }
      }
      toast.success(`Berhasil mengimpor ${imported} postingan`);
      refetch();
    } catch (err) {
      toast.error('Gagal import CSV', err instanceof Error ? err.message : 'Format CSV tidak valid');
    } finally {
      setUploadingCsv(false);
    }
  };

  const { data, error, loading, refetch } = useFetch<Post[]>(
    () => api.get(`/posts${filter !== 'all' ? `?status=${filter}` : ''}`),
    [filter],
  );
  const posts = data ?? [];

  const allPosts = useFetch<Post[]>(() => api.get('/posts'), []);
  const counts = (status: Filter) =>
    status === 'all' ? allPosts.data?.length ?? 0 : allPosts.data?.filter((p) => p.status === status).length ?? 0;

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

  // Calendar generation helpers
  const [calDate, setCalDate] = useState(new Date());
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  return (
    <div className="animate-fade-in">
      <input
        ref={csvRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={(e) => {
          void handleCsvImport(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      <PageHeader
        title="Postingan"
        description="Kelola semua konten yang dibuat dan dijadwalkan."
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<Upload className="h-4 w-4" />}
              loading={uploadingCsv}
              onClick={() => csvRef.current?.click()}
            >
              Import CSV
            </Button>
            <div className="flex rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition', viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900')}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Grid
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition', viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900')}
              >
                <Calendar className="h-3.5 w-3.5" />
                Kalender
              </button>
            </div>
            <Link to="/app/posts/new">
              <Button icon={<Plus className="h-4 w-4" />}>Buat Postingan</Button>
            </Link>
          </div>
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
      ) : viewMode === 'calendar' ? (
        <Card className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">{monthNames[month]} {year}</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setCalDate(new Date(year, month - 1, 1))}>Bulan Lalu</Button>
              <Button size="sm" variant="outline" onClick={() => setCalDate(new Date())}>Hari Ini</Button>
              <Button size="sm" variant="outline" onClick={() => setCalDate(new Date(year, month + 1, 1))}>Bulan Depan</Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400">
            <span>Min</span><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="h-28 rounded-lg bg-slate-50/50" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayPosts = posts.filter((p) => p.scheduledAt && p.scheduledAt.startsWith(dateStr));
              return (
                <div key={`day-${day}`} className="h-28 overflow-y-auto rounded-lg border border-slate-100 bg-white p-2 text-left">
                  <span className="text-xs font-semibold text-slate-700">{day}</span>
                  <div className="mt-1.5 space-y-1">
                    {dayPosts.map((p) => {
                      const meta = postStatusMeta(p.status);
                      return (
                        <div
                          key={p.id}
                          onClick={() => navigate(`/app/posts/${p.id}`)}
                          className={cn('cursor-pointer truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white', meta.className.includes('amber') ? 'bg-amber-500' : meta.className.includes('emerald') ? 'bg-emerald-500' : 'bg-brand-600')}
                          title={p.title || p.caption || ''}
                        >
                          {p.title || p.caption || 'Postingan'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
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
              <div key={post.id} className="group cursor-pointer" onClick={() => navigate(`/app/posts/${post.id}`)}>
              <Card className="overflow-hidden transition group-hover:shadow-cardHover">
                {preview ? (
                  preview.fileType === 'video' ? (
                    <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                      <video
                        src={`/uploads/${preview.filename}`}
                        className="h-full w-full object-cover"
                        muted
                        preload="metadata"
                        onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 1; }}
                      />
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
                  <p className="line-clamp-2 min-h-6 text-sm font-bold text-slate-900">
                    {post.title || (post.caption ? post.caption.slice(0, 50) : 'Tanpa Judul')}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                    {post.title ? post.caption : ''}
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
                        <Button size="sm" variant="ghost" className="text-slate-500" onClick={(e) => { e.stopPropagation(); setCancelTarget(post); }}>
                          <Ban className="h-4 w-4" />
                          Batal
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-rose-500" onClick={(e) => { e.stopPropagation(); setDeleteTarget(post); }}>
                        <Trash2 className="h-4 w-4" />
                        Hapus
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
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
