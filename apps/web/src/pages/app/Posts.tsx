import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, Trash2, Ban, CalendarClock, Calendar, LayoutGrid, Upload } from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api } from '@/lib/api';
import type { MediaFile, Post, SocialAccount } from '@/lib/types';
import { cn, formatDate, formatDateTime, postStatusMeta, postTitle } from '@/lib/utils';
import { getActiveTimezone, fromLocalInputValue, toLocalInputValue } from '@/lib/timezone';
import { PageHeader, PlatformIcon, ErrorPanel } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

type Filter = 'all' | 'draft' | 'scheduled' | 'published' | 'partial' | 'failed';
type ViewMode = 'grid' | 'calendar';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'published', label: 'Terbit' },
  { value: 'partial', label: 'Sebagian Gagal' },
  { value: 'failed', label: 'Gagal' },
];

/**
 * Parse a table file (CSV/TXT or Excel .xlsx/.xls) into string rows.
 * Excel date cells are normalized to "YYYY-MM-DDTHH:mm" in the active timezone.
 */
async function readTableFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return parseCsv(await file.text());
  }
  // Loaded lazily so the main bundle stays small; only fetched for Excel imports.
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
  return raw.map((r) => {
    const cells = Array.isArray(r) ? r : [r];
    return cells.map((c) => {
      if (c instanceof Date && !Number.isNaN(c.getTime())) {
        return toLocalInputValue(c);
      }
      return String(c ?? '').trim();
    });
  });
}

/** Minimal RFC4180-style CSV parser: handles quoted fields (commas, quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => {
    row.push(field.trim());
    field = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushField();
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  pushField();
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

function isHeaderRow(row: string[]): boolean {
  const first = (row[0] || '').toLowerCase();
  const second = (row[1] || '').toLowerCase();
  return first === 'title' || first === 'judul' || second === 'caption';
}

/** Resolve "Nama Akun A|Nama Akun B" (or ids) to account ids. Matched by name or id. */
function resolveAccounts(raw: string | undefined, accounts: SocialAccount[]): string[] {
  if (!raw) return [];
  const ids = new Set<string>();
  for (const part of raw.split('|')) {
    const v = part.trim();
    if (!v) continue;
    const lower = v.toLowerCase();
    const byId = accounts.find((a) => a.id === v);
    if (byId) {
      ids.add(byId.id);
      continue;
    }
    const byName = accounts.find((a) => a.accountName.toLowerCase() === lower);
    if (byName) ids.add(byName.id);
  }
  return Array.from(ids);
}

/** Resolve media references (original name, filename, or id, pipe-separated) to MediaFile objects. */
function resolveMedia(raw: string | undefined, media: MediaFile[]): MediaFile[] {
  if (!raw) return [];
  const found: MediaFile[] = [];
  for (const part of raw.split('|')) {
    const v = part.trim();
    if (!v) continue;
    const lower = v.toLowerCase();
    const byId = media.find((m) => m.id === v);
    if (byId) {
      found.push(byId);
      continue;
    }
    const byOrig = media.find((m) => m.originalName.toLowerCase() === lower);
    if (byOrig) {
      found.push(byOrig);
      continue;
    }
    const byFile = media.find(
      (m) => m.filename.toLowerCase() === lower || m.filename.toLowerCase().endsWith(`/${lower}`),
    );
    if (byFile) found.push(byFile);
  }
  return found;
}

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
      const rows = await readTableFile(file);
      if (rows.length === 0) {
        toast.error('File kosong', 'Tidak ada baris yang bisa diimpor.');
        return;
      }

      const startIndex = isHeaderRow(rows[0]) ? 1 : 0;
      const [accounts, media] = await Promise.all([
        api.get<SocialAccount[]>('/social-accounts').catch(() => []),
        api.get<MediaFile[]>('/media').catch(() => []),
      ]);

      let imported = 0;
      const warnings: string[] = [];
      for (let i = startIndex; i < rows.length; i++) {
        const [title, caption, scheduledAt, accountsRaw, mediaRaw] = rows[i];
        const matchedMedia = resolveMedia(mediaRaw, media);
        const accountIds = resolveAccounts(accountsRaw, accounts);
        if (!title?.trim() && !caption?.trim() && matchedMedia.length === 0) continue;

        const hasVideo = matchedMedia.some((m) => m.fileType === 'video');
        const hasImage = matchedMedia.some((m) => m.fileType === 'image');
        const postType = hasVideo ? 'video' : hasImage ? 'image' : 'text';
        const lineNo = i + 1;
        if ((accountsRaw || '').trim() && accountIds.length === 0) {
          warnings.push(`Baris ${lineNo}: akun "${accountsRaw}" tidak ditemukan`);
        }
        if ((mediaRaw || '').trim() && matchedMedia.length === 0) {
          warnings.push(`Baris ${lineNo}: media "${mediaRaw}" tidak ditemukan di library`);
        }

        await api.post('/posts', {
          title: title?.trim() || 'Bulk Post',
          caption: caption?.trim(),
          postType,
          accountIds,
          mediaIds: matchedMedia.map((m) => m.id),
          scheduledAt: scheduledAt
            ? (fromLocalInputValue(scheduledAt)?.toISOString() ??
              (() => {
                const d = new Date(scheduledAt);
                return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
              })())
            : undefined,
          action: scheduledAt ? 'schedule' : 'draft',
        });
        imported++;
      }
      const warnMsg = warnings.length ? ` (${warnings.length} peringatan)` : '';
      toast.success(`Berhasil mengimpor ${imported} postingan${warnMsg}`, warnings.slice(0, 5).join('\n'));
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
        accept=".csv,.txt,.xlsx,.xls"
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
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<Upload className="h-4 w-4" />}
              loading={uploadingCsv}
              onClick={() => csvRef.current?.click()}
            >
              Import CSV/Excel
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
            <Link to="/app/posts/new" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto" icon={<Plus className="h-4 w-4" />}>Buat Postingan</Button>
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
              const dayPosts = posts.filter((p) => {
                if (!p.scheduledAt) return false;
                const localDate = new Date(p.scheduledAt).toLocaleDateString('en-CA', {
                  timeZone: getActiveTimezone(),
                });
                return localDate === dateStr;
              });
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
                          className={cn('cursor-pointer truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white', meta.className.includes('amber') ? 'bg-amber-500' : meta.className.includes('emerald') ? 'bg-emerald-500' : meta.className.includes('orange') ? 'bg-orange-500' : 'bg-brand-600')}
                          title={postTitle(p)}
                        >
                          {postTitle(p)}
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
                    {postTitle(post)}
                  </p>
                  {post.title && post.caption && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {post.caption}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span>Dibuat {formatDateTime(post.createdAt)}</span>
                    {post.scheduledAt && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Jadwal {formatDate(post.scheduledAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
