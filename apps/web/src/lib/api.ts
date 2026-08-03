import type { ApiError, AuthTokens } from './types';

export const API_BASE = (import.meta.env.VITE_API_BASE as string) || '';

const ACCESS_KEY = 'dtmx_access_token';
const REFRESH_KEY = 'dtmx_refresh_token';

let tokens: AuthTokens | null = null;
let refreshPromise: Promise<string> | null = null;

export function getAccessToken(): string | null {
  return tokens?.accessToken ?? localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return tokens?.refreshToken ?? localStorage.getItem(REFRESH_KEY);
}

export function setTokens(next: AuthTokens | null): void {
  tokens = next;
  if (next) {
    localStorage.setItem(ACCESS_KEY, next.accessToken);
    localStorage.setItem(REFRESH_KEY, next.refreshToken);
  } else {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}

function parseError(body: string): string {
  try {
    const parsed = JSON.parse(body) as ApiError;
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
    if (parsed.error) return parsed.error;
    return body;
  } catch {
    return body || 'Terjadi kesalahan';
  }
}

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('NO_REFRESH');
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) throw new Error('REFRESH_FAILED');
    const data = (await res.json()) as AuthTokens;
    setTokens(data);
    return data.accessToken;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export interface RequestOptions extends RequestInit {
  retry?: boolean;
  skipAuth?: boolean;
}

async function rawRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  const { retry = true, skipAuth = false, headers, ...rest } = options;
  const token = getAccessToken();
  const finalHeaders = new Headers(headers);
  if (!(rest.body instanceof FormData)) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  if (token && !skipAuth) {
    finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  if (res.status === 401 && retry && !skipAuth) {
    try {
      const newToken = await refreshAccessToken();
      const retryHeaders = new Headers(finalHeaders);
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
      return fetch(`${API_BASE}/api${path}`, {
        ...rest,
        headers: retryHeaders,
      });
    } catch {
      setTokens(null);
      throw new Error('Sesi berakhir, silakan masuk kembali');
    }
  }
  return res;
}

export async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const res = await rawRequest(path, options);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseError(text));
  }
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { method: 'GET', ...options }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'POST', body: body == null ? undefined : JSON.stringify(body), ...options }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'PATCH', body: body == null ? undefined : JSON.stringify(body), ...options }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'PUT', body: body == null ? undefined : JSON.stringify(body), ...options }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { method: 'DELETE', ...options }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
};

export function mediaUrl(filename?: string): string {
  if (!filename) return '';
  return `${API_BASE}/uploads/${filename}`;
}

export function oauthUrl(provider: 'google' | 'facebook'): string {
  return `${API_BASE}/api/auth/${provider}`;
}
