import { useEffect, useState } from 'react';
import {
  Inbox as InboxIcon,
  Sparkles,
  Send,
  RefreshCw,
  Bot,
  Trash2,
} from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { useInbox } from '@/lib/useInbox';
import { api } from '@/lib/api';
import type { InboxItem, SocialAccount } from '@/lib/types';
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

interface ThreadGroup {
  item: InboxItem;
  replies: InboxItem[];
  lastAt: string;
}

/** Kelompokkan item jadi thread: komentar induk + balasan (parentId = sourceId induk). */
function buildThreads(items: InboxItem[]): ThreadGroup[] {
  const bySource = new Map<string, InboxItem>();
  for (const i of items) if (i.sourceId) bySource.set(i.sourceId, i);
  const threads: ThreadGroup[] = [];
  const repliesOf = new Map<string, InboxItem[]>();
  for (const i of items) {
    if (i.parentId && bySource.has(i.parentId)) {
      const arr = repliesOf.get(i.parentId) ?? [];
      arr.push(i);
      repliesOf.set(i.parentId, arr);
    } else {
      threads.push({ item: i, replies: [], lastAt: i.createdAt });
    }
  }
  for (const t of threads) {
    t.replies = (repliesOf.get(t.item.sourceId ?? '') ?? []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    // Thread di-urutkan berdasar pesan TERBARU (termasuk balasan), jadi thread
    // yang mendapat balasan baru otomatis naik ke paling atas.
    t.lastAt = t.replies.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), t.item.createdAt);
  }
  threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return threads;
}

