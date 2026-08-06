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
  const mediaInputRef = useRef<HTMLInputElement>(null);
  // User explicitly picked a post type → don't let auto-detect override it.
  const postTypeTouched = useRef(false);

  useEffect(() => {
    if (!post) return;
    setTitle(post.title ?? '');
    setCaption(post.caption ?? '');
    setHashtags(post.hashtags ?? '');
    setPostType(post.postType);
    setAccountIds((post.accounts ?? []).map((pa) => pa.accountId));
    setMediaIds((post.media ?? []).map((pm) => pm.mediaId));
    setScheduledAt(post.scheduledAt ? toLocalInputValue(post.scheduledAt) : '');
    // Keep the saved type for edits; auto-detect only applies to new posts.
    postTypeTouched.current = true;
  }, [post]);

  const activeAccounts = useMemo(() => (accounts ?? []).filter((a) => a.isActive), [accounts]);
  const mediaItems = media ?? [];
  const selectedMedia = mediaItems.filter((m) => mediaIds.includes(m.id));
  const totalLength = caption.length + hashtags.length;

  const selectedProviders = activeAccounts.filter((a) => accountIds.includes(a.id)).map((a) => a.provider);
  const allowedPostTypes = useMemo(() => {
    if (selectedProviders.length === 0) return ALL_POST_TYPES;
    const sets = selectedProviders.map((p) => PLATFORM_POST_TYPES[p] ?? ALL_POST_TYPES);
    return ALL_POST_TYPES.filter((t) => sets.every((s) => s.includes(t)));
  }, [selectedProviders]);

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

  const toggleAccount = (id: string) =>
    setAccountIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleMedia = (id: string) =>
    setMediaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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
          if (!thumb) continue;
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
      const res = await api.post<{ content: string }>('/ai/generate', {
        prompt: `Tulis caption postingan media sosial untuk prompt ini: "${aiPrompt}". Tambahkan juga saran hashtag. Bahasa: Indonesia.`,
        feature: 'content_writer',
      });
      setCaption(res.content ?? '');
      toast.success('Caption dibuat AI', 'Kamu bisa edit sebelum diposting.');
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
        <Link to="/app/posts" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800">
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
              <div className="flex gap-2.5">
                <Input
                  placeholder="Contoh: promo produk skincare untuk influencer..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void generateAI()}
                />
                <Button onClick={() => void generateAI()} loading={aiLoading} icon={!aiLoading ? <Sparkles className="h-4 w-4" /> : undefined}>
                  Generate
                </Button>
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
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Caption</label>
                  <span className={cn('text-xs font-medium', totalLength > 2200 ? 'text-rose-500' : 'text-slate-400')}>
                    {totalLength}/2200
                  </span>
                </div>
                <Textarea
                  rows={6}
                  placeholder="Tulis caption kamu di sini..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="resize-none"
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Hash className="h-4 w-4" />
                  Hashtags
                </label>
                <Input
                  placeholder="#skincare #beauty #review"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Jenis Konten"
                  value={postType}
                  onChange={(e) => {
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
                    onChange={(e) => setScheduledAt(e.target.value)}
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
                    const selected = mediaIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleMedia(m.id)}
                        className={cn(
                          'relative aspect-square overflow-hidden rounded-xl border-2 transition',
                          selected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-transparent hover:border-slate-200',
                        )}
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
                          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader icon={<Send className="h-4 w-4" />} title="Mockup Preview" description="Pratinjau tampilan konten sosial media" />
            <CardBody>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 font-bold text-white text-xs">
                    DX
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Akun DtmX</p>
                    <p className="text-[10px] text-slate-400">Baru saja · Publik</p>
                  </div>
                </div>
                {title && <p className="mb-2 text-sm font-bold text-slate-900">{title}</p>}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {caption || 'Tulis caption untuk melihat pratinjau...'}
                </p>
                {hashtags && <p className="mt-2 text-xs font-medium text-brand-600">{hashtags}</p>}

                {selectedMedia.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 overflow-hidden rounded-lg">
                    {selectedMedia.slice(0, 2).map((m) => (
                      <div key={m.id} className="relative aspect-video overflow-hidden rounded bg-slate-900">
                        {m.fileType === 'video' ? (
                          <video src={mediaUrl(m.filename)} className="h-full w-full object-cover" muted />
                        ) : (
                          <img src={mediaUrl(m.filename)} alt={m.originalName} className="h-full w-full object-cover" />
                        )}
                      </div>
                    ))}
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
