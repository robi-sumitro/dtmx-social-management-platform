import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Facebook, Youtube, Share2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { PageLoader } from '@/components/ui/Loading';
import { useToast } from '@/components/ui/Toast';
import { formatNumber } from '@/lib/utils';

interface DetectedChannel {
  id: string;
  name: string;
  avatar?: string;
  followersCount: number;
  provider: 'facebook' | 'youtube';
}

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const { oauthCallback } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState('');
  const [channels, setChannels] = useState<DetectedChannel[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
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
        let detected: DetectedChannel[] = [];
        try {
          const raw = JSON.parse(searchParams.get('channels') ?? '[]');
          if (Array.isArray(raw)) detected = raw;
        } catch {
          detected = [];
        }
        if (detected.length === 0) {
          toast.success('Berhasil masuk', 'Akun kamu terhubung via OAuth.');
          navigate('/app', { replace: true });
          return;
        }
        setChannels(detected);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Gagal menyelesaikan autentikasi');
        toast.error('Gagal masuk', err instanceof Error ? err.message : 'Terjadi kesalahan');
      });
  }, [searchParams, oauthCallback, navigate, toast]);

  const connectChannel = async (ch: DetectedChannel) => {
    setConnectingId(ch.id);
    try {
      const { url } = await api.get<{ url: string }>(`/social-accounts/auth/${ch.provider}/url`);
      window.location.assign(url);
    } catch (err) {
      toast.error('Gagal memulai OAuth', err instanceof Error ? err.message : 'Terjadi kesalahan');
      setConnectingId(null);
    }
  };

  const skip = () => navigate('/app', { replace: true });

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm">
        {error ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-6 py-8 text-center">
            <p className="text-3xl">😕</p>
            <p className="mt-3 text-sm font-medium text-rose-700">{error}</p>
            <button
              onClick={() => navigate('/auth/login')}
              className="mt-5 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Kembali ke Masuk
            </button>
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
              <svg viewBox="0 0 64 64" className="h-8 w-8" fill="none">
                <path d="M16 16l10 26 6-17 6 17 10-26" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <PageLoader label="Menyelesaikan autentikasi..." />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Share2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Kamu sudah berhasil masuk</p>
                <p className="text-xs text-slate-400">Kami mendeteksi platform yang kamu kelola</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {channels.map((ch) => (
                <div key={ch.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                  {ch.avatar ? (
                    <img src={ch.avatar} alt={ch.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                      {ch.provider === 'youtube' ? (
                        <Youtube className="h-5 w-5 text-[#FF0000]" />
                      ) : (
                        <Facebook className="h-5 w-5 text-[#1877F2]" />
                      )}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{ch.name}</p>
                    <p className="text-xs text-slate-400">
                      {ch.provider === 'youtube' ? 'Channel YouTube' : 'Halaman Facebook'} · {formatNumber(ch.followersCount)} pengikut
                    </p>
                  </div>
                  <button
                    onClick={() => void connectChannel(ch)}
                    disabled={connectingId === ch.id}
                    className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60"
                  >
                    {connectingId === ch.id ? 'Menghubungkan...' : 'Hubungkan'}
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={skip}
              className="mt-5 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Nanti Saja
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
