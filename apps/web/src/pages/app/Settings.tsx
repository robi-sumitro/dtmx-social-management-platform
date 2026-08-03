import { useRef, useState } from 'react';
import { User as UserIcon, Lock, KeyRound, Camera, LogOut, Save, ShieldCheck, Facebook, Check, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, mediaUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { User, MediaFile } from '@/lib/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '@/lib/useApi';

interface OAuthConfig {
  appBaseUrl: string;
  frontendUrl: string;
  google: { configured: boolean; callbackUrl: string };
  facebook: { configured: boolean; callbackUrl: string };
}

export function Settings() {
  const { user, updateUser, logout, refreshProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const avatarRef = useRef<HTMLInputElement>(null);
  const oauth = useFetch<OAuthConfig>(() => api.get('/auth/callback-urls'));

  const [profile, setProfile] = useState({ fullName: user?.fullName ?? '', username: user?.username ?? '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  const handleAvatarChange = async (file: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('files', file);
      const uploaded = await api.upload<MediaFile[]>('/media/upload', formData);
      const avatarFile = uploaded?.[0];
      const avatarUrl = avatarFile ? mediaUrl(avatarFile.filename) : '';
      if (!avatarUrl) throw new Error('URL avatar tidak ditemukan');
      const updated = await api.patch<User>('/users/me', { avatar: avatarUrl });
      updateUser(updated);
      toast.success('Avatar diperbarui');
      await refreshProfile();
    } catch (err) {
      toast.error('Gagal unggah avatar', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const updated = await api.patch<User>('/users/me', {
        fullName: profile.fullName || undefined,
        username: profile.username || undefined,
      });
      updateUser(updated);
      toast.success('Profil diperbarui');
      await refreshProfile();
    } catch (err) {
      toast.error('Gagal memperbarui profil', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    const errors: Record<string, string> = {};
    if (pw.next.length < 8) errors.next = 'Password baru minimal 8 karakter';
    if (pw.confirm !== pw.next) errors.confirm = 'Konfirmasi password tidak cocok';
    setPwErrors(errors);
    if (Object.keys(errors).length) return;

    setSavingPw(true);
    try {
      await api.patch('/users/me/password', { current: pw.current, next: pw.next });
      toast.success('Password berhasil diganti');
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error('Gagal mengganti password', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <PageHeader title="Pengaturan" description="Kelola profil dan keamanan akun kamu." />

      <input
        ref={avatarRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          void handleAvatarChange(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />

      <Card className="mb-6">
        <CardHeader icon={<UserIcon className="h-4 w-4" />} title="Profil" />
        <CardBody className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar name={user?.fullName || user?.username || user?.email} src={user?.avatar} size="lg" />
              <button
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-2 ring-white transition hover:bg-brand-500 disabled:opacity-60"
                onClick={() => avatarRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Ubah avatar"
              >
                <Camera className={cn('h-4 w-4', uploadingAvatar && 'animate-pulse')} />
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{user?.fullName || user?.username || 'Pengguna'}</p>
              <p className="text-sm text-slate-400">{user?.email}</p>
              <div className="mt-1.5">
                <Badge className={user?.role === 'admin' ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}>
                  {user?.role === 'admin' ? 'Administrator' : 'Member'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nama Lengkap" value={profile.fullName} onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))} />
            <Input label="Username" value={profile.username} onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))} />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void saveProfile()} loading={savingProfile} icon={!savingProfile ? <Save className="h-4 w-4" /> : undefined}>
              Simpan Profil
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader icon={<Lock className="h-4 w-4" />} title="Ubah Password" description="Gunakan password kuat dan jangan bagikan ke siapa pun." />
        <CardBody className="space-y-4">
          <Input
            label="Password Saat Ini"
            type="password"
            placeholder="••••••••"
            icon={<KeyRound className="h-4 w-4" />}
            value={pw.current}
            onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Password Baru"
              type="password"
              placeholder="Minimal 8 karakter"
              icon={<Lock className="h-4 w-4" />}
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              error={pwErrors.next}
            />
            <Input
              label="Konfirmasi Password"
              type="password"
              placeholder="Ulangi password"
              icon={<Lock className="h-4 w-4" />}
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              error={pwErrors.confirm}
            />
          </div>
          <div className="flex justify-end">
            <Button variant="dark" onClick={() => void changePassword()} loading={savingPw}>
              Ganti Password
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader icon={<ShieldCheck className="h-4 w-4" />} title="Metode Masuk (OAuth)" description="Status konfigurasi login pihak ketiga pada platform." />
        <CardBody className="space-y-3">
          {[
            { key: 'google', label: 'Google', provider: 'Google' },
            { key: 'facebook', label: 'Facebook', provider: 'Facebook' },
          ].map((p) => {
            const cfg = oauth.data?.[p.key as keyof OAuthConfig];
            const configured = typeof cfg === 'object' && cfg !== null && (cfg as { configured?: boolean }).configured;
            return (
              <div key={p.key} className="flex items-center gap-3 rounded-xl border border-slate-100 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                  {p.key === 'google' ? <KeyRound className="h-5 w-5" /> : <Facebook className="h-5 w-5 text-[#1877F2]" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">Login dengan {p.label}</p>
                  <p className="truncate text-xs text-slate-400">
                    {typeof cfg === 'object' && cfg !== null && (cfg as { callbackUrl?: string }).callbackUrl
                      ? (cfg as { callbackUrl: string }).callbackUrl
                      : 'Status tidak tersedia'}
                  </p>
                </div>
                <Badge className={configured ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}>
                  {configured ? (
                    <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Aktif</span>
                  ) : (
                    <span className="flex items-center gap-1"><X className="h-3 w-3" /> Belum dikonfigurasi</span>
                  )}
                </Badge>
              </div>
            );
          })}
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <KeyRound className="h-3.5 w-3.5" />
            URL callback didaftarkan di dashboard Google / Meta. Lihat README untuk panduan lengkap.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={<LogOut className="h-4 w-4" />} title="Sesi" />
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Keluar dari semua perangkat</p>
              <p className="text-xs text-slate-400">Hapus token akses lokal dan kembali ke halaman masuk.</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                logout();
                navigate('/');
              }}
            >
              Keluar
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
