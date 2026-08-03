import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Masukkan email yang valid');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mx-auto w-full max-w-sm">
        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cek Email Kamu</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Jika email <span className="font-semibold text-slate-700">{email}</span> terdaftar, kami telah mengirimkan
              tautan untuk mereset password. Tautan berlaku selama 2 jam.
            </p>
            <Link to="/auth/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
              Kembali ke halaman masuk <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lupa Password?</h1>
            <p className="mt-2 text-sm text-slate-500">
              Masukkan email yang terdaftar, kami akan kirim tautan reset password.
            </p>
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="nama@email.com"
                icon={<Mail className="h-4 w-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error}
              />
              <Button type="submit" fullWidth size="lg" loading={loading}>
                Kirim Tautan Reset
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">
              Ingat password?{' '}
              <Link to="/auth/login" className="font-semibold text-brand-600 hover:text-brand-700">
                Masuk
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
