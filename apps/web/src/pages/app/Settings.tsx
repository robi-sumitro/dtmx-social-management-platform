import { useState } from 'react';
import { User as UserIcon, Lock, KeyRound, Camera, LogOut, Save } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useNavigate } from 'react-router-dom';

export function Settings() {
  const { user, updateUser, logout, refreshProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ fullName: user?.fullName ?? '', username: user?.username ?? '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

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

      <Card className="mb-6">
        <CardHeader icon={<UserIcon className="h-4 w-4" />} title="Profil" />
        <CardBody className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar name={user?.fullName || user?.username || user?.email} src={user?.avatar} size="lg" />
              <button
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-2 ring-white transition hover:bg-brand-500"
                onClick={() => toast.info('Unggah avatar', 'Fitur unggah avatar belum tersedia di backend.')}
                aria-label="Ubah avatar"
              >
                <Camera className="h-4 w-4" />
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
