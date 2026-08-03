import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password minimal 8 karakter');
      return;
    }
    if (confirm !== password) {
      setError('Konfirmasi password tidak cocok');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      toast.success('Password berhasil direset', 'Silakan masuk dengan password baru.');
      setTimeout(() => navigate('/auth/login', { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mx-auto w-full max-w-sm">
        {done ? (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Berhasil!</h1>
            <p className="mt-2 text-sm text-slate-500">Mengalihkan ke halaman masuk...</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Atur Password Baru</h1>
            <p className="mt-2 text-sm text-slate-500">Buat password baru yang kuat untuk akun kamu.</p>
            {!token && (
              <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Tautan reset tidak valid. Gunakan tautan dari email kamu.
              </p>
            )}
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="relative">
                <Input
                  label="Password Baru"
                  type={show ? 'text' : 'password'}
                  placeholder="Minimal 8 karakter"
                  icon={<Lock className="h-4 w-4" />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={error}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600"
                  aria-label="Tampilkan password"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Input
                label="Konfirmasi Password"
                type={show ? 'text' : 'password'}
                placeholder="Ulangi password"
                icon={<Lock className="h-4 w-4" />}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button type="submit" fullWidth size="lg" loading={loading} disabled={!token}>
                Reset Password
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">
              <Link to="/auth/login" className="font-semibold text-brand-600 hover:text-brand-700">
                Kembali ke masuk
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
