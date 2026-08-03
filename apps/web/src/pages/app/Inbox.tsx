import { useEffect, useState } from 'react';
import {
  Inbox as InboxIcon,
  MessageSquare,
  Sparkles,
  Send,
  RefreshCw,
  ChevronLeft,
  Bot,
} from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api } from '@/lib/api';
import type { InboxItem, SocialAccount, InboxListResponse } from '@/lib/types';
import { cn, inboxStatusMeta, timeAgo, formatDateTime } from '@/lib/utils';
import { PageHeader, PlatformIcon } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { PageLoader } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';

const KIND_META: Record<string, { label: string; icon: string }> = {
  comment: { label: 'Komentar', icon: '💬' },
  dm: { label: 'DM', icon: '✉️' },
  mention: { label: 'Sebutan', icon: '📣' },
};

export function Inbox() {
  const toast = useToast();
  const { user } = useAuth();
  const [status, setStatus] = useState<'new' | 'all' | 'replied' | 'ignored'>('new');
  const [accountId, setAccountId] = useState('all');
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [autoReplying, setAutoReplying] = useState(false);

  const query = useFetch<InboxListResponse>(
    () => api.get(`/inbox?status=${status === 'all' ? '' : status}&accountId=${accountId === 'all' ? '' : accountId}&limit=100`),
    [status, accountId],
  );
  const accounts = useFetch<SocialAccount[]>(() => api.get('/social-accounts'));

  useEffect(() => {
    if (selected) {
      const fresh = query.data?.items.find((i) => i.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [query.data, selected]);

  const sendReply = async (useAI = false) => {
    if (!selected) return;
    if (!useAI && !replyText.trim()) {
      toast.warning('Tulis balasan', 'Ketik balasan atau gunakan AI.');
      return;
    }
    setSending(true);
    try {
      await api.post(`/inbox/${selected.id}/reply`, { text: replyText, useAI });
      toast.success(useAI ? 'Balasan AI terkirim' : 'Balasan terkirim');
      setReplyText('');
      query.refetch();
    } catch (err) {
      toast.error('Gagal mengirim balasan', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSending(false);
    }
  };

  const mark = async (item: InboxItem, nextStatus: string) => {
    await api.patch(`/inbox/${item.id}/status`, { status: nextStatus });
    toast.success('Status diperbarui');
    query.refetch();
  };

  const runAutoReply = async () => {
    if (!selected) return;
    setAutoReplying(true);
    try {
      const res = await api.post<{ replyContent: string }>(`/inbox/${selected.id}/auto-reply`);
      toast.success('Balasan otomatis terkirim', res.replyContent ? 'Lihat hasilnya di bawah.' : undefined);
      setReplyText(res.replyContent ?? '');
      query.refetch();
    } catch (err) {
      toast.error('Gagal auto reply', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setAutoReplying(false);
    }
  };

  const items = query.data?.items ?? [];
  const filtered = status === 'new' ? items.filter((i) => i.status === 'new') : items;
  const selectedDetail = selected ?? filtered[0] ?? null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Inbox"
        description="Semua komentar, DM, dan sebutan dari seluruh akun dalam satu tempat."
        action={
          <Button variant="secondary" onClick={() => query.refetch()} icon={<RefreshCw className="h-4 w-4" />}>
            Segarkan
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {[
                { value: 'new' as const, label: 'Baru', count: items.filter((i) => i.status === 'new').length },
                { value: 'all' as const, label: 'Semua', count: items.length },
                { value: 'replied' as const, label: 'Dibalas', count: items.filter((i) => i.status === 'replied').length },
                { value: 'ignored' as const, label: 'Diabaikan', count: items.filter((i) => i.status === 'ignored').length },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setStatus(t.value)}
                  className={cn(
                    'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    status === t.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600"
            >
              <option value="all">Semua akun</option>
              {(accounts.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.accountName}</option>
              ))}
            </select>
          </div>

          {query.loading ? (
            <PageLoader label="Memuat inbox..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<InboxIcon className="h-6 w-6" />}
              title="Inbox kosong"
              description="Belum ada interaksi pada filter ini. Semua akan muncul di sini."
            />
          ) : (
            <div className="max-h-[70vh] divide-y divide-slate-50 overflow-y-auto">
              {filtered.map((item) => {
                const meta = inboxStatusMeta(item.status);
                const kind = KIND_META[item.kind];
                const active = selectedDetail?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={cn('w-full px-4 py-3.5 text-left transition', active ? 'bg-brand-50/70' : 'hover:bg-slate-50')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base">
                          {item.authorName?.[0]?.toUpperCase() ?? '?'}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{item.authorName || 'Pengguna'}</p>
                          <p className="truncate text-xs text-slate-400">{item.content}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(item.createdAt)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge className={meta.className}>{meta.label}</Badge>
                      <span className="text-xs text-slate-400">{kind?.icon} {kind?.label}</span>
                      {item.account && <PlatformIcon provider={item.account.provider} size="h-3.5 w-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-3">
          {selectedDetail ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  <button className="text-slate-400 lg:hidden" onClick={() => setSelected(null)}>
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-base font-bold text-white">
                    {selectedDetail.authorName?.[0]?.toUpperCase() ?? '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{selectedDetail.authorName || 'Pengguna'}</p>
                    <p className="text-xs text-slate-400">
                      {selectedDetail.account?.accountName ?? 'Akun'} · {formatDateTime(selectedDetail.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={inboxStatusMeta(selectedDetail.status).className}>
                      {inboxStatusMeta(selectedDetail.status).label}
                    </Badge>
                    <Badge className="bg-slate-100 text-slate-600 ring-slate-200">
                      {KIND_META[selectedDetail.kind]?.icon} {KIND_META[selectedDetail.kind]?.label}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4 px-6 py-5">
                <div className="max-w-lg rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3">
                  <p className="text-sm leading-relaxed text-slate-800">{selectedDetail.content || '—'}</p>
                  {selectedDetail.mediaUrl && <img src={selectedDetail.mediaUrl} alt="" className="mt-3 max-h-64 rounded-xl" />}
                </div>

                {selectedDetail.status === 'replied' && (
                  <div className="max-w-lg self-end rounded-2xl rounded-tr-md bg-brand-gradient px-4 py-3 text-white">
                    <p className="text-sm leading-relaxed">Balasan terkirim pada {formatDateTime(selectedDetail.repliedAt)}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedDetail.status !== 'ignored' && (
                    <Button size="sm" variant="secondary" onClick={() => void mark(selectedDetail, 'ignored')}>
                      Tandai Diabaikan
                    </Button>
                  )}
                  {selectedDetail.status !== 'replied' && (
                    <Button size="sm" variant="secondary" onClick={() => void mark(selectedDetail, 'replied')}>
                      Tandai Dibalas
                    </Button>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 p-4">
                <Textarea
                  rows={3}
                  placeholder={`Tulis balasan untuk ${selectedDetail.authorName || 'pengguna'}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="resize-none"
                />
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2.5">
                  <Button
                    variant="ghost"
                    onClick={() => void runAutoReply()}
                    loading={autoReplying}
                    icon={!autoReplying ? <Bot className="h-4 w-4 text-brand-500" /> : undefined}
                    title="Gunakan aturan auto reply"
                  >
                    <span className="flex items-center gap-1">Auto Reply</span>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void sendReply(true)}
                    loading={sending}
                    icon={!sending ? <Bot className="h-4 w-4" /> : undefined}
                    disabled={!user}
                  >
                    <span className="flex items-center gap-1">
                      Balas AI <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                    </span>
                  </Button>
                  <Button onClick={() => void sendReply(false)} loading={sending} icon={!sending ? <Send className="h-4 w-4" /> : undefined}>
                    Kirim Balasan
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title="Pilih percakapan"
              description="Pilih item di daftar kiri untuk melihat detail dan membalas."
              className="h-full"
            />
          )}
        </Card>
      </div>
    </div>
  );
}
