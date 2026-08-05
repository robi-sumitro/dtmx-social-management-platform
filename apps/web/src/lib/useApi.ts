import { useCallback, useEffect, useRef, useState } from 'react';

interface UseFetchResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  intervalMs?: number,
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((result) => {
        if (mounted.current) setData(result);
      })
      .catch((err: unknown) => {
        if (mounted.current) {
          setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
        }
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    if (intervalMs && intervalMs > 0) {
      const timer = window.setInterval(() => {
        if (mounted.current) setTick((t) => t + 1);
      }, intervalMs);
      return () => {
        mounted.current = false;
        window.clearInterval(timer);
      };
    }
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, error, loading, refetch };
}

export async function tryRequest<T>(promise: Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await promise;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan' };
  }
}
