import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { oauthUrl } from '@/lib/api';

export function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '/app';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Masukkan email yang valid';
    if (!password) next.password = 'Password wajib diisi';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Berhasil masuk', 'Selamat datang kembali di DtmX!');
      navigate(from, { replace: true });
    } catch (err) {
      toast.error('Gagal masuk', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Selamat Datang Kembali 👋</h1>
        <p className="mt-2 text-sm text-slate-500">Masuk untuk melanjutkan mengelola sosial media kamu.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="nama@email.com"
            icon={<Mail className="h-4 w-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="email"
          />
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              icon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-[38px] text-slate-400 transition hover:text-slate-600"
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <Link to="/auth/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
              Lupa password?
            </Link>
          </div>

          <Button type="submit" fullWidth size="lg" loading={loading}>
            Masuk
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">atau</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a
            href={oauthUrl('google')}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.3 3.8l-.1.2 3.3 2.6.2.2c2.1-2 3.4-4.9 3.4-8.7z"/><path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.5-2.7c-1 .7-2.3 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5l-.1.1-3.4 2.7-.1.2C3.6 21.3 7.4 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.7c-.3-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2l-.1-.2-3.5-2.7-.1.1C.7 9 0 11 0 12.5s.7 3.5 1.5 5l3.6-2.8z"/><path fill="#EA4335" d="M12 4.9c2 0 3.3.8 4 1.5l3-2.9C17.7 1.2 15.1 0 12 0 7.4 0 3.6 2.7 1.5 6.8l3.6 2.8C6.1 6.7 8.8 4.9 12 4.9z"/></svg>
            Google
          </a>
          <a
            href={oauthUrl('facebook')}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.02 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.09 24 12.07z"/></svg>
            Facebook
          </a>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Belum punya akun?{' '}
          <Link to="/auth/register" className="font-semibold text-brand-600 hover:text-brand-700">
            Daftar gratis
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
