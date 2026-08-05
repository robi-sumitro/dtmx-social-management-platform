import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, API_BASE, getAccessToken, getRefreshToken, setTokens } from './api';
import { detectTimezone, isTimezoneAuto, setActiveTimezone, setServerClockOffset } from './timezone';
import type { AuthTokens, User } from './types';

async function syncServerClock(): Promise<void> {
  try {
    const before = Date.now();
    const res = await fetch(`${API_BASE}/api/health`, { headers: { Accept: 'application/json' } });
    const after = Date.now();
    if (!res.ok) return;
    const data = (await res.json()) as { time?: string };
    if (data.time) {
      const serverTime = new Date(data.time).getTime();
      // Round-trip latency estimated as half the elapsed time.
      const offset = serverTime - (before + (after - before) / 2);
      setServerClockOffset(offset);
    }
  } catch {
    /* keep default 0 offset */
  }
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; password: string; fullName?: string }) => Promise<void>;
  oauthCallback: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyTimezone(me: User | null): User | null {
  if (!me) {
    setActiveTimezone(null);
    return null;
  }
  setActiveTimezone(isTimezoneAuto() ? detectTimezone() : me.timezone);
  return me;
}

function syncTimezone(me: User): void {
  const detected = detectTimezone();
  const saved = me.timezone || '';
  if (isTimezoneAuto() && saved !== detected) {
    void api
      .patch<User>('/users/me', { timezone: detected })
      .then((updated) => {
        setActiveTimezone(updated.timezone || detected);
      })
      .catch(() => undefined);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    void syncServerClock();
    try {
      const me = await api.get<User>('/auth/me');
      applyTimezone(me);
      setUser(me);
      syncTimezone(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthTokens>('/auth/login', { email, password });
    setTokens(res);
    const me = await api.get<User>('/auth/me');
    applyTimezone(me);
    setUser(me);
    syncTimezone(me);
  }, []);

  const register = useCallback(async (data: { email: string; username: string; password: string; fullName?: string }) => {
    const res = await api.post<AuthTokens>('/auth/register', data);
    setTokens(res);
    const me = await api.get<User>('/auth/me');
    applyTimezone(me);
    setUser(me);
    syncTimezone(me);
  }, []);

  const oauthCallback = useCallback(async (accessToken: string, refreshToken: string) => {
    setTokens({ accessToken, refreshToken, user: { id: '', email: '', role: 'user' } });
    const me = await api.get<User>('/auth/me');
    applyTimezone(me);
    setUser(me);
    syncTimezone(me);
  }, []);

  const logout = useCallback(() => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      void api
        .post('/auth/logout', { refreshToken })
        .catch(() => undefined);
    }
    setTokens(null);
    setUser(null);
    applyTimezone(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!getAccessToken() && !getRefreshToken()) return;
    try {
      const me = await api.get<User>('/auth/me');
      applyTimezone(me);
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((next: User) => setUser(next), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      login,
      register,
      oauthCallback,
      logout,
      refreshProfile,
      updateUser,
    }),
    [user, loading, login, register, oauthCallback, logout, refreshProfile, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
