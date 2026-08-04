import { Link } from 'react-router-dom';
import {
  Share2,
  FileText,
  Sparkles,
  Inbox,
  Plus,
  ArrowUpRight,
  Upload,
  CalendarClock,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/lib/useApi';
import { api } from '@/lib/api';
import type { SocialAccount, Post, UsageResponse, AiStatus, InboxListResponse, AnalyticsSummary } from '@/lib/types';
import { formatDate, timeAgo, postStatusMeta, cn } from '@/lib/utils';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { StatCard, PlatformIcon } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { PageLoader, Skeleton } from '@/components/ui/Loading';
import { UsageBar } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/EmptyState';

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('id-ID');
}

export function Dashboard() {
  const { user } = useAuth();
  const firstName = (user?.fullName || user?.username || '')?.split(' ')[0];

  const accounts = useFetch<SocialAccount[]>(() => api.get('/social-accounts'));
  const usage = useFetch<UsageResponse>(() => api.get('/subscriptions/usage'));
  const aiStatus = useFetch<AiStatus>(() => api.get('/ai/status'));
  const posts = useFetch<Post[]>(() => api.get('/posts'));
  const inbox = useFetch<InboxListResponse>(() => api.get('/inbox?limit=1'));
  const analytics = useFetch<AnalyticsSummary>(() => api.get('/analytics/summary'));

  const activeAccounts = accounts.data?.filter((a) => a.isActive) ?? [];
  const scheduledCount = posts.data?.filter((p) => p.status === 'scheduled').length ?? 0;
  const draftCount = posts.data?.filter((p) => p.status === 'draft').length ?? 0;
  const newInbox = inbox.data?.total ?? 0;
  const recentPosts = (posts.data ?? []).slice(0, 5);
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const stats = analytics.data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-slate-400">{today}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Selamat datang kembali{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">Berikut ringkasan aktivitas sosial media kamu hari ini.</p>
        </div>
        <Link
          to="/app/posts/new"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Buat Postingan
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Jangkauan (Reach)"
          value={stats ? formatCompact(stats.reach) : '—'}
          hint={stats ? `${stats.byAccount.length} akun · 30 hari terakhir` : analytics.loading ? 'Memuat data...' : 'Hubungkan akun untuk melihat data'}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Engagement Rate"
          value={stats ? `${stats.engagementRate.toFixed(1)}%` : '—'}
          hint={stats ? 'Rata-rata interaksi post' : analytics.loading ? 'Memuat data...' : 'Belum ada data'}
          icon={<Share2 className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Total Klik Tautan"
          value={stats ? formatCompact(stats.linkClicks) : '—'}
          hint={stats ? `Dari ${stats.publishedPosts} postingan terbit` : analytics.loading ? 'Memuat data...' : 'Belum ada data'}
          icon={<ArrowUpRight className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Inbox Baru"
          value={newInbox}
          hint={newInbox ? 'Menunggu respon' : 'Semua beres ✓'}
          icon={<Inbox className="h-5 w-5" />}
          accent="rose"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Penggunaan Paket"
            description={usage.data?.plan ? `Paket ${usage.data.plan.name}` : 'Belum ada paket aktif'}
            action={
              <Link to="/app/billing" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
                Kelola <ArrowUpRight className="h-4 w-4" />
              </Link>
            }
          />
          <CardBody>
            {usage.loading ? (
              <div className="space-y-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : usage.data?.plan ? (
              <div className="space-y-6">
                {[
                  { label: 'Akun Sosial', used: usage.data.accountsUsed, max: usage.data.limits.accounts },
                  { label: 'Posting / Bulan', used: usage.data.postsUsed, max: usage.data.limits.posts },
                  { label: 'Kuota AI / Bulan', used: usage.data.aiUsed, max: usage.data.limits.ai },
                ].map((row) => {
                  const pct = row.max > 0 ? Math.round((row.used / row.max) * 100) : 0;
                  return (
                    <div key={row.label}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{row.label}</span>
                        <span className="text-slate-500">
                          {row.used} / {row.max}
                          <span className="ml-2 text-xs font-semibold text-slate-400">{pct}%</span>
                        </span>
                      </div>
                      <UsageBar value={row.used} max={row.max} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-6 w-6" />}
                title="Belum ada paket aktif"
                description="Pilih paket untuk membuka batas akun, posting, dan kuota AI yang lebih besar."
                action={
                  <Link to="/app/billing" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500">
                    Lihat Paket
                  </Link>
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Aksi Cepat"
            description="Lakukan hal-hal penting sekarang"
          />
          <CardBody className="space-y-3">
            {[
              { label: 'Buat postingan baru', sub: 'Tulis, jadwalkan, atau publish', icon: Plus, to: '/app/posts/new', color: 'bg-brand-50 text-brand-600' },
              { label: 'Unggah media', sub: 'Tambah ke media library', icon: Upload, to: '/app/media', color: 'bg-emerald-50 text-emerald-600' },
              { label: 'Balas inbox', sub: `${newInbox} pesan menunggu`, icon: Inbox, to: '/app/inbox', color: 'bg-rose-50 text-rose-600' },
              { label: 'Generate dengan AI', sub: 'Caption, hashtag & konten', icon: Sparkles, to: '/app/ai', color: 'bg-violet-50 text-violet-600' },
            ].map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="group flex items-center gap-3.5 rounded-xl border border-slate-100 p-3.5 transition hover:border-slate-200 hover:bg-slate-50"
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.color}`}>
                  <a.icon className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{a.label}</span>
                  <span className="block text-xs text-slate-400">{a.sub}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-brand-500" />
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Postingan Terbaru"
            description="Aktivitas terakhir kamu"
            action={
              <Link to="/app/posts" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
                Lihat semua <ArrowUpRight className="h-4 w-4" />
              </Link>
            }
          />
          {posts.loading ? (
            <CardBody>
              <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            </CardBody>
          ) : recentPosts.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-6 w-6" />}
              title="Belum ada postingan"
              description="Mulai buat postingan pertamamu dan jadwalkan ke platform favoritmu."
              action={
                <Link to="/app/posts/new" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500">
                  Buat Postingan
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-slate-50">
              {recentPosts.map((post) => {
                const meta = postStatusMeta(post.status);
                return (
                  <Link key={post.id} to="/app/posts" className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50 sm:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{post.caption || post.title || 'Tanpa caption'}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                        <span>{timeAgo(post.createdAt)}</span>
                        {post.scheduledAt && <span>Jadwal: {formatDate(post.scheduledAt)}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="hidden items-center gap-1.5 sm:flex">
                        {(post.accounts ?? []).slice(0, 3).map((pa) => (
                          <PlatformIcon key={pa.accountId} provider={pa.account?.provider ?? ''} size="h-4 w-4" />
                        ))}
                      </div>
                      <Badge className={meta.className} dot={meta.dot}>
                        {meta.label}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Akun Terhubung" description={`${activeAccounts.length} akun aktif`} action={
            <Link to="/app/accounts" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Kelola</Link>
          } />
          <CardBody className="space-y-3">
            {accounts.loading ? (
              <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : activeAccounts.length === 0 ? (
              <EmptyState
                icon={<Share2 className="h-6 w-6" />}
                title="Belum ada akun"
                description="Hubungkan akun Facebook, Instagram, YouTube, atau TikTok."
                action={
                  <Link to="/app/accounts" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500">
                    Hubungkan Akun
                  </Link>
                }
              />
            ) : (
              activeAccounts.map((acc) => (
                <div key={acc.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-slate-200">
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', 'bg-slate-100')}>
                    <PlatformIcon provider={acc.provider} size="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{acc.accountName}</p>
                    <p className="text-xs text-slate-400">
                      {acc.followersCount ? `${acc.followersCount.toLocaleString('id-ID')} followers` : acc.accountType}
                    </p>
                  </div>
                  <span className={cn('h-2 w-2 rounded-full', acc.isActive ? 'bg-emerald-500' : 'bg-slate-300')} />
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
