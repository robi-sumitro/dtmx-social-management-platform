import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Quote, Star, Sparkles } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full">
      <div className="relative hidden w-1/2 overflow-hidden bg-slate-900 lg:block">
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fuchsia-600/25 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo className="[&_span:last-child]:text-white" />
          <div>
            <div className="flex items-center gap-1 text-amber-400">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="mt-6 max-w-md text-2xl font-semibold leading-relaxed text-white">
              "DtmX mengubah cara tim kami mengelola 8 akun sekaligus. Kami hemat puluhan jam setiap bulan."
            </blockquote>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">DP</div>
              <div>
                <p className="text-sm font-semibold text-white">Dimas Prakoso</p>
                <p className="text-xs text-slate-400">Owner Digital Agency</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            {['Multi-platform Publish', 'AI Content Writer', 'Smart Inbox', 'Jadwal Otomatis'].map((f) => (
              <span key={f} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Sparkles className="h-3 w-3 text-brand-400" />
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col lg:w-1/2">
        <div className="flex h-16 items-center justify-between px-6 lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:px-16">
          {children}
          <div className="mt-10 flex items-center gap-1.5 text-xs text-slate-400">
            <Quote className="h-3 w-3" />
            Butuh bantuan? Hubungi support@dtmx.app
          </div>
        </div>
        <p className="pb-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} DtmX · <Link to="/" className="hover:text-slate-600">Kembali ke Beranda</Link>
        </p>
      </div>
    </div>
  );
}
