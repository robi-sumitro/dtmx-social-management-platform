import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { PageLoader } from '@/components/ui/Loading';
import { useToast } from '@/components/ui/Toast';

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const { oauthCallback } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (!accessToken || !refreshToken) {
      setError('Token OAuth tidak ditemukan. Silakan coba lagi.');
      return;
    }

    oauthCallback(accessToken, refreshToken)
      .then(() => {
        toast.success('Berhasil masuk', 'Akun kamu terhubung via OAuth.');
        navigate('/app', { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Gagal menyelesaikan autentikasi');
        toast.error('Gagal masuk', err instanceof Error ? err.message : 'Terjadi kesalahan');
      });
  }, [searchParams, oauthCallback, navigate, toast]);

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-6 py-8">
            <p className="text-3xl">😕</p>
            <p className="mt-3 text-sm font-medium text-rose-700">{error}</p>
            <button
              onClick={() => navigate('/auth/login')}
              className="mt-5 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Kembali ke Masuk
            </button>
          </div>
        ) : (
          <div>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
              <svg viewBox="0 0 64 64" className="h-8 w-8" fill="none">
                <path d="M16 16l10 26 6-17 6 17 10-26" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <PageLoader label="Menyelesaikan autentikasi..." />
          </div>
        )}
      </div>
    </div>
  );
}
