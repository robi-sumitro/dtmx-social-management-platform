import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  CalendarClock,
  MessagesSquare,
  Share2,
  Image as ImageIcon,
  BarChart3,
  Check,
  ChevronDown,
  ArrowRight,
  Zap,
  Shield,
  Globe2,
  Menu,
  X,
  Star,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Plan } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';

const FALLBACK_PLANS: Plan[] = [
  { id: 'free', name: 'Free', slug: 'free', description: 'Mulai mengelola 1 akun sosial kamu', price: 0, currency: 'USD', billingPeriodDays: 30, maxAccounts: 1, maxPostsPerMonth: 10, aiPerMonth: 20, isActive: true },
  { id: 'basic', name: 'Basic', slug: 'basic', description: 'Untuk creator yang mulai serius', price: 5, currency: 'USD', billingPeriodDays: 30, maxAccounts: 3, maxPostsPerMonth: 50, aiPerMonth: 200, isActive: true },
  { id: 'pro', name: 'Pro', slug: 'pro', description: 'Paling populer untuk tim dan agensi kecil', price: 12, currency: 'USD', billingPeriodDays: 30, maxAccounts: 8, maxPostsPerMonth: 200, aiPerMonth: 1000, isActive: true },
  { id: 'ent', name: 'Enterprise', slug: 'enterprise', description: 'Untuk agensi besar dengan kebutuhan penuh', price: 30, currency: 'USD', billingPeriodDays: 30, maxAccounts: 20, maxPostsPerMonth: 1000, aiPerMonth: 5000, isActive: true },
];

const FEATURES = [
  {
    icon: Share2,
    title: 'Publish Multi-Platform',
    desc: 'Terbitkan satu konten ke Facebook, Instagram, YouTube, dan TikTok sekaligus dari satu dashboard.',
    color: 'from-indigo-500 to-violet-500',
  },
  {
    icon: Sparkles,
    title: 'AI Content Writer',
    desc: 'Tulis caption, hashtag, dan konten dengan bantuan AI. Hemat jam kerja setiap minggu.',
    color: 'from-fuchsia-500 to-pink-500',
  },
  {
    icon: CalendarClock,
    title: 'Jadwal Otomatis',
    desc: 'Atur waktu posting terbaik dan biarkan DtmX menerbitkan konten saat kamu sibuk.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: MessagesSquare,
    title: 'Smart Inbox',
    desc: 'Semua komentar dan DM terpusat. Balas manual atau otomatis dengan AI.',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    icon: ImageIcon,
    title: 'Media Library',
    desc: 'Simpan, atur, dan gunakan kembali semua aset visual tim kamu di satu tempat.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: BarChart3,
    title: 'Kontrol Penuh',
    desc: 'Pantau penggunaan kuota, jadwal, dan performa setiap akun secara real-time.',
    color: 'from-rose-500 to-red-500',
  },
];

const STEPS = [
  { n: '01', title: 'Hubungkan Akun', desc: 'Login dengan akun sosial kamu — Facebook, Instagram, YouTube, atau TikTok.' },
  { n: '02', title: 'Buat & Jadwalkan', desc: 'Tulis konten, sisipkan media, pilih target akun, dan tentukan waktu terbit.' },
  { n: '03', title: 'Kelola & Balas', desc: 'Pantau inbox terpusat dan balas otomatis dengan AI untuk interaksi maksimal.' },
];

const TESTIMONIALS = [
  { name: 'Rani Wijaya', role: 'Content Creator, 120k followers', quote: 'DtmX mengubah cara saya mengelola 4 akun sekaligus. Fitur AI caption-nya luar biasa, saya hemat 3 jam per hari!', avatar: 'RW' },
  { name: 'Dimas Prakoso', role: 'Owner, Digital Agency', quote: 'Klien kami puas karena posting selalu on-time. Multi-platform publish dan smart inbox adalah game changer.', avatar: 'DP' },
  { name: 'Sinta Maharani', role: 'Social Media Manager', quote: 'Antarmuka paling bersih yang pernah saya pakai. Scheduling dan media library-nya super intuitif.', avatar: 'SM' },
];

