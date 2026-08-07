import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Send,
  CalendarClock,
  Save,
  Check,
  Image as ImageIcon,
  Loader2,
  Wand2,
  Hash,
  UploadCloud,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
  Info,
} from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api, mediaUrl } from '@/lib/api';
import type { Post, SocialAccount, MediaFile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toLocalInputValue, fromLocalInputValue } from '@/lib/timezone';
import { extractVideoThumbnail } from '@/lib/video';
import { PageHeader } from '@/components/shared/PageHeader';
import { PlatformIcon } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

const POST_TYPES = [
  { value: 'text', label: 'Teks' },
  { value: 'image', label: 'Gambar' },
  { value: 'video', label: 'Video' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'short_video', label: 'Video Pendek' },
];

const ALL_POST_TYPES = POST_TYPES.map((t) => t.value);

const PLATFORM_POST_TYPES: Record<string, string[]> = {
  facebook: ['text', 'image', 'video', 'carousel', 'short_video'],
  instagram: ['text', 'image', 'video', 'carousel', 'short_video'],
  youtube: ['video', 'short_video'],
  tiktok: ['text', 'image', 'video', 'short_video'],
};

/** Per-platform caption character limits (used for the live counter). */
const PLATFORM_CAPTION_LIMITS: Record<string, number> = {
  instagram: 2200,
  tiktok: 2200,
  facebook: 63206,
  youtube: 5000,
};
const DEFAULT_CAPTION_LIMIT = 2200;

/** How each platform's preview should look in the mockup. */
const PREVIEW_META: Record<
  string,
  { label: string; mediaClass: string; captionClamp: string; aspect: string }
> = {
  instagram: {
    label: 'Instagram',
    mediaClass: 'aspect-square',
    captionClamp: 'line-clamp-2',
    aspect: '4:5 feed',
  },
  facebook: {
    label: 'Facebook',
    mediaClass: 'aspect-video',
    captionClamp: 'line-clamp-3',
    aspect: '16:9 feed',
  },
  tiktok: {
    label: 'TikTok',
    mediaClass: 'aspect-[9/16]',
    captionClamp: 'line-clamp-2',
    aspect: '9:16 vertikal',
  },
  youtube: {
    label: 'YouTube',
    mediaClass: 'aspect-video',
    captionClamp: 'line-clamp-3',
    aspect: '16:9 video',
  },
};
const DEFAULT_PREVIEW = PREVIEW_META.instagram;

