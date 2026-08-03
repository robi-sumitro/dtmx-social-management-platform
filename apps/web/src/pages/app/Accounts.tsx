import { useState } from 'react';
import {
  Share2,
  Plus,
  Trash2,
  RefreshCw,
  Facebook,
  Instagram,
  Youtube,
  Globe,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api } from '@/lib/api';
import type { SocialAccount, UsageResponse } from '@/lib/types';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { PageHeader, PlatformIcon } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

const PROVIDERS = [
  { value: 'facebook', label: 'Facebook', icon: Facebook, desc: 'Halaman Facebook' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, desc: 'Akun Instagram' },
  { value: 'youtube', label: 'YouTube', icon: Youtube, desc: 'Channel YouTube' },
  { value: 'tiktok', label: 'TikTok', icon: Globe, desc: 'Akun TikTok' },
];

const ACCOUNT_TYPES: Record<string, { value: string; label: string }[]> = {
  facebook: [{ value: 'facebook_page', label: 'Halaman Facebook' }],
  instagram: [{ value: 'instagram', label: 'Akun Instagram' }],
  youtube: [{ value: 'youtube_channel', label: 'Channel YouTube' }],
  tiktok: [{ value: 'tiktok_account', label: 'Akun TikTok' }],
};

export function Accounts() {
  const toast = useToast();
  const [connectOpen, setConnectOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SocialAccount | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data, loading, refetch } = useFetch<SocialAccount[]>(() => api.get('/social-accounts'));
  const usage = useFetch<UsageResponse>(() => api.get('/subscriptions/usage'));

  const accounts = data ?? [];
  const activeCount = accounts.filter((a) => a.isActive).length;
  const limit = usage.data?.limits.accounts ?? 1;
  const canConnect = activeCount < limit;

  const [form, setForm] = useState({
    provider: 'facebook',
    accountName: '',
    platformId: '',
    accessToken: '',
    instagramId: '',
    avatarUrl: '',
    followersCount: '',
    tokenExpiresAt: '',
  });

  const resetForm = () =>
    setForm({ provider: 'facebook', accountName: '', platformId: '', accessToken: '', instagramId: '', avatarUrl: '', followersCount: '', tokenExpiresAt: '' });

  const openConnect = () => {
    resetForm();
    setConnectOpen(true);
  };

  const connect = async () => {
    if (!form.accountName.trim() || !form.platformId.trim()) {
      toast.warning('Lengkapi data', 'Nama akun dan ID platform wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const acc = await api.post<SocialAccount>('/social-accounts/connect', {
        provider: form.provider,
        accountType: ACCOUNT_TYPES[form.provider]?.[0]?.value ?? form.provider,
        accountName: form.accountName,
        platformId: form.platformId,
        accessToken: form.accessToken || undefined,
        instagramId: form.instagramId || undefined,
        avatarUrl: form.avatarUrl || undefined,
        followersCount: form.followersCount ? Number(form.followersCount) : undefined,
        tokenExpiresAt: form.tokenExpiresAt || undefined,
      });
      toast.success('Akun terhubung', `${acc.accountName} berhasil ditambahkan.`);
      setConnectOpen(false);
      refetch();
      usage.refetch();
    } catch (err) {
      toast.error('Gagal menghubungkan', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!deleteTarget) return;
    await api.delete(`/social-accounts/${deleteTarget.id}`);
    toast.success('Akun diputuskan');
    refetch();
    usage.refetch();
  };

  const refreshTokens = async () => {
    setRefreshing(true);
    try {
      await api.patch('/social-accounts/refresh');
      toast.success('Token disegarkan', 'Semua akun telah disinkronkan.');
      refetch();
    } catch (err) {
      toast.error('Gagal menyegarkan', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Akun Sosial"
        description="Hubungkan dan kelola semua platform sosial media kamu."
        action={
          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={() => void refreshTokens()} loading={refreshing} icon={!refreshing ? <RefreshCw className="h-4 w-4" /> : undefined}>
              Segarkan Token
            </Button>
            <Button onClick={openConnect} icon={<Plus className="h-4 w-4" />} disabled={!canConnect}>
              Hubungkan Akun
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Share2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {activeCount} dari {limit} akun terhubung
              </p>
              <p className="text-xs text-slate-400">Sesuai paket kamu saat ini</p>
            </div>
          </div>
          {!canConnect && (
            <Badge className="bg-amber-50 text-amber-700 ring-amber-200">
              <AlertTriangle className="h-3 w-3" /> Batas paket tercapai — upgrade untuk menambah
            </Badge>
          )}
        </div>
      </Card>

      {loading ? (
        <PageLoader label="Memuat akun..." />
      ) : accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Share2 className="h-6 w-6" />}
            title="Belum ada akun terhubung"
            description="Hubungkan Facebook, Instagram, YouTube, atau TikTok untuk mulai mengelola."
            action={
              <Button onClick={openConnect} icon={<Plus className="h-4 w-4" />}>
                Hubungkan Akun Pertama
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((acc) => (
            <Card key={acc.id} className={cn('p-5 transition hover:shadow-cardHover', !acc.isActive && 'opacity-60')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                    <PlatformIcon provider={acc.provider} size="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{acc.accountName}</p>
                    <p className="text-xs capitalize text-slate-400">{acc.accountType.replaceAll('_', ' ')}</p>
                  </div>
                </div>
                <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', acc.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', acc.isActive ? 'bg-emerald-500' : 'bg-slate-400')} />
                  {acc.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[11px] text-slate-400">Followers</p>
                  <p className="font-semibold text-slate-800">{formatNumber(acc.followersCount ?? 0)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[11px] text-slate-400">Terhubung</p>
                  <p className="font-semibold text-slate-800">{formatDate(acc.createdAt)}</p>
                </div>
              </div>

              {acc.tokenExpiresAt && (
                <p className="mt-3 text-xs text-slate-400">
                  Token kedaluwarsa: {formatDate(acc.tokenExpiresAt)}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">ID: {acc.platformId.slice(0, 12)}...</span>
                {acc.isActive && (
                  <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => setDeleteTarget(acc)} icon={<Trash2 className="h-4 w-4" />}>
                    Putuskan
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        title="Hubungkan Akun Sosial"
        description="Isi kredensial akun yang ingin dihubungkan."
        size="lg"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setConnectOpen(false)}>Batal</Button>
            <Button onClick={() => void connect()} loading={saving}>
              <Check className="h-4 w-4" />
              Hubungkan
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Pilih Platform</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setForm((f) => ({ ...f, provider: p.value }))}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border p-4 transition',
                    form.provider === p.value ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-200' : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <p.icon className={cn('h-6 w-6', p.value === 'facebook' ? 'text-[#1877F2]' : p.value === 'instagram' ? 'text-[#E4405F]' : p.value === 'youtube' ? 'text-[#FF0000]' : 'text-slate-900')} />
                  <span className="text-xs font-semibold text-slate-800">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nama Akun" placeholder="Nama halaman / akun" value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} required />
            <Input label="ID Platform" placeholder="Page ID / user ID / channel ID" value={form.platformId} onChange={(e) => setForm((f) => ({ ...f, platformId: e.target.value }))} required />
            <Input label="Access Token" placeholder="Opsional" value={form.accessToken} onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))} />
            <Input label="Instagram ID" placeholder="Opsional" value={form.instagramId} onChange={(e) => setForm((f) => ({ ...f, instagramId: e.target.value }))} />
            <Input label="URL Avatar" placeholder="https://..." value={form.avatarUrl} onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))} />
            <Input label="Followers" type="number" placeholder="0" value={form.followersCount} onChange={(e) => setForm((f) => ({ ...f, followersCount: e.target.value }))} />
            <Input label="Kedaluwarsa Token" type="datetime-local" value={form.tokenExpiresAt} onChange={(e) => setForm((f) => ({ ...f, tokenExpiresAt: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        danger
        title="Putuskan akun ini?"
        description={`${deleteTarget?.accountName ?? 'Akun'} akan dinonaktifkan dari DtmX.`}
        confirmLabel="Putuskan"
        onConfirm={disconnect}
      />
    </div>
  );
}
