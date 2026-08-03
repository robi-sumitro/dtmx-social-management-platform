import { useRef, useState } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Film,
  FileText,
  Link2,
  Copy,
  Check,
} from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api, mediaUrl } from '@/lib/api';
import type { MediaFile } from '@/lib/types';
import { cn, formatBytes, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

function MediaPreview({ file }: { file: MediaFile }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = mediaUrl(file.filename);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <>
      <Card className="group overflow-hidden">
        <button className="block w-full" onClick={() => setPreviewOpen(true)}>
          {file.fileType === 'video' ? (
            <div className="flex h-40 items-center justify-center bg-slate-900">
              <Film className="h-10 w-10 text-slate-500" />
            </div>
          ) : file.fileType === 'text' ? (
            <div className="flex h-40 items-center justify-center bg-brand-gradient-soft">
              <FileText className="h-10 w-10 text-brand-400" />
            </div>
          ) : (
            <img src={url} alt={file.originalName} className="h-40 w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
          )}
        </button>
        <div className="p-4">
          <p className="truncate text-sm font-medium text-slate-800" title={file.originalName}>
            {file.originalName}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {formatBytes(file.fileSize)} · {formatDate(file.createdAt)}
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <Button size="xs" variant="ghost" onClick={copyUrl} icon={copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}>
              {copied ? 'Tersalin' : 'Salin URL'}
            </Button>
          </div>
        </div>
      </Card>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} size="lg">
        <div className="flex flex-col items-center">
          {file.fileType === 'video' ? (
            <video src={url} controls className="max-h-[60vh] w-full rounded-xl" />
          ) : (
            <img src={url} alt={file.originalName} className="max-h-[60vh] w-full rounded-xl object-contain" />
          )}
          <div className="mt-4 flex w-full items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{file.originalName}</p>
              <p className="text-xs text-slate-400">{formatBytes(file.fileSize)} · {formatDate(file.createdAt)}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={copyUrl} icon={copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}>
              {copied ? 'Tersalin' : 'Salin URL'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function Media() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);

  const { data, loading, refetch } = useFetch<MediaFile[]>(() => api.get('/media'));
  const files = data ?? [];

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(list).forEach((f) => formData.append('files', f));
      const res = await api.upload<MediaFile[]>('/media/upload', formData);
      toast.success('Upload berhasil', `${res.length} file ditambahkan ke library.`);
      refetch();
    } catch (err) {
      toast.error('Upload gagal', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.delete(`/media/${deleteTarget.id}`);
    toast.success('Media dihapus');
    refetch();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Media Library"
        description="Simpan dan atur semua aset visual untuk konten kamu."
        action={
          <Button onClick={() => fileInputRef.current?.click()} icon={<UploadCloud className="h-4 w-4" />} loading={uploading}>
            Unggah Media
          </Button>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void upload(e.dataTransfer.files);
        }}
        className={cn(
          'mb-6 rounded-2xl border-2 border-dashed p-8 text-center transition',
          dragOver ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 bg-white hover:border-brand-300',
        )}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          {dragOver ? 'Lepaskan file di sini' : 'Seret & lepas file ke sini, atau'}
          <button onClick={() => fileInputRef.current?.click()} className="ml-1 text-brand-600 hover:underline">
            pilih file
          </button>
        </p>
        <p className="mt-1 text-xs text-slate-400">Gambar & video · JPG, PNG, WEBP, GIF, MP4, WEBM</p>
      </div>

      {loading ? (
        <PageLoader label="Memuat media..." />
      ) : files.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ImageIcon className="h-6 w-6" />}
            title="Media library kosong"
            description="Unggah gambar atau video pertama kamu untuk mulai membuat konten."
            action={
              <Button onClick={() => fileInputRef.current?.click()} icon={<UploadCloud className="h-4 w-4" />}>
                Unggah Media
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {files.map((file) => (
            <div key={file.id} className="relative group">
              <MediaPreview file={file} />
              <button
                onClick={() => setDeleteTarget(file)}
                className="absolute right-2.5 top-2.5 rounded-lg bg-white/90 p-2 text-rose-500 opacity-0 shadow-sm transition hover:bg-rose-50 group-hover:opacity-100"
                aria-label="Hapus media"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        danger
        title="Hapus media?"
        description="Media ini akan dihapus dari library. Postingan yang memakainya tidak terpengaruh."
        confirmLabel="Ya, Hapus"
        onConfirm={handleDelete}
      />
    </div>
  );
}