export function PostComposer() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id') || undefined;
  const isEditing = Boolean(editId);

  const { data: accounts } = useFetch<SocialAccount[]>(() => api.get('/social-accounts'));
  const { data: media } = useFetch<MediaFile[]>(() => api.get('/media'));
  const { data: post } = useFetch<Post | null>(
    () => (editId ? api.get<Post>(`/posts/${editId}`) : Promise.resolve(null)),
    [editId],
  );

  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [postType, setPostType] = useState('image');
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [action, setAction] = useState<'draft' | 'schedule' | 'publish_now'>('draft');
  const [scheduledAt, setScheduledAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [dirty, setDirty] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  // User explicitly picked a post type → don't let auto-detect override it.
  const postTypeTouched = useRef(false);
  const initializing = useRef(false);
  const markDirty = () => {
    if (!initializing.current) setDirty(true);
  }; 

  // Warn before leaving with unsaved changes (refresh/close tab).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!post) return;
    initializing.current = true;
    setTitle(post.title ?? '');
    setCaption(post.caption ?? '');
    setHashtags(post.hashtags ?? '');
    setPostType(post.postType);
    setAccountIds((post.accounts ?? []).map((pa) => pa.accountId));
    setMediaIds((post.media ?? []).map((pm) => pm.mediaId));
    setScheduledAt(post.scheduledAt ? toLocalInputValue(post.scheduledAt) : '');
    // Keep the saved type for edits; auto-detect only applies to new posts.
    postTypeTouched.current = true;
    setDirty(false);
    initializing.current = false;
  }, [post]);

  const activeAccounts = useMemo(() => (accounts ?? []).filter((a) => a.isActive), [accounts]);
  const mediaItems = media ?? [];
  const selectedMedia = mediaItems.filter((m) => mediaIds.includes(m.id));
  // Media in explicit selection order (carousel ordering), not source-library order.
  const orderedSelectedMedia = useMemo(
    () => mediaIds.map((id) => mediaItems.find((m) => m.id === id)).filter((m): m is MediaFile => Boolean(m)),
    [mediaIds, mediaItems],
  );
  const totalLength = caption.length + hashtags.length;

  const selectedProviders = activeAccounts.filter((a) => accountIds.includes(a.id)).map((a) => a.provider);
  const allowedPostTypes = useMemo(() => {
    if (selectedProviders.length === 0) return ALL_POST_TYPES;
    const sets = selectedProviders.map((p) => PLATFORM_POST_TYPES[p] ?? ALL_POST_TYPES);
    return ALL_POST_TYPES.filter((t) => sets.every((s) => s.includes(t)));
  }, [selectedProviders]);

  // Strictest caption limit among the selected platforms (or default when none).
  const captionLimit = useMemo(() => {
    if (selectedProviders.length === 0) return DEFAULT_CAPTION_LIMIT;
    return Math.min(...selectedProviders.map((p) => PLATFORM_CAPTION_LIMITS[p] ?? DEFAULT_CAPTION_LIMIT));
  }, [selectedProviders]);
  const captionMeta = PREVIEW_META[selectedProviders[0]] ?? DEFAULT_PREVIEW;
  const captionOver = totalLength > captionLimit;

  useEffect(() => {
    if (allowedPostTypes.length > 0 && !allowedPostTypes.includes(postType)) {
      setPostType(allowedPostTypes[0]);
    }
  }, [allowedPostTypes, postType]);

  // Auto-detect post type from selected media when the user hasn't chosen one.
  useEffect(() => {
    if (postTypeTouched.current) return;
    const selected = mediaItems.filter((m) => mediaIds.includes(m.id));
    const hasVideo = selected.some((m) => m.fileType === 'video');
    const imageCount = selected.filter((m) => m.fileType === 'image').length;
    let guess: string | null = null;
    if (hasVideo) {
      guess = allowedPostTypes.includes('short_video')
        ? 'short_video'
        : allowedPostTypes.includes('video')
          ? 'video'
          : null;
    } else if (imageCount > 1) {
      guess = allowedPostTypes.includes('carousel') ? 'carousel' : null;
    } else if (imageCount === 1) {
      guess = allowedPostTypes.includes('image') ? 'image' : null;
    } else {
      guess = allowedPostTypes.includes('text') ? 'text' : null;
    }
    if (guess && guess !== postType) setPostType(guess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaIds, media, allowedPostTypes, postType]);

  const toggleAccount = (id: string) => {
    markDirty();
    setAccountIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleMedia = (id: string) => {
    markDirty();
    setMediaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Reorder the selected media list (carousel order) via index moves.
  const moveMedia = (from: number, to: number) => {
    markDirty();
    setMediaIds((prev) => {
      const arr = [...prev];
      if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return arr;
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };
  const removeMedia = (id: string) => {
    markDirty();
    setMediaIds((prev) => prev.filter((x) => x !== id));
  };

  const uploadMedia = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploadingMedia(true);
    try {
      const files = Array.from(list);
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      const uploaded = await api.upload<MediaFile[]>('/media/upload', formData);
      for (let i = 0; i < uploaded.length; i++) {
        const item = uploaded[i];
        if (item.fileType !== 'video') continue;
        const file = files[i];
        if (!file) continue;
        try {
          const thumb = await extractVideoThumbnail(file);
          if (!thumb) {
            // Browser couldn't frame the video — fall back to server ffmpeg so
            // the thumbnail is attached automatically.
            try {
              await api.post(`/media/${item.id}/thumbnail`);
            } catch {
              /* no server ffmpeg either */
            }
            continue;
          }
          const thumbData = new FormData();
          thumbData.append('thumbnail', thumb, 'thumb.jpg');
          await api.upload(`/media/${item.id}/thumbnail-upload`, thumbData);
        } catch {
          /* thumbnail is optional */
        }
      }
      setMediaIds((prev) => {
        const next = [...prev];
        uploaded.forEach((m) => {
          if (!next.includes(m.id)) next.push(m.id);
        });
        return next;
      });
      toast.success('Media diunggah', `${uploaded.length} file ditambahkan ke postingan.`);
    } catch (err) {
      toast.error('Gagal unggah media', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setUploadingMedia(false);
    }
  };

  const generateAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const context =
        selectedMedia.length > 0
          ? `Konten media: ${selectedMedia.map((m) => (m.fileType === 'video' ? 'video' : 'gambar')).join(', ')} (${selectedMedia.length} item, format ${postType}).`
          : `Tipe konten: ${postType}.`;
      const res = await api.post<{ content: string }>('/ai/generate', {
        prompt: `Tulis caption postingan media sosial untuk prompt ini: "${aiPrompt}". ${context} Tambahkan juga saran hashtag. Bahasa: Indonesia.`,
        feature: 'content_writer',
      });
      setCaption(res.content ?? '');
      markDirty();
      toast.success('Caption dibuat AI', 'Kamu bisa edit sebelum diposting.');
    } catch (err) {
      toast.error('Gagal generate AI', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setAiLoading(false);
    }
  };

  const generateHashtags = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await api.post<{ content: string }>('/ai/generate', {
        prompt: `Buatkan 5-10 hashtag populer dan relevan untuk prompt konten ini: "${aiPrompt}". Jawab hanya daftar hashtag dipisah spasi. Bahasa: Indonesia.`,
        feature: 'content_writer',
      });
      const tags = (res.content ?? '')
        .split(/\s+/)
        .filter((t) => t.startsWith('#'))
        .slice(0, 12)
        .join(' ');
      setHashtags(tags || '');
      markDirty();
      toast.success('Hashtag dibuat AI', 'Hashtag disarankan, kamu bisa edit.');
    } catch (err) {
      toast.error('Gagal generate AI', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async (actionValue: 'draft' | 'schedule' | 'publish_now') => {
    if (!caption.trim() && postType === 'text') {
      toast.warning('Caption kosong', 'Tulis caption atau gunakan AI untuk membantu.');
      return;
    }
    if (actionValue !== 'draft' && accountIds.length === 0) {
      toast.warning('Pilih akun tujuan', 'Pilih minimal satu akun untuk diposting.');
      return;
    }
    if (actionValue === 'schedule' && !scheduledAt) {
      toast.warning('Pilih waktu jadwal', 'Tentukan tanggal dan jam untuk penjadwalan.');
      return;
    }
    if (actionValue !== 'draft') {
      if (postType === 'carousel' && orderedSelectedMedia.filter((m) => m.fileType === 'image').length < 2) {
        toast.warning('Carousel butuh minimal 2 gambar', 'Pilih minimal dua gambar untuk postingan carousel.');
        return;
      }
      if ((postType === 'video' || postType === 'short_video') && !orderedSelectedMedia.some((m) => m.fileType === 'video')) {
        toast.warning('Butuh video', 'Jenis konten video memerlukan minimal satu video yang dipilih.');
        return;
      }
      if (captionOver && actionValue === 'publish_now') {
        toast.warning('Caption terlalu panjang', `Caption+hashtag melebihi batas ${captionLimit} karakter untuk platform yang dipilih.`);
        return;
      }
    }
    setBusy(true);
    setAction(actionValue);
    try {
      const payload = {
        title,
        caption,
        hashtags,
        postType,
        accountIds,
        mediaIds,
        scheduledAt: fromLocalInputValue(scheduledAt)?.toISOString(),
        action: actionValue,
      };
      if (isEditing && editId) {
        await api.patch(`/posts/${editId}`, payload);
      } else {
        await api.post('/posts', payload);
      }
      setDirty(false);
      toast.success(
        actionValue === 'draft' ? 'Draft tersimpan' : actionValue === 'schedule' ? 'Postingan terjadwal' : 'Postingan dipublikasikan',
        actionValue === 'publish_now' ? 'Sedang dikirim ke platform.' : undefined,
      );
      navigate('/app/posts');
    } catch (err) {
      toast.error('Gagal menyimpan postingan', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Link
          to="/app/posts"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
          onClick={(e) => {
            if (dirty && !window.confirm('Ada perubahan yang belum disimpan. Yakin ingin keluar?')) {
              e.preventDefault();
            }
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Postingan
        </Link>
        <PageHeader
          title={isEditing ? 'Edit Postingan' : 'Buat Postingan'}
          description={isEditing ? 'Perbarui konten, akun tujuan, dan jadwal penerbitan.' : 'Tulis konten, pilih akun tujuan, dan jadwalkan penerbitan.'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader
              icon={<Wand2 className="h-4 w-4" />}
              title="Asisten AI"
              description="Tulis ide, AI akan menyusun caption lengkap dengan hashtag."
            />
            <CardBody>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Input
                  placeholder="Contoh: promo produk skincare untuk influencer..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void generateAI()}
                />
                <div className="flex gap-2.5">
                  <Button
                    onClick={() => void generateAI()}
                    loading={aiLoading}
                    icon={!aiLoading ? <Sparkles className="h-4 w-4" /> : undefined}
                  >
                    Caption
                  </Button>
                  <Button variant="secondary" onClick={() => void generateHashtags()} disabled={aiLoading} icon={!aiLoading ? <Hash className="h-4 w-4" /> : undefined}>
                    Hashtag
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Send className="h-4 w-4" />} title="Konten" />
            <CardBody className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Judul Postingan (Opsional)</label>
                <Input
                  placeholder="Judul postingan..."
                  value={title}
                  onChange={(e) => {
                    markDirty();
                    setTitle(e.target.value);
                  }}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Caption</label>
                  <span className={cn('text-xs font-medium', captionOver ? 'text-rose-500' : 'text-slate-400')}>
                    {totalLength}/{captionLimit}
                  </span>
                </div>
                <Textarea
                  rows={6}
                  placeholder="Tulis caption kamu di sini..."
                  value={caption}
                  onChange={(e) => {
                    markDirty();
                    setCaption(e.target.value);
                  }}
                  className="resize-none"
                />
                {captionOver && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-500">
                    <Info className="h-3.5 w-3.5" />
                    Melebihi batas {captionLimit} karakter untuk {selectedProviders.join(', ') || 'platform'} yang dipilih.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Hash className="h-4 w-4" />
                  Hashtags
                </label>
                <Input
                  placeholder="#skincare #beauty #review"
                  value={hashtags}
                  onChange={(e) => {
                    markDirty();
                    setHashtags(e.target.value);
                  }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Jenis Konten"
                  value={postType}
                  onChange={(e) => {
                    markDirty();
                    postTypeTouched.current = true;
                    setPostType(e.target.value);
                  }}
                  hint={selectedProviders.length === 0 ? 'Pilih akun tujuan untuk menampilkan jenis konten yang didukung.' : undefined}
                >
                  {POST_TYPES.filter((t) => allowedPostTypes.includes(t.value)).map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Jadwal Terbit</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => {
                      markDirty();
                      setScheduledAt(e.target.value);
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={<ImageIcon className="h-4 w-4" />}
              title="Media"
              description={selectedMedia.length ? `${selectedMedia.length} dipilih` : 'Pilih dari media library'}
              action={
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => mediaInputRef.current?.click()}
                    loading={uploadingMedia}
                    icon={!uploadingMedia ? <UploadCloud className="h-4 w-4" /> : undefined}
                  >
                    Unggah
                  </Button>
                  <Link to="/app/media" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                    Kelola Library
                  </Link>
                </div>
              }
            />
            <CardBody>
              <input
                ref={mediaInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  void uploadMedia(e.target.files);
                  e.target.value = '';
                }}
              />
              {mediaItems.length === 0 ? (
                <EmptyState
                  icon={<ImageIcon className="h-6 w-6" />}
                  title="Media library kosong"
                  description="Unggah gambar atau video sekarang agar bisa disisipkan ke postingan."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => mediaInputRef.current?.click()}>
                      Unggah Media
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {mediaItems.map((m) => {
                    const selIndex = mediaIds.indexOf(m.id);
                    const selected = selIndex >= 0;
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleMedia(m.id)}
                        className={cn(
                          'relative aspect-square overflow-hidden rounded-xl border-2 transition',
                          selected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-transparent hover:border-slate-200',
                        )}
                        title={selected ? 'Klik untuk hapus dari postingan' : 'Pilih media'}
                      >
                        {m.fileType === 'video' ? (
                          <video
                            src={mediaUrl(m.filename)}
                            className="h-full w-full object-cover"
                            muted
                            preload="metadata"
                            onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 1; }}
                          />
                        ) : (
                          <img src={mediaUrl(m.filename)} alt={m.originalName} className="h-full w-full object-cover" loading="lazy" />
                        )}
                        {selected && (
                          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow">
                            {selIndex + 1}
                          </span>
                        )}
                        {selected && (
                          <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow">
                            <Trash2 className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {orderedSelectedMedia.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-semibold text-slate-500">
                    Urutan tampil ({orderedSelectedMedia.length})
                    {postType === 'carousel' ? ' — urutkan untuk carousel' : ''}
                  </p>
                  <div className="space-y-1.5">
                    {orderedSelectedMedia.map((m, idx) => (
                      <div
                        key={m.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(idx));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = Number(e.dataTransfer.getData('text/plain'));
                          if (Number.isInteger(from)) moveMedia(from, idx);
                        }}
                        className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2"
                      >
                        <span className="w-5 text-center text-xs font-bold text-slate-400">{idx + 1}</span>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
                          {m.fileType === 'video' ? (
                            <video src={mediaUrl(m.filename)} muted preload="metadata" className="h-full w-full object-cover" />
                          ) : (
                            <img src={mediaUrl(m.filename)} alt="" className="h-full w-full object-cover" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{m.originalName}</span>
                        <GripVertical className="h-4 w-4 text-slate-300" />
                        <Button size="xs" variant="ghost" disabled={idx === 0} onClick={() => moveMedia(idx, idx - 1)} icon={<ChevronUp className="h-3.5 w-3.5" />} aria-label="Naik" />
                        <Button size="xs" variant="ghost" disabled={idx === orderedSelectedMedia.length - 1} onClick={() => moveMedia(idx, idx + 1)} icon={<ChevronDown className="h-3.5 w-3.5" />} aria-label="Turun" />
                        <Button size="xs" variant="ghost" onClick={() => removeMedia(m.id)} icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />} aria-label="Hapus" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

<div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader icon={<Send className="h-4 w-4" />} title="Mockup Preview" description="Pratinjau tampilan konten sosial media" />
            <CardBody>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Platform {selectedProviders[0] ? captionMeta.label : '—'}</p>
                {selectedProviders[0] && <Badge className="bg-slate-100 text-slate-600 ring-slate-200">{captionMeta.aspect}</Badge>}
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-white text-xs">
                    <PlatformIcon provider={selectedProviders[0] ?? 'facebook'} size="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      {selectedMedia[0]?.originalName?.split('.')[0] || captionMeta.label}
                    </p>
                    <p className="text-[10px] text-slate-400">Baru saja · Publik</p>
                  </div>
                </div>
                <p className={cn('whitespace-pre-wrap text-sm leading-relaxed text-slate-800', captionMeta.captionClamp)}>
                  {caption || 'Tulis caption untuk melihat pratinjau...'}
                </p>
                {hashtags && <p className="mt-2 text-xs font-medium text-brand-600">{hashtags}</p>}

                {orderedSelectedMedia.length > 0 && (
                  <div className="mt-3">
                    <div className={cn('relative overflow-hidden rounded-lg bg-slate-900', captionMeta.mediaClass)}>
                      {orderedSelectedMedia[0].fileType === 'video' ? (
                        <video src={mediaUrl(orderedSelectedMedia[0].filename)} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={mediaUrl(orderedSelectedMedia[0].filename)} alt={orderedSelectedMedia[0].originalName} className="h-full w-full object-cover" />
                      )}
                      {orderedSelectedMedia.length > 1 && (
                        <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {orderedSelectedMedia.length} media
                        </span>
                      )}
                    </div>
                    {orderedSelectedMedia.length > 1 && (
                      <div className="mt-2 grid grid-cols-4 gap-1.5">
                        {orderedSelectedMedia.map((m, idx) => (
                          <button
                            key={m.id}
                            onClick={() => moveMedia(idx, 0)}
                            title={idx === 0 ? 'Media utama' : 'Jadikan media utama'}
                            className="relative aspect-square overflow-hidden rounded-md bg-slate-800"
                          >
                            {m.fileType === 'video' ? (
                              <video src={mediaUrl(m.filename)} muted preload="metadata" className="h-full w-full object-cover" />
                            ) : (
                              <img src={mediaUrl(m.filename)} alt="" className="h-full w-full object-cover" />
                            )}
                            <span className={cn('absolute left-1 top-1 rounded bg-black/50 px-1 text-[9px] font-bold text-white', idx === 0 && 'bg-brand-600')}>
                              {idx + 1}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Send className="h-4 w-4" />} title="Target Akun" description={activeAccounts.length ? `Pilih ${activeAccounts.length} akun yang tersedia` : 'Belum ada akun'} />
            <CardBody>
              {activeAccounts.length === 0 ? (
                <EmptyState
                  icon={<Send className="h-6 w-6" />}
                  title="Tidak ada akun"
                  description="Hubungkan akun sosial dulu agar bisa diposting."
                  action={
                    <Link to="/app/accounts">
                      <Button variant="secondary" size="sm">Hubungkan Akun</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {activeAccounts.map((acc) => {
                    const selected = accountIds.includes(acc.id);
                    return (
                      <button
                        key={acc.id}
                        onClick={() => toggleAccount(acc.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition',
                          selected ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-200' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                        )}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                          <PlatformIcon provider={acc.provider} size="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800">{acc.accountName}</span>
                          <span className="block text-xs text-slate-400">
                            {acc.followersCount ? `${acc.followersCount.toLocaleString('id-ID')} followers` : acc.accountType}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full border-2 transition',
                            selected ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300',
                          )}
                        >
                          {selected && <Check className="h-4 w-4" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="sticky bottom-4">
            <CardBody className="space-y-3">
              <Button
                fullWidth
                size="lg"
                variant="secondary"
                onClick={() => void submit('draft')}
                loading={busy && action === 'draft'}
                icon={!busy ? <Save className="h-4 w-4" /> : undefined}
              >
                Simpan Draft
              </Button>
              <Button
                fullWidth
                size="lg"
                variant="dark"
                onClick={() => void submit('schedule')}
                loading={busy && action === 'schedule'}
                icon={!busy ? <CalendarClock className="h-4 w-4" /> : undefined}
              >
                Jadwalkan
              </Button>
              <Button
                fullWidth
                size="lg"
                onClick={() => void submit('publish_now')}
                loading={busy && action === 'publish_now'}
                icon={!busy ? <Send className="h-4 w-4" /> : undefined}
              >
                Publish Sekarang
              </Button>
              {busy && (
                <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menyimpan postingan...
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Tips" />
            <CardBody className="space-y-3 text-sm text-slate-500">
              <div className="flex gap-2.5">
                <Badge className="bg-brand-50 text-brand-600 ring-brand-200">💡</Badge>
                <p>Posting dengan gambar mendapat engagement 2x lebih tinggi.</p>
              </div>
              <div className="flex gap-2.5">
                <Badge className="bg-brand-50 text-brand-600 ring-brand-200">⏰</Badge>
                <p>Jadwalkan saat audiens aktif untuk hasil terbaik.</p>
              </div>
              <div className="flex gap-2.5">
                <Badge className="bg-brand-50 text-brand-600 ring-brand-200">✨</Badge>
                <p>Gunakan AI untuk memperkaya caption dan hashtag.</p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
