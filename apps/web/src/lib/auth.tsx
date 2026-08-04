import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, getAccessToken, getRefreshToken, setTokens } from './api';
import type { AuthTokens, User } from './types';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>('/auth/me');
      setUser(me);
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
    setUser(me);
  }, []);

  const register = useCallback(async (data: { email: string; username: string; password: string; fullName?: string }) => {
    const res = await api.post<AuthTokens>('/auth/register', data);
    setTokens(res);
    const me = await api.get<User>('/auth/me');
    setUser(me);
  }, []);

  const oauthCallback = useCallback(async (accessToken: string, refreshToken: string) => {
    setTokens({ accessToken, refreshToken, user: { id: '', email: '', role: 'user' } });
    const me = await api.get<User>('/auth/me');
    setUser(me);
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
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!getAccessToken() && !getRefreshToken()) return;
    try {
      const me = await api.get<User>('/auth/me');
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
