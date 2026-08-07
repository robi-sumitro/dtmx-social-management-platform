import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import type { FeatureFlag } from './types';

interface FlagsContextValue {
  flags: FeatureFlag[];
  loading: boolean;
  isEnabled: (key: string) => boolean;
  refresh: () => Promise<void>;
}

const FlagsContext = createContext<FlagsContextValue | null>(null);

export function FlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get<FeatureFlag[]>('/flags', { skipAuth: true });
      setFlags(data);
    } catch {
      // biarkan flags tetap seperti sebelumnya
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isEnabled = useCallback(
    (key: string): boolean => {
      const flag = flags.find((f) => f.key === key);
      return flag ? flag.enabled : true;
    },
    [flags],
  );

  const value = useMemo<FlagsContextValue>(
    () => ({ flags, loading, isEnabled, refresh: load }),
    [flags, loading, isEnabled, load],
  );

  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}

export function useFlags(): FlagsContextValue {
  const ctx = useContext(FlagsContext);
  if (!ctx) throw new Error('useFlags must be used within FlagsProvider');
  return ctx;
}
