import { useRef, useState } from 'react';
import {
  CreditCard,
  Check,
  Crown,
  UploadCloud,
  Sparkles,
  Receipt,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api } from '@/lib/api';
import type { Plan, PaymentMethod, Subscription, Payment, UsageResponse, ManualPaymentInfo } from '@/lib/types';
import { cn, formatCurrency, formatDate, subscriptionStatusMeta, paymentStatusMeta, PAYMENT_METHOD_META } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { UsageBar } from '@/components/ui/Progress';

interface SubscribeResult {
  mode: string;
  payment?: Payment;
  subscriptionId?: string;
  payUrl?: string;
  action?: string;
}

export function Billing() {
  const toast = useToast();
  const { user } = useAuth();
  const proofRef = useRef<HTMLInputElement>(null);

  const plans = useFetch<Plan[]>(() => api.get('/subscriptions/plans'));
  const subs = useFetch<Subscription[]>(() => api.get('/subscriptions/mine'));
  const payments = useFetch<Payment[]>(() => api.get('/payments'));
  const usage = useFetch<UsageResponse>(() => api.get('/subscriptions/usage'));
  const activeSub = useFetch<Subscription | null>(() => api.get('/subscriptions/active'));
  const manualInfo = useFetch<ManualPaymentInfo>(() => api.get('/payments/manual-info'));

  const [selected, setSelected] = useState<Plan | null>(null);
  const [step, setStep] = useState<'methods' | 'upload'>('methods');
  const [pendingManualSub, setPendingManualSub] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('manual');
  const [methods, setMethods] = useState<PaymentMethod[]>(['manual', 'stripe', 'tripay', 'midtrans']);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const active = activeSub.data;
  const allPlans = plans.data ?? [];

  const closeModal = () => {
    setSelected(null);
    setPendingManualSub(null);
    setStep('methods');
  };

  const openSubscribe = async (plan: Plan) => {
    setSelected(plan);
    setStep('methods');
    setMethod('manual');
    try {
      const enabled = await api.get<PaymentMethod[]>('/payments/methods');
      if (Array.isArray(enabled) && enabled.length) setMethods(enabled);
    } catch {
      /* keep defaults */
    }
  };

  const subscribe = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      const res = await api.post<SubscribeResult>('/subscriptions/subscribe', {
        planId: selected.id,
        method,
      });
      if (res.mode === 'manual' && res.subscriptionId) {
        setMethod('manual');
        proofRef.current?.setAttribute('data-sub', res.subscriptionId);
        setPendingManualSub(res.subscriptionId);
        setStep('upload');
        toast.info('Pembayaran manual', 'Unggah bukti transfer untuk konfirmasi admin.');
        return;
      }
      if (res.payUrl) {
        window.location.href = res.payUrl;
        return;
      }
      toast.success('Berlangganan', 'Paket kamu telah diaktifkan.');
      setSelected(null);
      activeSub.refetch();
      usage.refetch();
    } catch (err) {
      toast.error('Gagal berlangganan', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setProcessing(false);
    }
  };

  const uploadProof = async (file: File | null, subscriptionId: string | null) => {
    const sub = subscriptionId ?? pendingManualSub ?? proofRef.current?.getAttribute('data-sub');
    if (!file || !sub) {
      toast.warning('Pilih file bukti');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.upload<unknown>(`/subscriptions/${sub}/proof`, formData);
      toast.success('Bukti terunggah', 'Admin akan mengonfirmasi pembayaran kamu.');
      closeModal();
      activeSub.refetch();
      usage.refetch();
      subs.refetch();
    } catch (err) {
      toast.error('Gagal unggah bukti', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setUploading(false);
    }
  };

  const highlight = allPlans.find((p) => p.slug === 'pro')?.id;
  const activePlanId = active?.plan?.id;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Billing & Paket"
        description="Kelola langganan, kuota, dan pembayaran kamu."
      />

      {active && (
        <Card className="relative mb-8 overflow-hidden">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                  <Crown className="h-7 w-7" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">Paket {active.plan?.name}</h2>
                    <Badge className={subscriptionStatusMeta(active.status).className}>{subscriptionStatusMeta(active.status).label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {active.plan?.description} · {formatCurrency(active.plan?.price ?? 0, active.plan?.currency)}
                    {active.expiresAt ? ` · berlaku hingga ${formatDate(active.expiresAt)}` : ''}
                  </p>
                </div>
              </div>
              {active.status === 'pending' && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <UploadCloud className="h-4 w-4" />
                  Menunggu konfirmasi pembayaran
                </div>
              )}
            </div>

            {usage.data?.plan && (
              <div className="mt-6 grid gap-5 sm:grid-cols-3">
                {[
                  { label: 'Akun Sosial', used: usage.data.accountsUsed, max: usage.data.limits.accounts ?? 0 },
                  { label: 'Posting / Bulan', used: usage.data.postsUsed, max: usage.data.limits.posts ?? 0 },
                  { label: 'Kuota AI / Bulan', used: usage.data.aiUsed, max: usage.data.limits.ai ?? 0 },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">{row.label}</span>
                      <span className="text-slate-400">{row.used}/{row.max}</span>
                    </div>
                    <UsageBar value={row.used} max={row.max} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Pilih Paket</h2>
          <p className="text-sm text-slate-500">Upgrade kapan saja, kuota akan aktif seketika.</p>
        </div>
      </div>

      {plans.loading ? (
        <PageLoader label="Memuat paket..." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {allPlans.map((plan) => {
            const isHot = plan.id === highlight;
            const isCurrent = plan.id === activePlanId;
            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex flex-col p-6 transition hover:shadow-cardHover',
                  isHot && 'border-brand-300 ring-2 ring-brand-100',
                )}
              >
                {isHot && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-3 py-1 text-xs font-bold text-white shadow-glow">
                    Populer
                  </span>
                )}
                <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
                <p className="mt-1 min-h-10 text-xs leading-relaxed text-slate-500">{plan.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-900">{formatCurrency(plan.price, plan.currency)}</span>
                  <span className="text-xs text-slate-400">/bulan</span>
                </div>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-600">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500" /> {plan.maxAccounts} akun</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500" /> {plan.maxPostsPerMonth} posting</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500" /> {plan.aiPerMonth} kuota AI</li>
                </ul>
                <Button
                  className="mt-6"
                  variant={isHot ? 'primary' : 'secondary'}
                  onClick={() => void openSubscribe(plan)}
                  disabled={isCurrent}
                >
                  {isCurrent ? 'Paket Aktif' : plan.price === 0 ? 'Gunakan Gratis' : 'Pilih Paket'}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Receipt className="h-4 w-4" />} title="Riwayat Langganan" />
          <CardBody>
            {subs.loading ? (
              <PageLoader label="Memuat..." />
            ) : (subs.data ?? []).length === 0 ? (
              <EmptyState icon={<Receipt className="h-6 w-6" />} title="Belum ada langganan" />
            ) : (
              <div className="space-y-3">
                {(subs.data ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{s.plan?.name}</p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(s.plan?.price ?? 0, s.plan?.currency)} · mulai {formatDate(s.startedAt)}
                      </p>
                    </div>
                    <Badge className={subscriptionStatusMeta(s.status).className}>{subscriptionStatusMeta(s.status).label}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Shield className="h-4 w-4" />} title="Metode Pembayaran" description="Metode yang tersedia untuk paket berbayar" />
          <CardBody className="space-y-3">
            {methods.map((m) => {
              const meta = PAYMENT_METHOD_META[m];
              return (
                <div key={m} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-lg">{meta?.icon ?? '💳'}</span>
                  <span className="flex-1 text-sm font-medium text-slate-700">{meta?.label ?? m}</span>
                  <Badge className="bg-emerald-50 text-emerald-600 ring-emerald-200">Aktif</Badge>
                </div>
              );
            })}
            {payments.loading && <p className="text-xs text-slate-400">Memuat metode...</p>}
            {manualInfo.data?.info.manual_bank_name && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rekening tujuan (manual)</p>
                <div className="mt-1.5 space-y-1">
                  {manualInfo.data.info.manual_bank_name && (
                    <p className="text-slate-600">Bank: <span className="font-semibold text-slate-800">{manualInfo.data.info.manual_bank_name}</span></p>
                  )}
                  {manualInfo.data.info.manual_bank_account && (
                    <p className="text-slate-600">No. Rekening: <span className="font-mono font-semibold text-slate-800">{manualInfo.data.info.manual_bank_account}</span></p>
                  )}
                  {manualInfo.data.info.manual_bank_holder && (
                    <p className="text-slate-600">A/N: <span className="font-semibold text-slate-800">{manualInfo.data.info.manual_bank_holder}</span></p>
                  )}
                </div>
              </div>
            )}
            <p className="flex items-center gap-2 pt-2 text-xs text-slate-400">
              <Sparkles className="h-3.5 w-3.5" />
              Untuk pembayaran manual, upload bukti transfer lalu admin akan mengonfirmasi.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader
            icon={<Receipt className="h-4 w-4" />}
            title="Riwayat Transaksi"
            description="Semua pembayaran yang pernah dilakukan"
          />
          <CardBody>
            {payments.loading ? (
              <PageLoader label="Memuat transaksi..." />
            ) : (payments.data ?? []).length === 0 ? (
              <EmptyState icon={<Receipt className="h-6 w-6" />} title="Belum ada transaksi" description="Transaksi pembayaran kamu akan muncul di sini." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Paket</th>
                      <th className="px-4 py-3">Metode</th>
                      <th className="px-4 py-3">Jumlah</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(payments.data ?? []).map((pay) => (
                      <tr key={pay.id} className="transition hover:bg-slate-50/60">
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{pay.plan?.name ?? 'Paket'}</td>
                        <td className="px-4 py-3.5 capitalize text-slate-500">
                          {PAYMENT_METHOD_META[pay.method]?.label ?? pay.method}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">{formatCurrency(pay.amount, pay.currency)}</td>
                        <td className="px-4 py-3.5">
                          <Badge className={paymentStatusMeta(pay.status).className}>{paymentStatusMeta(pay.status).label}</Badge>
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-500">{formatDate(pay.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <input
        ref={proofRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => void uploadProof(e.target.files?.[0] ?? null, null)}
      />

      <Modal
        open={!!selected}
        onClose={closeModal}
        title={step === 'upload' ? 'Unggah Bukti Transfer' : `Berlangganan ${selected?.name ?? ''}`}
        description={step === 'upload' ? 'Langkah terakhir: kirim bukti pembayaran agar admin dapat mengonfirmasi.' : `${formatCurrency(selected?.price ?? 0, selected?.currency ?? 'USD')} / bulan`}
        footer={
          step === 'upload' ? null : (
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={closeModal}>Batal</Button>
              <Button onClick={() => void subscribe()} loading={processing} disabled={!selected}>
                {method === 'manual' ? 'Mulai & Unggah Bukti' : 'Lanjut ke Pembayaran'}
              </Button>
            </div>
          )
        }
      >
        {step === 'upload' ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Langganan kamu sudah tercatat sebagai <span className="font-medium text-slate-700">menunggu pembayaran</span>.
              Pilih file bukti transfer (gambar atau PDF) di bawah ini.
            </p>
            <button
              type="button"
              onClick={() => proofRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center transition hover:border-brand-400 hover:bg-brand-50/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                <UploadCloud className="h-6 w-6" />
              </span>
              <span className="text-sm font-semibold text-slate-700">Klik untuk memilih file</span>
              <span className="text-xs text-slate-400">JPG, PNG, atau PDF</span>
            </button>
            {uploading && (
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Mengunggah bukti...
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Pilih metode pembayaran:</p>
            <div className="space-y-2.5">
              {methods.map((m) => {
                const meta = PAYMENT_METHOD_META[m];
                return (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition',
                      method === m ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-200' : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">{meta?.icon ?? '💳'}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{meta?.label ?? m}</span>
                      <span className="block text-xs text-slate-400">
                        {m === 'manual' ? 'Transfer bank + upload bukti' : 'Redirect ke gateway pembayaran'}
                      </span>
                    </span>
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border-2', method === m ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300')}>
                      {method === m && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {method === 'manual' && (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-700">
                  Transfer ke rekening di bawah ini, lalu klik "Mulai" dan unggah bukti transfer. Admin akan mengonfirmasi pembayaranmu.
                </div>
                {(manualInfo.data?.info.manual_bank_name || manualInfo.data?.info.manual_bank_account) && (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Data Rekening Tujuan
                    </div>
                    <div className="divide-y divide-slate-50 px-4">
                      {manualInfo.data.info.manual_bank_name && (
                        <div className="flex items-center justify-between py-2.5 text-sm">
                          <span className="text-slate-500">Bank</span>
                          <span className="font-semibold text-slate-800">{manualInfo.data.info.manual_bank_name}</span>
                        </div>
                      )}
                      {manualInfo.data.info.manual_bank_account && (
                        <div className="flex items-center justify-between py-2.5 text-sm">
                          <span className="text-slate-500">Nomor Rekening</span>
                          <span className="font-mono font-semibold text-slate-800">{manualInfo.data.info.manual_bank_account}</span>
                        </div>
                      )}
                      {manualInfo.data.info.manual_bank_holder && (
                        <div className="flex items-center justify-between py-2.5 text-sm">
                          <span className="text-slate-500">Atas Nama</span>
                          <span className="font-semibold text-slate-800">{manualInfo.data.info.manual_bank_holder}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
