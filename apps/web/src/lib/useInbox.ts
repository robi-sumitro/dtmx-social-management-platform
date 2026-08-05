import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { InboxItem } from '@/lib/types';

export interface InboxState {
  items: InboxItem[];
  counts: Record<string, number>;
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  setPaused: (paused: boolean) => void;
}

const INIT_COUNTS: Record<string, number> = { all: 0, new: 0, replied: 0, ignored: 0, queued: 0 };
const POLL_MS = 30000;

/** Identik di semua field yang tampil → pertahankan referensi lama (anti re-render). */
function sameItem(a: InboxItem, b: InboxItem): boolean {
  return (
    a.status === b.status &&
    a.authorName === b.authorName &&
    a.content === b.content &&
    a.replyContent === b.replyContent &&
    a.createdAt === b.createdAt &&
    a.parentId === b.parentId &&
    a.mediaUrl === b.mediaUrl
  );
}

/** Merge inkremental: item lama yang tidak berubah tetap pakai objek lama. */
function mergeItems(prev: InboxItem[], incoming: InboxItem[]): InboxItem[] {
  const byId = new Map<string, InboxItem>();
  for (const i of incoming) byId.set(i.id, i);
  for (const old of prev) {
    const upd = byId.get(old.id);
    if (upd && sameItem(old, upd)) byId.set(old.id, old);
  }
  return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

/**
 * State inbox yang tidak mengganggu aktivitas membaca:
 *  - List penuh hanya dimuat saat awal / aksi manual.
 *  - Polling badge memakai /inbox/counts (ringan).
 *  - Item baru di-merge inkremental via ?since= (tidak mengganti seluruh list,
 *    tidak me-render ulang baris yang tidak berubah).
 *  - Merge dihentikan (pause) saat user sedang membaca/ mengetik.
 */
export function useInbox(accountId: string): InboxState {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ ...INIT_COUNTS });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastSeenRef = useRef<string | null>(null);
  const pausedRef = useRef(false);
  const sessionRef = useRef(0);

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
  }, []);

  const bumpSession = useCallback(() => {
    sessionRef.current += 1;
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      const data = await api.get<{ total: number; counts: Record<string, number> }>(
        `/inbox/counts${qs({ accountId })}`,
      );
      setCounts((prev) => ({ ...prev, ...data.counts, all: data.total }));
      setTotal(data.total);
    } catch {
      // badge polling tidak kritis; biarkan nilai lama
    }
  }, [accountId]);

  /* Muat ulang penuh (awal mount, ganti akun, atau aksi manual). */
  useEffect(() => {
    const session = ++sessionRef.current;
    let disposed = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await api.get<{ items: InboxItem[]; total: number; counts: Record<string, number> }>(
          `/inbox${qs({ accountId, limit: 500 })}`,
        );
        if (disposed || sessionRef.current !== session) return;
        let max = lastSeenRef.current;
        for (const it of data.items) {
          if (!max || it.createdAt > max) max = it.createdAt;
        }
        lastSeenRef.current = max || null;
        setItems(data.items);
        setCounts((prev) => ({ ...prev, ...(data.counts ?? {}), all: data.total }));
        setTotal(data.total);
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        if (!disposed && sessionRef.current === session) setLoading(false);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [accountId, bumpSession]);

  /* Polling badge setiap 30 detik (ringan, tidak mengganggu daftar). */
  useEffect(() => {
    void loadCounts();
    const t = window.setInterval(() => void loadCounts(), POLL_MS);
    return () => window.clearInterval(t);
  }, [loadCounts]);

  /* Polling item baru: merge inkremental, dijeda saat membaca/ mengetik. */
  useEffect(() => {
    const poll = async () => {
      if (pausedRef.current || document.hidden) return;
      const since = lastSeenRef.current;
      if (!since) return;
      try {
        const data = await api.get<{ items: InboxItem[] }>(
          `/inbox${qs({ accountId, since, limit: 100 })}`,
        );
        if (!data.items.length) return;
        setItems((prev) => mergeItems(prev, data.items));
        let max = since;
        for (const it of data.items) if (it.createdAt > max) max = it.createdAt;
        lastSeenRef.current = max;
      } catch {
        // dibiarkan; polling berikutnya yang mencoba lagi
      }
    };
    const t = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(t);
  }, [accountId, bumpSession]);

  const refetch = useCallback(() => {
    bumpSession();
  }, [bumpSession]);

  return { items, counts, total, loading, error, refetch, setPaused };
}