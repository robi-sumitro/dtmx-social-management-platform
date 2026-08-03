import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Share2,
  Plus,
  Trash2,
  RefreshCw,
  Facebook,
  Instagram,
  Youtube,
  Globe,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api } from '@/lib/api';
import type { SocialAccount, UsageResponse } from '@/lib/types';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { PageHeader, PlatformIcon } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
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

const OAUTH_META: Record<
  string,
  { brand: string; icon: typeof Facebook; desc: string }
> = {
  facebook: {
    brand: 'Facebook',
    icon: Facebook,
    desc: 'Kamu akan diarahkan ke Facebook untuk memilih halaman yang kamu kelola.',
  },
  instagram: {
    brand: 'Facebook',
    icon: Facebook,
    desc: 'Pilih halaman Facebook yang terhubung dengan akun Instagram (Business).',
  },
  youtube: {
    brand: 'Google',
    icon: Youtube,
    desc: 'Kamu akan diarahkan ke Google untuk memilih channel YouTube milikmu.',
  },
  tiktok: {
    brand: 'TikTok',
    icon: Globe,
    desc: 'Kamu akan diarahkan ke TikTok untuk mengotorisasi akun TikTok milikmu.',
  },
};

export function Accounts() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [connectOpen, setConnectOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SocialAccount | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState('facebook');

  const { data, loading, refetch } = useFetch<SocialAccount[]>(() => api.get('/social-accounts'));
  const usage = useFetch<UsageResponse>(() => api.get('/subscriptions/usage'));

  const accounts = data ?? [];
  const activeCount = accounts.filter((a) => a.isActive && !a.parentId).length;
  const limit = usage.data?.limits.accounts ?? 1;
  const canConnect = activeCount < limit;

  useEffect(() => {
    const connected = params.get('connected');
    const error = params.get('error');
    if (connected) {
      toast.success('Akun terhubung', `${connected} akun berhasil dihubungkan.`);
    }
    if (error) {
      toast.error('Gagal menghubungkan', error);
    }
    if (connected || error) {
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openConnect = () => {
    setProvider('facebook');
    setConnectOpen(true);
  };

  const oauthProvider = provider === 'instagram' ? 'facebook' : provider;
  const meta = OAUTH_META[provider] ?? OAUTH_META.facebook;

  const connectOAuth = async () => {
    setSaving(true);
    try {
      const { url } = await api.get<{ url: string }>(`/social-accounts/auth/${oauthProvider}/url`);
      window.location.assign(url);
    } catch (err) {
      toast.error('Gagal memulai OAuth', err instanceof Error ? err.message : 'Terjadi kesalahan');
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
      const res = await api.patch<{ refreshed: number; failed: number }>('/social-accounts/refresh');
      if (res.failed > 0) {
        toast.warning('Sebagian gagal disegarkan', `${res.refreshed} berhasil, ${res.failed} gagal. Hubungkan ulang akun yang gagal.`);
      } else {
        toast.success('Token disegarkan', 'Semua token berhasil diperbarui.');
      }
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
                {activeCount} dari {limit} slot akun terhubung
              </p>
              <p className="text-xs text-slate-400">Halaman Facebook + Instagram Business terhitung 1 slot</p>
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

              {acc.parentId && (
                <p className="mt-3 text-[11px] font-medium text-brand-600">
                  Terhubung via Halaman Facebook — tidak memakai slot tambahan
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
        description="Pilih platform, lalu hubungkan akunmu melalui OAuth resmi platform."
        size="lg"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setConnectOpen(false)}>Batal</Button>
            <Button onClick={() => void connectOAuth()} loading={saving} disabled={!canConnect}>
              <Lock className="h-4 w-4" />
              Hubungkan via {meta.brand}
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
                  onClick={() => setProvider(p.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border p-4 transition',
                    provider === p.value ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-200' : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <p.icon className={cn('h-6 w-6', p.value === 'facebook' ? 'text-[#1877F2]' : p.value === 'instagram' ? 'text-[#E4405F]' : p.value === 'youtube' ? 'text-[#FF0000]' : 'text-slate-900')} />
                  <span className="text-xs font-semibold text-slate-800">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                <Lock className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Hubungkan dengan {meta.brand}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{meta.desc}</p>
                {!canConnect && (
                  <p className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-600">
                    <AlertTriangle className="h-3 w-3" /> Batas paket tercapai — upgrade paket terlebih dahulu.
                  </p>
                )}
              </div>
            </div>
            <Button className="mt-3 w-full" onClick={() => void connectOAuth()} loading={saving} disabled={!canConnect}>
              <meta.icon className="h-4 w-4" />
              Lanjut ke {meta.brand}
            </Button>
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
