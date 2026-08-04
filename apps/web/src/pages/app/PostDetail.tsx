import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  Trash2,
  Ban,
  Pencil,
  Hash,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Send,
  Eye,
} from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api, mediaUrl } from '@/lib/api';
import type { Post } from '@/lib/types';
import { cn, formatDateTime, formatDate, postStatusMeta, timeAgo } from '@/lib/utils';
import { PageHeader, PlatformIcon, ErrorPanel } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

export function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: post, error, loading, refetch } = useFetch<Post>(
    () => api.get(`/posts/${id}`),
    [id],
  );

  const handleDelete = async () => {
    if (!post) return;
    try {
      await api.delete(`/posts/${post.id}`);
      toast.success('Postingan dihapus');
      navigate('/app/posts');
    } catch (err) {
      toast.error('Gagal menghapus', err instanceof Error ? err.message : 'Terjadi kesalahan');
    }
  };

  const handleCancel = async () => {
    if (!post) return;
    try {
      await api.post(`/posts/${post.id}/cancel`);
      toast.success('Postingan dibatalkan');
      setCancelOpen(false);
      refetch();
    } catch (err) {
      toast.error('Gagal membatalkan', err instanceof Error ? err.message : 'Terjadi kesalahan');
    }
  };

  if (loading) return <PageLoader label="Memuat detail postingan..." />;
  if (error || !post) {
    return (
      <div className="animate-fade-in">
        <Link to="/app/posts" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Postingan
        </Link>
        <ErrorPanel message={error ?? 'Postingan tidak ditemukan'} onRetry={refetch} />
      </div>
    );
  }

  const meta = postStatusMeta(post.status);
  const editable = ['draft', 'scheduled', 'failed', 'paused'].includes(post.status);

  return (
    <div className="animate-fade-in">
      <Link to="/app/posts" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Postingan
      </Link>

      <PageHeader
        title={post.caption || post.title || 'Tanpa caption'}
        description={post.title && post.title !== post.caption ? post.title : undefined}
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            {editable && (
              <Link to={`/app/posts/new?id=${post.id}`}>
                <Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>Edit</Button>
              </Link>
            )}
            {post.status === 'scheduled' && (
              <Button variant="secondary" className="text-slate-500" onClick={() => setCancelOpen(true)} icon={<Ban className="h-4 w-4" />}>
                Batalkan Jadwal
              </Button>
            )}
            <Button variant="danger" onClick={() => setDeleteOpen(true)} icon={<Trash2 className="h-4 w-4" />}>
              Hapus
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              icon={<FileText className="h-4 w-4" />}
              title="Konten"
              action={<Badge className={meta.className} dot={meta.dot}>{meta.label}</Badge>}
            />
            <CardBody className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Caption</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{post.caption || '—'}</p>
              </div>

              {post.hashtags && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <Hash className="h-3.5 w-3.5" /> Hashtags
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.hashtags.split(/[\s,]+/).filter(Boolean).map((tag) => (
                      <span key={tag} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {post.overrides && Object.keys(post.overrides as object).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Overrides Platform</p>
                  <pre className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
                    {JSON.stringify(post.overrides, null, 2)}
                  </pre>
                </div>
              )}
            </CardBody>
          </Card>

          {(post.media ?? []).length > 0 && (
            <Card>
              <CardHeader icon={<Eye className="h-4 w-4" />} title="Media" description={`${post.media!.length} file terlampir`} />
              <CardBody>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {post.media!.map((pm) => {
                    const file = pm.media;
                    if (!file) return null;
                    return file.fileType === 'video' ? (
                      <div key={pm.id} className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
                        <video
                          src={mediaUrl(file.filename)}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                          onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 1; }}
                        />
                      </div>
                    ) : (
                      <img
                        key={pm.id}
                        src={mediaUrl(file.filename)}
                        alt={file.originalName}
                        className="aspect-video w-full rounded-xl object-cover"
                        loading="lazy"
                      />
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader icon={<Send className="h-4 w-4" />} title="Target Akun" description={`${(post.accounts ?? []).length} akun`} />
            <CardBody className="space-y-2.5">
              {(post.accounts ?? []).length === 0 ? (
                <p className="text-sm text-slate-400">Belum ada akun tujuan.</p>
              ) : (
                (post.accounts ?? []).map((pa) => (
                  <div key={pa.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                      <PlatformIcon provider={pa.account?.provider ?? ''} size="h-4.5 w-4.5 h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{pa.account?.accountName ?? 'Akun'}</p>
                      <p className="text-xs capitalize text-slate-400">{pa.account?.provider ?? ''}</p>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Clock className="h-4 w-4" />} title="Info Postingan" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Jenis Konten</span>
                <span className="font-medium capitalize text-slate-800">{post.postType.replaceAll('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Platform</span>
                <span className="font-medium capitalize text-slate-800">{post.platform || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Dibuat</span>
                <span className="font-medium text-slate-800">{formatDateTime(post.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Diperbarui</span>
                <span className="font-medium text-slate-800">{timeAgo(post.updatedAt)}</span>
              </div>
              {post.scheduledAt && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <CalendarClock className="h-4 w-4" /> Jadwal
                  </span>
                  <span className="font-medium text-slate-800">{formatDate(post.scheduledAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
              {post.publishedAt && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Terbit
                  </span>
                  <span className="font-medium text-slate-800">{formatDateTime(post.publishedAt)}</span>
                </div>
              )}
              {post.retryCount != null && post.retryCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Percobaan</span>
                  <span className="font-medium text-slate-800">{post.retryCount}x</span>
                </div>
              )}
            </CardBody>
          </Card>

          {post.errorMessage && (
            <div className={cn('flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-sm text-rose-700')}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Terjadi kesalahan</p>
                <p className="mt-1 text-xs leading-relaxed">{post.errorMessage}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        danger
        title="Hapus postingan?"
        description="Postingan akan dihapus permanen dan tidak bisa dikembalikan."
        confirmLabel="Ya, Hapus"
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Batalkan postingan?"
        description="Postingan yang terjadwal akan dibatalkan dan tidak akan diterbitkan."
        confirmLabel="Batalkan"
        onConfirm={handleCancel}
      />
    </div>
  );
}