/** Ambil seluruh thread (induk + semua balasan) dari item yang dipilih. */
function threadFor(items: InboxItem[], selected: InboxItem): InboxItem[] {
  const bySource = new Map<string, InboxItem>();
  for (const i of items) if (i.sourceId) bySource.set(i.sourceId, i);
  let root = selected;
  const seen = new Set<string>();
  let node: InboxItem | undefined = selected;
  while (node?.parentId) {
    if (seen.has(node.id)) break;
    seen.add(node.id);
    const parent = bySource.get(node.parentId);
    if (!parent) break;
    root = parent;
    node = parent;
  }
  const replies = items
    .filter((i) => i.parentId && i.parentId === root.sourceId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return [root, ...replies];
}

export function Inbox() {
  const toast = useToast();
  const { user } = useAuth();
  const [status, setStatus] = useState<'new' | 'all' | 'replied' | 'ignored'>('new');
  const [accountId, setAccountId] = useState('all');
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [autoReplying, setAutoReplying] = useState(false);

  // List + badge dikelola useInbox: badge di-poll ringan, item baru di-merge
  // inkremental (tidak mengganti seluruh list), dan dijeda saat membaca/ mengetik.
  const inbox = useInbox(accountId);
  const accounts = useFetch<SocialAccount[]>(() => api.get('/social-accounts'));

  // Jeda merge item-bar-baru sementara user membuka thread / mengetik balasan,
  // supaya daftar tidak melompat saat sedang berkonsentrasi.
  const isFocused = Boolean(selected) || replyText.trim().length > 0;
  useEffect(() => {
    inbox.setPaused(isFocused);
  }, [isFocused, inbox]);

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
      inbox.refetch();
    } catch (err) {
      toast.error('Gagal mengirim balasan', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSending(false);
    }
  };

  const mark = async (item: InboxItem, nextStatus: string) => {
    await api.patch(`/inbox/${item.id}/status`, { status: nextStatus });
    toast.success('Status diperbarui');
    inbox.refetch();
  };

  const removeItem = async (item: InboxItem) => {
    if (!window.confirm('Hapus komentar ini dari channel dan dari inbox?')) return;
    try {
      const res = await api.delete<{ ok: boolean; warning?: string }>(`/inbox/${item.id}`);
      toast.success('Komentar dihapus', res.warning);
      setSelected(null);
      inbox.refetch();
    } catch (err) {
      toast.error('Gagal menghapus', err instanceof Error ? err.message : 'Terjadi kesalahan');
    }
  };

  const runAutoReply = async () => {
    if (!selected) return;
    setAutoReplying(true);
    try {
      const res = await api.post<{ replyContent: string }>(`/inbox/${selected.id}/auto-reply`);
      toast.success('Balasan otomatis terkirim', res.replyContent ? 'Lihat hasilnya di bawah.' : undefined);
      setReplyText(res.replyContent ?? '');
      inbox.refetch();
    } catch (err) {
      toast.error('Gagal auto reply', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setAutoReplying(false);
    }
  };

  const allItems = inbox.items ?? [];
  // "Baru" = komentar terbaru yang masuk (termasuk yang sudah di-auto-reply),
  // hanya komentar yang diabaikan yang disembunyikan. Urut newest-first dari server.
  const filtered =
    status === 'all'
      ? allItems
      : status === 'new'
        ? allItems.filter((i) => i.status !== 'ignored')
        : allItems.filter((i) => i.status === status);
  // Tampilkan sebagai thread: komentar induk dengan balasannya tepat di bawah.
  const threads = buildThreads(filtered);
  const counts = inbox.counts ?? {};
  const countOf = (s: string) => {
    if (s === 'all') return inbox.total ?? allItems.length;
    if (s === 'new') return (inbox.total ?? allItems.length) - (counts.ignored ?? 0);
    return counts[s] ?? allItems.filter((i) => i.status === s).length;
  };
  const selectedDetail = selected ?? threads[0]?.item ?? null;
  const detailThread = selectedDetail ? threadFor(allItems, selectedDetail) : [];
  const selectedKey = selectedDetail ? (detailThread[0]?.sourceId ?? detailThread[0]?.id ?? null) : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Inbox"
        description="Klik komentar/pesan — diskusi dan kotak balasannya langsung muncul di bawahnya."
        action={
          <Button variant="secondary" onClick={() => inbox.refetch()} icon={<RefreshCw className="h-4 w-4" />}>
            Segarkan
          </Button>
        }
      />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[
              { value: 'new' as const, label: 'Baru', count: countOf('new') },
              { value: 'all' as const, label: 'Semua', count: countOf('all') },
              { value: 'replied' as const, label: 'Dibalas', count: countOf('replied') },
              { value: 'ignored' as const, label: 'Diabaikan', count: countOf('ignored') },
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

        {inbox.loading ? (
          <PageLoader label="Memuat inbox..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<InboxIcon className="h-6 w-6" />}
            title="Inbox kosong"
            description="Belum ada interaksi pada filter ini. Semua akan muncul di sini."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {threads.map((t) => {
              const expanded = (t.item.sourceId ?? t.item.id) === selectedKey;
              const row = (item: InboxItem, indent = false) => {
                const meta = inboxStatusMeta(item.status);
                const kind = KIND_META[item.kind];
                const active = selectedDetail?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={cn(
                      'w-full px-4 py-3.5 text-left transition',
                      indent && 'border-l-2 border-brand-100 pl-10',
                      active ? 'bg-brand-50/70' : 'hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base">
                          {item.authorName?.[0]?.toUpperCase() ?? '?'}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {indent && <span className="mr-1 text-brand-400">↳</span>}
                            {item.authorName || 'Pengguna'}
                          </p>
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
                    {item.replyContent && (
                      <p className="mt-1.5 flex items-center gap-1 truncate text-[11px] text-brand-600">
                        <Bot className="h-3 w-3 shrink-0" />
                        <span className="truncate">Balasan: {item.replyContent}</span>
                      </p>
                    )}
                  </button>
                );
              };

              return (
                <div key={t.item.id} className={cn('transition', expanded && 'bg-brand-50/40')}>
                  {row(t.item)}
                  {t.replies.length > 0 && (
                    <div className="relative">
                      <span className="absolute bottom-0 left-4 top-0 w-px bg-slate-200" />
                      {t.replies.map((r) => row(r, true))}
                    </div>
                  )}

                  {expanded && selectedDetail && (
                    <div className="border-t border-brand-100 bg-white px-4 pb-5 pt-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-base font-bold text-white">
                          {selectedDetail.authorName?.[0]?.toUpperCase() ?? '?'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {selectedDetail.authorName || 'Pengguna'}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {selectedDetail.account?.accountName ?? 'Akun'} · {formatDateTime(selectedDetail.createdAt)}
                          </p>
                        </div>
                        <Badge className={inboxStatusMeta(selectedDetail.status).className}>
                          {inboxStatusMeta(selectedDetail.status).label}
                        </Badge>
                        <Badge className="bg-slate-100 text-slate-600 ring-slate-200">
                          {KIND_META[selectedDetail.kind]?.icon} {KIND_META[selectedDetail.kind]?.label}
                        </Badge>
                      </div>

                      <div className="mt-4 space-y-3">
                        {detailThread.map((node) => {
                          const indent = Boolean(node.parentId);
                          return (
                            <div key={node.id} className="flex flex-col gap-2">
                              <div className={cn('max-w-lg rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3', indent && 'ml-8')}>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-600">
                                    {indent && <span className="mr-1 text-brand-400">↳</span>}
                                    {node.authorName || 'Pengguna'}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{formatDateTime(node.createdAt)}</span>
                                </div>
                                <p className="mt-1 text-sm leading-relaxed text-slate-800">{node.content || '—'}</p>
                                {node.mediaUrl && <img src={node.mediaUrl} alt="" className="mt-3 max-h-64 rounded-xl" />}
                              </div>
                              {node.replyContent && (
                                <div className={cn('max-w-lg self-end rounded-2xl rounded-tr-md bg-brand-gradient px-4 py-3 text-white', indent && 'ml-8')}>
                                  <p className="text-sm leading-relaxed">{node.replyContent}</p>
                                  {node.repliedAt && (
                                    <p className="mt-1 text-[10px] text-white/70">
                                      Dibalas {formatDateTime(node.repliedAt)}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
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
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => void removeItem(selectedDetail)}
                          icon={<Trash2 className="h-4 w-4" />}
                        >
                          Hapus
                        </Button>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <Textarea
                          rows={2}
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