import { useState } from 'react';
import {
  Bot,
  Plus,
  Pencil,
  Trash2,
  Wand2,
  MessageSquareText,
  Filter,
} from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api } from '@/lib/api';
import type { AutoReplyRule, SocialAccount } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageHeader, PlatformIcon, ErrorPanel } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

const MATCH_TYPES = [
  { value: 'contains', label: 'Mengandung' },
  { value: 'startsWith', label: 'Dimulai dengan' },
  { value: 'exact', label: 'Sama persis' },
  { value: 'always', label: 'Semua pesan' },
];

interface RuleForm {
  name: string;
  accountId: string;
  matchType: string;
  matchText: string;
  replyTemplate: string;
  useAI: boolean;
  aiPrompt: string;
  enabled: boolean;
}

const EMPTY_FORM: RuleForm = {
  name: '',
  accountId: '',
  matchType: 'contains',
  matchText: '',
  replyTemplate: '',
  useAI: true,
  aiPrompt: '',
  enabled: true,
};

export function AutoReplies() {
  const toast = useToast();
  const { data, error, loading, refetch } = useFetch<AutoReplyRule[]>(() => api.get('/auto-replies'));
  const accounts = useFetch<SocialAccount[]>(() => api.get('/social-accounts'));

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AutoReplyRule | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AutoReplyRule | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rules = data ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (rule: AutoReplyRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      accountId: rule.accountId ?? '',
      matchType: rule.matchType,
      matchText: rule.matchText ?? '',
      replyTemplate: rule.replyTemplate ?? '',
      useAI: rule.useAI,
      aiPrompt: rule.aiPrompt ?? '',
      enabled: rule.enabled,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.warning('Nama wajib diisi', 'Beri nama untuk aturan balasan ini.');
      return;
    }
    if (form.matchType !== 'always' && !form.matchText.trim() && !form.useAI) {
      toast.warning('Lengkapi kriteria', 'Isi teks pemicu atau aktifkan AI.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        accountId: form.accountId || undefined,
      };
      if (editing) {
        await api.patch(`/auto-replies/${editing.id}`, payload);
        toast.success('Aturan diperbarui');
      } else {
        await api.post('/auto-replies', payload);
        toast.success('Aturan dibuat');
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error('Gagal menyimpan aturan', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (rule: AutoReplyRule) => {
    setBusyId(rule.id);
    try {
      await api.patch(`/auto-replies/${rule.id}/toggle`);
      refetch();
    } catch (err) {
      toast.error('Gagal memperbarui', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/auto-replies/${deleteTarget.id}`);
      toast.success('Aturan dihapus');
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error('Gagal menghapus', err instanceof Error ? err.message : 'Terjadi kesalahan');
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Auto Reply"
        description="Balas komentar & DM secara otomatis berdasarkan aturan atau dengan bantuan AI."
        action={
          <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
            Buat Aturan
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Bot className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">Balasan Otomatis dengan AI</p>
            <p className="text-xs text-slate-400">
              Aktifkan aturan untuk membalas interaksi baru secara otomatis, atau pilih "Balas AI" langsung dari Inbox.
            </p>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Fitur Aktif</Badge>
        </div>
      </Card>

      {loading ? (
        <PageLoader label="Memuat aturan..." />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refetch} />
      ) : rules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bot className="h-6 w-6" />}
            title="Belum ada aturan"
            description="Buat aturan balasan otomatis untuk menghemat waktu membalas interaksi."
            action={
              <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
                Buat Aturan Pertama
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rules.map((rule) => (
            <Card key={rule.id} className="flex flex-col p-5 transition hover:shadow-cardHover">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    {rule.useAI ? (
                      <Wand2 className="h-5 w-5 text-brand-600" />
                    ) : (
                      <MessageSquareText className="h-5 w-5 text-slate-500" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{rule.name}</p>
                    <p className="text-xs text-slate-400">
                      {rule.account ? rule.account.accountName : 'Semua akun'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {rule.useAI && (
                    <Badge className="bg-violet-50 text-violet-700 ring-violet-200">AI</Badge>
                  )}
                  <Switch checked={rule.enabled} onChange={() => void toggle(rule)} disabled={busyId === rule.id} />
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium">
                    {MATCH_TYPES.find((m) => m.value === rule.matchType)?.label ?? rule.matchType}
                  </span>
                  {rule.matchText && <span className="truncate">: “{rule.matchText}”</span>}
                </div>
                {rule.replyTemplate && (
                  <p className="line-clamp-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
                    {rule.replyTemplate}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-[11px] text-slate-400">Aturan berjalan otomatis</span>
                <div className="flex items-center gap-1">
                  <Button size="xs" variant="ghost" onClick={() => openEdit(rule)} icon={<Pencil className="h-3.5 w-3.5" />}>
                    Edit
                  </Button>
                  <Button size="xs" variant="ghost" className="text-rose-500" onClick={() => setDeleteTarget(rule)} icon={<Trash2 className="h-3.5 w-3.5" />}>
                    Hapus
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Aturan' : 'Buat Aturan Auto Reply'}
        description="Tentukan pemicu dan cara balasan dikirim."
        size="lg"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={() => void save()} loading={saving}>Simpan Aturan</Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nama Aturan" placeholder="mis. Balasan promo" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            <Select label="Akun" value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}>
              <option value="">Semua akun</option>
              {(accounts.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.accountName}</option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Kriteria Pemicu" value={form.matchType} onChange={(e) => setForm((f) => ({ ...f, matchType: e.target.value }))}>
              {MATCH_TYPES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
            {form.matchType !== 'always' && (
              <Input label="Teks Pemicu" placeholder="mis. harga, promo" value={form.matchText} onChange={(e) => setForm((f) => ({ ...f, matchText: e.target.value }))} />
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Wand2 className="h-4 w-4 text-brand-600" />
                <span className="text-sm font-semibold text-slate-800">Gunakan AI untuk balasan</span>
              </div>
              <Switch checked={form.useAI} onChange={(v) => setForm((f) => ({ ...f, useAI: v }))} />
            </div>
            {form.useAI ? (
              <Textarea
                className="mt-3 resize-none"
                rows={3}
                placeholder="Contoh: Balas dengan nada ramah dan profesional, tawarkan diskon 10% dengan kode DTMX10..."
                value={form.aiPrompt}
                onChange={(e) => setForm((f) => ({ ...f, aiPrompt: e.target.value }))}
              />
            ) : (
              <Textarea
                className="mt-3 resize-none"
                rows={3}
                placeholder="Balasan tetap yang akan dikirim..."
                value={form.replyTemplate}
                onChange={(e) => setForm((f) => ({ ...f, replyTemplate: e.target.value }))}
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Aktifkan aturan</p>
              <p className="text-xs text-slate-400">Aturan nonaktif tidak diproses sampai diaktifkan.</p>
            </div>
            <Switch checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        danger
        title="Hapus aturan?"
        description="Aturan balasan otomatis ini akan dihapus permanen."
        confirmLabel="Hapus"
        onConfirm={remove}
      />
    </div>
  );
}