const FAQS = [
  { q: 'Apakah DtmX gratis untuk memulai?', a: 'Ya! Paket Free selamanya gratis dengan 1 akun sosial, 10 posting/bulan, dan 20 kuota AI. Upgrade kapan saja sesuai kebutuhan.' },
  { q: 'Platform apa saja yang didukung?', a: 'Saat ini mendukung Facebook, Instagram, YouTube, dan TikTok — cukup hubungkan akun, kami yang urus sisanya.' },
  { q: 'Bagaimana cara kerja balasan AI?', a: 'DtmX menganalisis komentar/DM dan menyusun balasan profesional yang bisa kamu tinjau sebelum dikirim, atau kirim otomatis.' },
  { q: 'Bisakah saya menjadwalkan posting?', a: 'Tentu. Pilih tanggal dan jam, atau gunakan slot waktu terbaik yang direkomendasikan, lalu biarkan DtmX menerbitkan otomatis.' },
  { q: 'Bagaimana metode pembayaran?', a: 'Kami mendukung transfer manual, Stripe, TriPay, dan Midtrans. Bukti pembayaran manual dikonfirmasi admin.' },
  { q: 'Apakah data saya aman?', a: 'Ya. Token dienkripsi, koneksi HTTPS, dan kami tidak pernah membagikan data kamu ke pihak ketiga.' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: '/#fitur', label: 'Fitur' },
    { href: '/#cara-kerja', label: 'Cara Kerja' },
    { href: '/#harga', label: 'Harga' },
    { href: '/#faq', label: 'FAQ' },
  ];
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2.5 md:flex">
          <Link to="/auth/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
            Masuk
          </Link>
          <Link to="/auth/register" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:brightness-110">
            Mulai Gratis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <button className="rounded-lg p-2 text-slate-600 md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {l.label}
            </a>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
            <Link to="/auth/login" className="rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              Masuk
            </Link>
            <Link to="/auth/register" className="rounded-xl bg-brand-gradient px-4 py-2.5 text-center text-sm font-semibold text-white">
              Mulai Gratis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="pointer-events-none absolute inset-0 bg-brand-gradient-soft" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-400/25 via-violet-400/20 to-fuchsia-400/25 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-brand-700 shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4" />
            Platform Manajemen Sosial Media Bertenaga AI
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-6xl">
            Kelola Semua Akun Sosialmu
            <span className="text-gradient block">dalam Satu Dashboard</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Jadwalkan posting, terbitkan ke banyak platform, balas inbox dengan AI, dan pantau performa —
            semua tanpa pindah tab.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/auth/register"
              className="group inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand-gradient px-7 py-3.5 text-base font-semibold text-white shadow-glow transition hover:brightness-110 sm:w-auto"
            >
              Coba Gratis Sekarang
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="/#fitur"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-base font-semibold text-slate-700 ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50 sm:w-auto"
            >
              Lihat Fitur
            </a>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" /> Tanpa kartu kredit</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" /> Setup 5 menit</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" /> Batal kapan saja</span>
          </div>
        </div>

        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="absolute -inset-x-8 -inset-y-6 rounded-[2.5rem] bg-gradient-to-r from-brand-500/15 via-violet-500/10 to-fuchsia-500/15 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-slide-up">
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-3 text-xs font-medium text-slate-400">app.dtmx.io</span>
            </div>
            <div className="flex">
              <div className="hidden w-52 shrink-0 border-r border-slate-100 bg-slate-900 p-4 sm:block">
                <div className="mb-4 flex h-8 items-center gap-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient">
                    <svg viewBox="0 0 64 64" className="h-4 w-4" fill="none"><path d="M16 16l10 26 6-17 6 17 10-26" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <span className="text-sm font-bold text-white">DtmX</span>
                </div>
                {['Dashboard', 'Postingan', 'Inbox', 'Media', 'AI Studio'].map((item, i) => (
                  <div key={item} className={`mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${i === 0 ? 'bg-white/10 text-white' : 'text-slate-400'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-brand-400' : 'bg-slate-600'}`} />
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex-1 bg-ink-50 p-5">
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {[
                    { l: 'Akun Terhubung', v: '8', c: 'text-emerald-500' },
                    { l: 'Posting Bulan Ini', v: '142', c: 'text-brand-500' },
                    { l: 'Kuota AI', v: '78%', c: 'text-violet-500' },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{s.l}</p>
                      <p className={`mt-1 text-lg font-bold ${s.c}`}>{s.v}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">Jadwal Mingguan</p>
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600">Live</span>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {[70, 45, 85, 60, 90, 55, 75].map((h, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-8 text-[10px] text-slate-400">{['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][i]}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${h}%` }} />
                        </div>
                        <span className="w-7 text-right text-[10px] font-semibold text-slate-500">{h}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="fitur" className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">Fitur Unggulan</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Semua yang Kamu Butuhkan untuk Berkembang</h2>
          <p className="mt-4 text-lg text-slate-500">Satu platform lengkap untuk publish, jadwalkan, dan balas interaksi — didukung AI di setiap langkah.</p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-cardHover">
              <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${f.color} text-white shadow-lg transition-transform group-hover:scale-110`}>
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="cara-kerja" className="bg-slate-900 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">Cara Kerja</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Mulai dalam 3 Langkah Mudah</h2>
          <p className="mt-4 text-lg text-slate-400">Dari akun kosong ke alur kerja lengkap hanya dalam hitungan menit.</p>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
              <span className="text-5xl font-extrabold text-white/10">{s.n}</span>
              <h3 className="mt-4 text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Plan[]>('/subscriptions/plans')
      .then((data) => {
        if (Array.isArray(data) && data.length) setPlans(data);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const highlight = plans.find((p) => p.slug === 'pro')?.id;

  return (
    <section id="harga" className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">Harga</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Paket Sederhana, Tanpa Kejutan</h2>
          <p className="mt-4 text-lg text-slate-500">Mulai gratis, upgrade saat tim dan audiensmu bertumbuh.</p>
        </div>
        {loading ? (
          <div className="mt-14 grid gap-6 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => {
              const isHot = p.id === highlight;
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-2xl border bg-white p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-cardHover ${
                    isHot ? 'border-brand-300 ring-2 ring-brand-200' : 'border-slate-200'
                  }`}
                >
                  {isHot && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-3 py-1 text-xs font-bold text-white shadow-glow">
                      Paling Populer
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
                  <p className="mt-1 min-h-10 text-sm text-slate-500">{p.description}</p>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-slate-900">{formatCurrency(p.price, p.currency)}</span>
                    <span className="text-sm text-slate-400">/bulan</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-600">
                    <li className="flex items-center gap-2.5"><Check className="h-4 w-4 shrink-0 text-emerald-500" /> {p.maxAccounts} akun sosial</li>
                    <li className="flex items-center gap-2.5"><Check className="h-4 w-4 shrink-0 text-emerald-500" /> {p.maxPostsPerMonth} posting/bulan</li>
                    <li className="flex items-center gap-2.5"><Check className="h-4 w-4 shrink-0 text-emerald-500" /> {p.aiPerMonth} kuota AI/bulan</li>
                    <li className="flex items-center gap-2.5"><Check className="h-4 w-4 shrink-0 text-emerald-500" /> Smart inbox & scheduling</li>
                  </ul>
                  <Link
                    to="/auth/register"
                    className={`mt-7 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition ${
                      isHot
                        ? 'bg-brand-gradient text-white shadow-glow hover:brightness-110'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {p.price === 0 ? 'Mulai Gratis' : 'Pilih Paket'}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="bg-brand-gradient-soft py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">Testimoni</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Dipercaya Creator & Agenci Kreatif</h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-card">
              <div className="flex gap-1 text-amber-400">
                {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">"{t.quote}"</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">{t.avatar}</div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">FAQ</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Pertanyaan yang Sering Diajukan</h2>
        </div>
        <div className="mt-12 space-y-3">
          {FAQS.map((f, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="text-sm font-semibold text-slate-900 sm:text-base">{f.q}</span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && <div className="px-6 pb-5 text-sm leading-relaxed text-slate-600 animate-fade-in">{f.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="px-4 pb-24 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-slate-900 px-6 py-16 text-center sm:px-16">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[560px] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-500/40 to-fuchsia-500/40 blur-3xl" />
        <div className="relative">
          <div className="mb-5 flex items-center justify-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            <Globe2 className="h-5 w-5 text-brand-400" />
            <Shield className="h-5 w-5 text-emerald-400" />
          </div>
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Siap Mengelola Sosial Media dengan Lebih Cerdas?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
            Bergabung dengan ribuan creator yang sudah menghemat waktu dengan DtmX. Gratis untuk memulai.
          </p>
          <Link
            to="/auth/register"
            className="mt-8 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-brand-gradient px-8 py-3.5 text-base font-semibold text-white shadow-glow transition hover:brightness-110"
          >
            Buat Akun Gratis
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-slate-500">Platform manajemen sosial media bertenaga AI untuk creator, tim, dan agensi.</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Produk</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
              <li><a href="/#fitur" className="hover:text-brand-600">Fitur</a></li>
              <li><a href="/#harga" className="hover:text-brand-600">Harga</a></li>
              <li><a href="/#cara-kerja" className="hover:text-brand-600">Cara Kerja</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Perusahaan</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
              <li><Link to="/tentang" className="hover:text-brand-600">Tentang</Link></li>
              <li><Link to="/blog" className="hover:text-brand-600">Blog</Link></li>
              <li><Link to="/karier" className="hover:text-brand-600">Karier</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Bantuan</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
              <li><a href="/#faq" className="hover:text-brand-600">FAQ</a></li>
              <li><Link to="/dokumentasi" className="hover:text-brand-600">Dokumentasi</Link></li>
              <li><Link to="/hubungi-kami" className="hover:text-brand-600">Hubungi Kami</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-8 sm:flex-row">
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} DtmX. Seluruh hak cipta dilindungi.</p>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link to="/privasi" className="hover:text-slate-600">Privasi</Link>
            <Link to="/syarat" className="hover:text-slate-600">Syarat</Link>
            <Link to="/keamanan" className="hover:text-slate-600">Keamanan</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="bg-white">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
