import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  Users as UsersIcon,
  FileText,
  Image as ImageIcon,
  CreditCard,
  Receipt,
  ToggleLeft,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  RefreshCw,
  Activity,
  Sparkles,
  Save,
  Loader2,
} from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api } from '@/lib/api';
import type { AdminDashboard, User, Plan, PendingSubscription, FeatureFlag, Post, PaymentSetting, AiSetting } from '@/lib/types';
import { formatDate, formatDateTime, formatCurrency, subscriptionStatusMeta, postStatusMeta } from '@/lib/utils';
import { PageHeader, StatCard, PlatformIcon } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { Avatar } from '@/components/ui/Avatar';

type Tab = 'overview' | 'users' | 'plans' | 'pending' | 'flags' | 'payments' | 'posts' | 'ai';

export function Admin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = (searchParams.get('tab') as Tab) || 'overview';
  const [tab, setTab] = useState<Tab>(['overview', 'users', 'posts', 'plans', 'pending', 'flags', 'payments', 'ai'].includes(tabParam) ? tabParam : 'overview');
  const stats = useFetch<AdminDashboard>(() => api.get('/admin/dashboard'));

  useEffect(() => {
    if (['overview', 'users', 'posts', 'plans', 'pending', 'flags', 'payments', 'ai'].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [tabParam]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Admin Panel"
        description="Kelola pengguna, paket, langganan, dan konfigurasi platform."
      />

      <Tabs
        className="mb-6 w-fit"
        value={tab}
        onChange={changeTab}
        items={[
          { value: 'overview', label: 'Ringkasan' },
          { value: 'users', label: 'Pengguna' },
          { value: 'posts', label: 'Postingan' },
          { value: 'plans', label: 'Paket' },
          { value: 'pending', label: 'Konfirmasi' },
          { value: 'flags', label: 'Feature Flags' },
          { value: 'payments', label: 'Pembayaran' },
          { value: 'ai', label: 'AI Providers' },
        ]}
      />

      {tab === 'overview' && <Overview stats={stats.data} loading={stats.loading} />}
      {tab === 'users' && <UsersAdmin />}
      {tab === 'posts' && <PostsAdmin />}
      {tab === 'plans' && <PlansAdmin />}
      {tab === 'pending' && <PendingAdmin />}
      {tab === 'flags' && <FlagsAdmin />}
      {tab === 'payments' && <PaymentsAdmin />}
      {tab === 'ai' && <AiAdmin />}
    </div>
  );
}

function Overview({ stats, loading }: { stats: AdminDashboard | null; loading: boolean }) {
  if (loading || !stats) return <PageLoader label="Memuat statistik..." />;

  const chartData = [
    { name: 'Pengguna', value: stats.totalUsers },
    { name: 'Postingan', value: stats.totalPosts },
    { name: 'Media', value: stats.totalMedia },
    { name: 'Subscriber', value: stats.totalSubscribers },
    { name: 'Paket', value: stats.totalPlans },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Pengguna" value={stats.totalUsers} icon={<UsersIcon className="h-5 w-5" />} accent="brand" />
        <StatCard label="Total Postingan" value={stats.totalPosts} icon={<FileText className="h-5 w-5" />} accent="emerald" />
        <StatCard label="Total Media" value={stats.totalMedia} icon={<ImageIcon className="h-5 w-5" />} accent="amber" />
        <StatCard label="Subscriber Aktif" value={stats.totalSubscribers} icon={<CreditCard className="h-5 w-5" />} accent="rose" />
        <StatCard label="Pendapatan MRR" value={formatCurrency(stats.revenue)} icon={<DollarSign className="h-5 w-5" />} accent="emerald" />
        <StatCard label="Feature Flags Aktif" value={`${stats.enabledFlags}`} icon={<ToggleLeft className="h-5 w-5" />} accent="blue" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Activity className="h-4 w-4" />} title="Distribusi Data" />
          <CardBody>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="value" fill="url(#adminBar)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="adminBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Activity className="h-4 w-4" />} title="Ringkasan Platform" />
          <CardBody className="space-y-4">
            {[
              { label: 'Rasio subscriber per pengguna', value: stats.totalUsers ? (stats.totalSubscribers / stats.totalUsers).toFixed(2) : '0', desc: 'Persentase pengguna berbayar aktif' },
              { label: 'Rata-rata posting per media', value: stats.totalMedia ? (stats.totalPosts / stats.totalMedia).toFixed(1) : '0', desc: 'Postingan yang menggunakan aset media' },
              { label: 'Paket tersedia', value: stats.totalPlans, desc: 'Jumlah paket aktif di sistem' },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-xl border border-slate-100 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-600">{r.label}</p>
                  <p className="text-xs text-slate-400">{r.desc}</p>
                </div>
                <span className="text-xl font-bold text-brand-600">{r.value}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function UsersAdmin() {
  const toast = useToast();
  const { data, loading, refetch } = useFetch<User[]>(() => api.get('/admin/users'));
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: '', username: '', fullName: '', password: '', role: 'user' });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleUser = async (u: User) => {
    setBusyId(u.id);
    try {
      await api.patch(`/admin/users/${u.id}/toggle`);
      toast.success(u.isActive ? 'Pengguna dinonaktifkan' : 'Pengguna diaktifkan');
      refetch();
    } catch (err) {
      toast.error('Gagal', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      toast.success('Pengguna dihapus', `${deleteTarget.email} berhasil dihapus beserta datanya.`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error('Gagal menghapus', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setDeleting(false);
    }
  };

  const createUser = async () => {
    if (!form.email || form.password.length < 8) {
      toast.warning('Lengkapi data', 'Email valid dan password minimal 8 karakter.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/users', form);
      toast.success('Pengguna dibuat');
      setCreateOpen(false);
      setForm({ email: '', username: '', fullName: '', password: '', role: 'user' });
      refetch();
    } catch (err) {
      toast.error('Gagal membuat pengguna', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={<UsersIcon className="h-4 w-4" />}
        title="Manajemen Pengguna"
        description={`${data?.length ?? 0} pengguna terdaftar`}
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Tambah Pengguna
          </Button>
        }
      />
      {loading ? (
        <PageLoader label="Memuat pengguna..." />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<UsersIcon className="h-6 w-6" />} title="Belum ada pengguna" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3">Pengguna</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3">Terdaftar</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data ?? []).map((u) => (
                <tr key={u.id} className="transition hover:bg-slate-50/60">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.fullName || u.username || u.email} size="sm" />
                      <div>
                        <p className="font-semibold text-slate-800">{u.fullName || u.username || '—'}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge className={u.role === 'admin' ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    {u.activeSubscription?.plan ? (
                      <div>
                        <p className="text-sm font-medium text-slate-700">{u.activeSubscription.plan.name}</p>
                        <Badge className={subscriptionStatusMeta(u.activeSubscription.status).className}>
                          {subscriptionStatusMeta(u.activeSubscription.status).label}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Tanpa langganan</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <Badge className={u.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}>
                      {u.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="xs" variant={u.isActive ? 'secondary' : 'dark'} onClick={() => void toggleUser(u)} loading={busyId === u.id}>
                        {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                      <Button size="xs" variant="ghost" className="text-rose-500" onClick={() => setDeleteTarget(u)} icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Hapus pengguna" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tambah Pengguna"
        size="md"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Batal</Button>
            <Button onClick={() => void createUser()} loading={saving}>Simpan</Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
          <Input label="Nama Lengkap" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <Select label="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        danger
        title="Hapus pengguna?"
        description={`Semua data milik ${deleteTarget?.email ?? 'pengguna ini'} (postingan, media, langganan, pembayaran) akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus"
        onConfirm={deleteUser}
        loading={deleting}
      />
    </Card>
  );
}

function PostsAdmin() {
  const { data, loading, refetch } = useFetch<Post[]>(() => api.post('/posts/scope/admin/all'));
  const posts = (data ?? []) as (Post & { user?: { email: string } })[];

  return (
    <Card>
      <CardHeader
        icon={<FileText className="h-4 w-4" />}
        title="Semua Postingan"
        description={`${posts.length} postingan dari seluruh pengguna`}
        action={
          <Button size="sm" variant="secondary" onClick={() => refetch()} icon={<RefreshCw className="h-4 w-4" />}>
            Segarkan
          </Button>
        }
      />
      {loading ? (
        <PageLoader label="Memuat postingan..." />
      ) : posts.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="Belum ada postingan" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3">Pengguna</th>
                <th className="px-4 py-3">Konten</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {posts.map((p) => {
                const meta = postStatusMeta(p.status);
                return (
                  <tr key={p.id} className="transition hover:bg-slate-50/60">
                    <td className="px-6 py-3.5">
                      <p className="font-semibold text-slate-800">{p.user?.email ?? '—'}</p>
                      <p className="text-xs text-slate-400">{p.postType}</p>
                    </td>
                    <td className="max-w-xs px-4 py-3.5">
                      <p className="truncate text-slate-700">{p.caption || p.title || 'Tanpa caption'}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {(p.accounts ?? []).slice(0, 3).map((pa) => (
                          <PlatformIcon key={pa.accountId} provider={pa.account?.provider ?? ''} size="h-4 w-4" />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge className={meta.className} dot={meta.dot}>{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">{formatDate(p.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function PlansAdmin() {
  const toast = useToast();
  const { data, loading, refetch } = useFetch<Plan[]>(() => api.get('/admin/plans'));
  const [edit, setEdit] = useState<Plan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [form, setForm] = useState<Partial<Plan>>({});
  const [saving, setSaving] = useState(false);

  const openEdit = (plan: Plan | null) => {
    setEdit(plan ?? ({ name: '', slug: '', description: '', price: 0, currency: 'USD', billingPeriodDays: 30, maxAccounts: 1, maxPostsPerMonth: 10, aiPerMonth: 20, isActive: true } as Plan));
    setForm(plan ?? {});
  };

  const savePlan = async () => {
    if (!form.name || form.price == null) {
      toast.warning('Lengkapi data', 'Nama dan harga wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      if (edit?.id) {
        await api.patch(`/admin/plans/${edit.id}`, form);
        toast.success('Paket diperbarui');
      } else {
        await api.post('/admin/plans', form);
        toast.success('Paket dibuat');
      }
      setEdit(null);
      refetch();
    } catch (err) {
      toast.error('Gagal menyimpan paket', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async () => {
    if (!deleteTarget) return;
    await api.delete(`/admin/plans/${deleteTarget.id}`);
    toast.success('Paket dihapus');
    refetch();
  };

  return (
    <Card>
      <CardHeader
        icon={<Receipt className="h-4 w-4" />}
        title="Manajemen Paket"
        description="Atur harga dan batas kuota setiap paket"
        action={
          <Button size="sm" onClick={() => openEdit(null)} icon={<Plus className="h-4 w-4" />}>
            Tambah Paket
          </Button>
        }
      />
      {loading ? (
        <PageLoader label="Memuat paket..." />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<Receipt className="h-6 w-6" />} title="Belum ada paket" />
      ) : (
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-200 p-5 transition hover:shadow-cardHover">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{p.name}</h3>
                  <p className="text-xs text-slate-400">{p.slug}</p>
                </div>
                <Badge className={p.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}>
                  {p.isActive ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">
                {formatCurrency(p.price, p.currency)}
                <span className="text-sm font-normal text-slate-400"> /bulan</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 py-2"><span className="block font-bold text-slate-800">{p.maxAccounts}</span><span className="text-slate-400">akun</span></div>
                <div className="rounded-lg bg-slate-50 py-2"><span className="block font-bold text-slate-800">{p.maxPostsPerMonth}</span><span className="text-slate-400">posting</span></div>
                <div className="rounded-lg bg-slate-50 py-2"><span className="block font-bold text-slate-800">{p.aiPerMonth}</span><span className="text-slate-400">AI</span></div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => openEdit(p)} icon={<Pencil className="h-4 w-4" />}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => setDeleteTarget(p)} icon={<Trash2 className="h-4 w-4" />}>
                  Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit Paket' : 'Tambah Paket'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setEdit(null)}>Batal</Button>
            <Button onClick={() => void savePlan()} loading={saving}>Simpan</Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nama" value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Slug" value={form.slug ?? ''} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          <Input label="Deskripsi" value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label="Harga" type="number" value={form.price ?? 0} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} />
          <Input label="Mata Uang" value={form.currency ?? 'USD'} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
          <Input label="Periode (hari)" type="number" value={form.billingPeriodDays ?? 30} onChange={(e) => setForm((f) => ({ ...f, billingPeriodDays: Number(e.target.value) }))} />
          <Input label="Maks. Akun" type="number" value={form.maxAccounts ?? 1} onChange={(e) => setForm((f) => ({ ...f, maxAccounts: Number(e.target.value) }))} />
          <Input label="Maks. Posting/Bulan" type="number" value={form.maxPostsPerMonth ?? 10} onChange={(e) => setForm((f) => ({ ...f, maxPostsPerMonth: Number(e.target.value) }))} />
          <Input label="Kuota AI/Bulan" type="number" value={form.aiPerMonth ?? 20} onChange={(e) => setForm((f) => ({ ...f, aiPerMonth: Number(e.target.value) }))} />
          <div className="flex items-end pb-2">
            <Switch checked={!!form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Aktif" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        danger
        title="Hapus paket?"
        description="Paket yang masih dipakai subscription tidak dapat dihapus."
        confirmLabel="Hapus"
        onConfirm={deletePlan}
      />
    </Card>
  );
}

function PendingAdmin() {
  const toast = useToast();
  const { data, loading, refetch } = useFetch<PendingSubscription[]>(() => api.get('/admin/subscriptions/pending'));
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const confirmSub = async (id: string) => {
    setConfirmId(id);
    try {
      await api.post(`/admin/subscriptions/${id}/confirm`);
      toast.success('Langganan dikonfirmasi', 'Pengguna diaktifkan dan email konfirmasi terkirim.');
      refetch();
    } catch (err) {
      toast.error('Gagal konfirmasi', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setConfirmId(null);
    }
  };

  const openProof = (url: string) => setProofPreview(url);

  return (
    <Card>
      <CardHeader icon={<Check className="h-4 w-4" />} title="Langganan Menunggu Konfirmasi" description="Verifikasi pembayaran manual pengguna" />
      {loading ? (
        <PageLoader label="Memuat..." />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<Check className="h-6 w-6" />} title="Tidak ada yang menunggu" description="Semua langganan sudah diproses." />
      ) : (
        <div className="divide-y divide-slate-50">
          {(data ?? []).map((s) => {
            const payment = s.payment?.[0];
            return (
              <div key={s.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <Avatar name={s.user.fullName || s.user.email} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{s.user.fullName || s.user.email}</p>
                    <p className="text-xs text-slate-400">{s.user.email}</p>
                    {payment && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatCurrency(payment.amount, payment.currency)} · {formatDateTime(payment.createdAt)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="bg-brand-50 text-brand-700 ring-brand-200">{s.plan?.name}</Badge>
                  <Badge className={subscriptionStatusMeta(s.status).className}>{subscriptionStatusMeta(s.status).label}</Badge>
                  <span className="hidden text-sm text-slate-400 sm:inline">via {s.paymentMethod}</span>
                  {s.paymentProof && (
                    <Button size="sm" variant="secondary" onClick={() => openProof(s.paymentProof!)} icon={<ImageIcon className="h-4 w-4" />}>
                      Lihat Bukti
                    </Button>
                  )}
                  <Button size="sm" onClick={() => void confirmSub(s.id)} loading={confirmId === s.id} icon={confirmId !== s.id ? <Check className="h-4 w-4" /> : undefined}>
                    Konfirmasi
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!proofPreview}
        onClose={() => setProofPreview(null)}
        title="Bukti Pembayaran"
        size="lg"
        footer={
          proofPreview && (
            <a
              href={proofPreview}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
            >
              Buka di tab baru
            </a>
          )
        }
      >
        {proofPreview && (
          <img src={proofPreview} alt="Bukti pembayaran" className="max-h-[60vh] w-full rounded-xl border border-slate-200 object-contain" />
        )}
      </Modal>
    </Card>
  );
}

function FlagsAdmin() {
  const toast = useToast();
  const { data, loading, refetch } = useFetch<FeatureFlag[]>(() => api.get('/admin/features'));
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const toggle = async (flag: FeatureFlag) => {
    setBusyKey(flag.key);
    try {
      await api.patch(`/admin/features/${flag.key}`, { enabled: !flag.enabled });
      toast.success(`${flag.name} ${!flag.enabled ? 'diaktifkan' : 'dinonaktifkan'}`);
      refetch();
    } catch (err) {
      toast.error('Gagal memperbarui', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Card>
      <CardHeader icon={<ToggleLeft className="h-4 w-4" />} title="Feature Flags" description="Nyalakan atau matikan fitur platform secara global" />
      {loading ? (
        <PageLoader label="Memuat flags..." />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<ToggleLeft className="h-6 w-6" />} title="Belum ada flags" />
      ) : (
        <div className="divide-y divide-slate-50">
          {(data ?? []).map((flag) => (
            <div key={flag.key} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{flag.name}</p>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{flag.key}</code>
                </div>
                {flag.description && <p className="mt-0.5 text-xs text-slate-400">{flag.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                {busyKey === flag.key && <RefreshCw className="h-4 w-4 animate-spin text-slate-300" />}
                <Switch checked={flag.enabled} onChange={() => void toggle(flag)} disabled={busyKey === flag.key} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PaymentsAdmin() {
  const toast = useToast();
  const { data, loading, refetch } = useFetch<string[]>(() => api.get('/admin/payments/methods'));
  const settings = useFetch<PaymentSetting[]>(() => api.get('/admin/payments/settings'));
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingSetting, setSavingSetting] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const ALL_METHODS = ['manual', 'stripe', 'tripay', 'midtrans'];

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/admin/payments/methods', { methods: selected });
      toast.success('Metode pembayaran diperbarui');
      refetch();
    } catch (err) {
      toast.error('Gagal menyimpan', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s: PaymentSetting) => {
    setEditingKey(s.key);
    setEditValue(s.value ?? '');
  };

  const saveSetting = async (key: string) => {
    setSavingSetting(true);
    try {
      await api.post(`/admin/payments/settings/${key}`, { value: editValue });
      toast.success('Informasi pembayaran diperbarui');
      setEditingKey(null);
      settings.refetch();
    } catch (err) {
      toast.error('Gagal menyimpan', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSavingSetting(false);
    }
  };

  const deleteSetting = async (key: string) => {
    if (!window.confirm(`Hapus pengaturan "${key}"?`)) return;
    setDeletingKey(key);
    try {
      await api.delete(`/admin/payments/settings/${key}`);
      toast.success('Pengaturan dihapus');
      settings.refetch();
    } catch (err) {
      toast.error('Gagal menghapus', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={<CreditCard className="h-4 w-4" />} title="Metode Pembayaran" description="Pilih gateway yang aktif untuk proses berlangganan" />
        <CardBody className="space-y-5">
          {loading ? (
            <PageLoader label="Memuat..." />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {ALL_METHODS.map((m) => {
                  const checked = (selected.length ? selected : data ?? []).includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => setSelected((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                        checked ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-200' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-lg">{m === 'manual' ? '🏦' : m === 'stripe' ? '💳' : m === 'tripay' ? '🪙' : '💠'}</span>
                      <span className="flex-1 capitalize text-sm font-semibold text-slate-800">{m}</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${checked ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300'}`}>
                        {checked && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => void save()} loading={saving} disabled={selected.length === 0}>
                  Simpan Pengaturan
                </Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={<Receipt className="h-4 w-4" />}
          title="Informasi Pembayaran Manual"
          description="Nomor rekening & data bank tujuan yang ditampilkan ke pengguna saat transfer manual"
        />
        {settings.loading ? (
          <PageLoader label="Memuat..." />
        ) : (settings.data ?? []).length === 0 ? (
          <EmptyState icon={<Receipt className="h-6 w-6" />} title="Belum ada pengaturan" description="Tambahkan informasi rekening untuk pembayaran manual." />
        ) : (
          <div className="divide-y divide-slate-50">
            {(settings.data ?? []).map((s) => (
              <div key={s.key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{s.label}</p>
                  <p className="text-xs text-slate-400">
                    {editingKey === s.key ? 'Isi nilai baru lalu simpan.' : s.value || <span className="italic">Belum diisi</span>}
                  </p>
                </div>
                {editingKey === s.key ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={s.placeholder}
                      className="w-56"
                    />
                    <Button size="sm" onClick={() => void saveSetting(s.key)} loading={savingSetting}>
                      Simpan
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>
                      Batal
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    {s.value && <code className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-semibold text-slate-700">{s.value}</code>}
                    <Button size="sm" variant="ghost" onClick={() => startEdit(s)} icon={<Pencil className="h-3.5 w-3.5" />}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void deleteSetting(s.key)} loading={deletingKey === s.key} icon={<Trash2 className="h-3.5 w-3.5" />}>
                      Hapus
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const AI_PROVIDER_META: { key: string; label: string; icon: string }[] = [
  { key: 'openai', label: 'OpenAI', icon: '🤖' },
  { key: 'anthropic', label: 'Anthropic', icon: '🟠' },
  { key: 'gemini', label: 'Gemini', icon: '✨' },
];

function maskValue(v?: string): string {
  if (!v) return '';
  if (v.length <= 8) return '••••••••';
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

function isSecretKey(key: string): boolean {
  return key.endsWith('_api_key');
}

function AiAdmin() {
  const toast = useToast();
  const { data, loading, refetch } = useFetch<AiSetting[]>(() => api.get('/admin/ai/settings'));
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingSetting, setSavingSetting] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const settings = data ?? [];
  const activeProvider = settings.find((s) => s.key === 'active_provider')?.value || '';
  const credentialSettings = settings.filter((s) => s.key !== 'active_provider');

  const isModelKey = (key: string) => key.endsWith('_model');
  const getProviderFromKey = (key: string) => key.replace('_model', '').replace('_api_key', '');

  const fetchModels = async (provider: string) => {
    const apiKeySetting = settings.find((s) => s.key === `${provider}_api_key`);
    const apiKey = apiKeySetting?.value || '';
    if (!apiKey) {
      setAvailableModels([]);
      return;
    }
    setLoadingModels(true);
    try {
      const models = await api.get<string[]>(`/admin/ai/models/${provider}?key=${encodeURIComponent(apiKey)}`);
      setAvailableModels(models ?? []);
    } catch {
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const saveProvider = async (provider: string) => {
    setSavingProvider(provider);
    try {
      await api.post('/admin/ai/settings/active_provider', { value: provider });
      toast.success('Provider AI aktif diperbarui');
      refetch();
    } catch (err) {
      toast.error('Gagal menyimpan', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSavingProvider(null);
    }
  };

  const startEdit = async (s: AiSetting) => {
    setEditingKey(s.key);
    setEditValue(isSecretKey(s.key) ? '' : s.value ?? '');
    if (isModelKey(s.key)) {
      const provider = getProviderFromKey(s.key);
      await fetchModels(provider);
    }
  };

  const saveSetting = async (key: string) => {
    if (isSecretKey(key) && !editValue.trim()) {
      toast.warning('Isi nilai baru', 'Kosongkan untuk mempertahankan nilai saat ini.');
      return;
    }
    setSavingSetting(true);
    try {
      await api.post(`/admin/ai/settings/${key}`, { value: editValue });
      toast.success('Pengaturan AI diperbarui');
      setEditingKey(null);
      refetch();
    } catch (err) {
      toast.error('Gagal menyimpan', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSavingSetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={<Sparkles className="h-4 w-4" />}
          title="Provider AI Aktif"
          description="Pilih provider yang dipakai untuk semua fitur AI (auto reply, dsb.)"
        />
        <CardBody className="space-y-5">
          {loading ? (
            <PageLoader label="Memuat..." />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {AI_PROVIDER_META.map((p) => {
                  const checked = activeProvider === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => void saveProvider(p.key)}
                      disabled={savingProvider !== null}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                        checked ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-200' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xl">{p.icon}</span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-slate-800">{p.label}</span>
                        <span className="block text-xs text-slate-400">{checked ? 'Aktif' : 'Klik untuk aktifkan'}</span>
                      </span>
                      {savingProvider === p.key ? (
                        <RefreshCw className="h-4 w-4 animate-spin text-brand-500" />
                      ) : (
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${checked ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300'}`}>
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <Sparkles className="h-3.5 w-3.5" />
                Provider aktif: <Badge className="bg-brand-50 text-brand-700 ring-brand-200">{activeProvider || 'openai'}</Badge>
              </p>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={<Save className="h-4 w-4" />}
          title="Kredensial & Model AI"
          description="API key dan model tiap provider. Nilai API key hanya disimpan di server."
        />
        {loading ? (
          <PageLoader label="Memuat..." />
        ) : credentialSettings.length === 0 ? (
          <EmptyState icon={<Sparkles className="h-6 w-6" />} title="Belum ada pengaturan" />
        ) : (
          <div className="divide-y divide-slate-50">
            {credentialSettings.map((s) => {
              const secret = isSecretKey(s.key);
              const display = secret ? maskValue(s.value) : s.value || '';
              return (
                <div key={s.key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{s.label}</p>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{s.key}</code>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {editingKey === s.key
                        ? secret
                          ? 'Ketik API key baru untuk mengganti (kosongkan untuk mempertahankan).'
                          : 'Isi nilai baru lalu simpan.'
                        : display || <span className="italic">Belum diisi</span>}
                    </p>
                  </div>
                  {editingKey === s.key ? (
                    <div className="flex items-center gap-2">
                      {isModelKey(s.key) ? (
                        <div className="flex items-center gap-2">
                          {loadingModels ? (
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Memuat model...
                            </div>
                          ) : (
                            <Select
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-64"
                            >
                              <option value="">Pilih model...</option>
                              {availableModels.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                              {editValue && !availableModels.includes(editValue) && (
                                <option value={editValue}>{editValue} (custom)</option>
                              )}
                            </Select>
                          )}
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="Atau ketik manual"
                            className="w-48"
                          />
                        </div>
                      ) : (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder={s.placeholder || (isSecretKey(s.key) ? 'API key baru' : 'Isi nilai')}
                          type={isSecretKey(s.key) ? 'password' : 'text'}
                          className="w-56"
                        />
                      )}
                      <Button size="sm" onClick={() => void saveSetting(s.key)} loading={savingSetting}>
                        Simpan
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingKey(null); setAvailableModels([]); }}>
                        Batal
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      {display && (
                        <code className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-semibold text-slate-700">{display}</code>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => startEdit(s)} icon={<Pencil className="h-3.5 w-3.5" />}>
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
