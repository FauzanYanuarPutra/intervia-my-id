'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { buildLoginPath, isProtectedRoutePath } from '@/lib/authRoutes';
import { saveAccountSnapshot } from '@/lib/accountVault';
import { getLocaleFromPathname, isSupportedLocale } from '@/lib/locale';

const IS_DEV = process.env.NODE_ENV === 'development';
const LOCALE_COOKIE = 'NEXT_LOCALE';

function readCookieValue(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const pattern = new RegExp(`(?:^|; )${name}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/* ---------------- TYPES ---------------- */
export type User = {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  avatarUrl?: string;
  avatar_url?: string;
  username?: string;
  emailVerified?: boolean;
  phone?: string;
  phoneVerified?: boolean;
  hasPassword?: boolean;
  has_password?: boolean;
  fullName?: string;
  full_name?: string;
  metadata?: {
    avatar_url?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  accessToken: string | null; // Digunakan frontend untuk Authorization Header di Dev
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
    options?: { silent?: boolean; redirectTo?: string; emailOtpToken?: string },
  ) => Promise<void>;
  loginWithPhone: (
    phone: string,
    options?: { silent?: boolean; redirectTo?: string; phoneOtpToken?: string },
  ) => Promise<void>;
  register: (data: any) => Promise<Record<string, unknown>>;
  logout: (options?: { redirectTo?: string }) => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeUserPayload(payload: unknown): User {
  if (!payload || typeof payload !== 'object') return payload as User;

  const base = payload as Record<string, any>;
  const metadata =
    base.metadata && typeof base.metadata === 'object'
      ? (base.metadata as Record<string, any>)
      : undefined;

  const normalizedAvatar =
    readNonEmptyString(base.avatarUrl) ||
    readNonEmptyString(base.avatar_url) ||
    readNonEmptyString(metadata?.avatar_url);

  if (normalizedAvatar) {
    base.avatarUrl = normalizedAvatar;
    base.avatar_url = normalizedAvatar;
    if (metadata) {
      metadata.avatar_url = normalizedAvatar;
      base.metadata = metadata;
    }
  }

  const normalizedHasPassword =
    typeof base.hasPassword === 'boolean'
      ? base.hasPassword
      : typeof base.has_password === 'boolean'
        ? base.has_password
        : undefined;
  if (typeof normalizedHasPassword === 'boolean') {
    base.hasPassword = normalizedHasPassword;
    base.has_password = normalizedHasPassword;
  }

  return base as User;
}

function hasAuthMarkerCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .some(entry => entry.trim().startsWith('auth_present=1'));
}

function shouldBootstrapSession(pathname: string | null | undefined): boolean {
  return hasAuthMarkerCookie() || isProtectedRoutePath(pathname);
}

function readCurrentSearch(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search.replace(/^\?/, '');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshPromise = useRef<Promise<string | null> | null>(null);

  const pathname = usePathname();
  const router = useRouter();

  const getLocale = useCallback(() => {
    const fromPath = getLocaleFromPathname(pathname);
    if (fromPath) return fromPath;
    const fromCookie = readCookieValue(LOCALE_COOKIE);
    if (isSupportedLocale(fromCookie)) return fromCookie;
    return 'id';
  }, [pathname]);

  // Fungsi pembersihan total
  const hardResetAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    refreshPromise.current = null;
    if (typeof window !== 'undefined' && IS_DEV) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('session_id');
    }
  }, []);

  const redirectToLogin = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.location.replace(
      buildLoginPath(getLocale(), pathname, readCurrentSearch()),
    );
  }, [getLocale, pathname]);

  const handleInvalidToken = useCallback(() => {
    hardResetAuth();
    redirectToLogin();
  }, [hardResetAuth, redirectToLogin]);

  /* ================= REFRESH TOKEN ================= */
  const refresh = useCallback(async (): Promise<string | null> => {
    // Pencegahan multiple request refresh secara bersamaan
    if (refreshPromise.current) return refreshPromise.current;

    refreshPromise.current = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          credentials: 'include',
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.shouldClearLocalAuth) hardResetAuth();
          return null;
        }

        // Simpan token baru hasil refresh (khusus Dev)
        if (IS_DEV && data.access_token) {
          localStorage.setItem('access_token', data.access_token);
          setAccessToken(data.access_token);
        } else {
          setAccessToken(data.access_token || null);
        }

        return data.access_token || null;
      } catch {
        if (IS_DEV) hardResetAuth();
        return null;
      } finally {
        refreshPromise.current = null;
      }
    })();

    return refreshPromise.current;
  }, [hardResetAuth]);

  /* ================= FETCH USER (ME) ================= */
  const fetchMe = useCallback(
    async (token: string | null) => {
      try {
        const headers: HeadersInit = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/auth/me', {
          headers,
          credentials: 'include',
        });
        const data = await res.json();

        if (res.ok) {
          const normalizedUser = normalizeUserPayload(data);
          saveAccountSnapshot(normalizedUser);
          setUser(normalizedUser);
        } else {
          if (data.shouldClearLocalAuth) hardResetAuth();
          if (res.status === 401 || res.status === 403) {
            handleInvalidToken();
            return;
          }
        }
      } catch (err) {
        console.error('FetchMe Error:', err);
      } finally {
        setLoading(false);
      }
    },
    [hardResetAuth, handleInvalidToken],
  );

  /* ================= AUTH FETCH (Wrapper) ================= */
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers);
      const credentials = options.credentials ?? 'include';

      // Gunakan token dari state, jika kosong ambil dari local (Dev)
      const currentToken =
        accessToken || (IS_DEV ? localStorage.getItem('access_token') : null);
      if (currentToken) headers.set('Authorization', `Bearer ${currentToken}`);

      let res = await fetch(url, { ...options, headers, credentials });

      // Jika 401, coba refresh otomatis sekali
      if (res.status === 401) {
        const newToken = await refresh();
        if (newToken) {
          headers.set('Authorization', `Bearer ${newToken}`);
          res = await fetch(url, { ...options, headers, credentials });
        } else {
          handleInvalidToken();
          return res;
        }

        if (res.status === 401) {
          handleInvalidToken();
          return res;
        }
      }

      return res;
    },
    [accessToken, refresh, handleInvalidToken],
  );

  const refreshUser = useCallback(async () => {
    const token =
      accessToken || (IS_DEV ? localStorage.getItem('access_token') : null);
    await fetchMe(token);
  }, [accessToken, fetchMe]);

  const bootstrapSession = useCallback(
    async (options?: { redirectOnFailure?: boolean }) => {
      const localToken = IS_DEV ? localStorage.getItem('access_token') : null;

      if (IS_DEV && localToken) {
        setAccessToken(localToken);
        await fetchMe(localToken);
        return;
      }

      if (!shouldBootstrapSession(pathname)) {
        setLoading(false);
        return;
      }

      const token = await refresh();
      if (token) {
        await fetchMe(token);
        return;
      }

      setLoading(false);
      if (options?.redirectOnFailure && isProtectedRoutePath(pathname)) {
        handleInvalidToken();
      }
    },
    [fetchMe, handleInvalidToken, pathname, refresh],
  );

  /* ================= INITIALIZATION ================= */
  useEffect(() => {
    if (user) {
      setLoading(false);
      return;
    }

    if (!shouldBootstrapSession(pathname)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void bootstrapSession({ redirectOnFailure: true });
  }, [bootstrapSession, pathname, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncAuthState = () => {
      const hasMarker = hasAuthMarkerCookie();
      const onProtectedRoute = isProtectedRoutePath(pathname);

      if (user && !hasMarker) {
        handleInvalidToken();
        return;
      }

      if (!user && !loading && (hasMarker || onProtectedRoute)) {
        setLoading(true);
        void bootstrapSession({ redirectOnFailure: onProtectedRoute });
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncAuthState();
    };

    window.addEventListener('focus', syncAuthState);
    window.addEventListener('pageshow', syncAuthState);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', syncAuthState);
      window.removeEventListener('pageshow', syncAuthState);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [bootstrapSession, handleInvalidToken, loading, pathname, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onInvalidToken = () => {
      handleInvalidToken();
    };

    window.addEventListener('auth:invalid-token', onInvalidToken);
    return () =>
      window.removeEventListener('auth:invalid-token', onInvalidToken);
  }, [handleInvalidToken]);

  /* ================= ACTIONS ================= */
  const login = async (
    email: string,
    password: string,
    options?: { silent?: boolean; redirectTo?: string; emailOtpToken?: string },
  ) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        ...(options?.emailOtpToken
          ? { email_otp_token: options.emailOtpToken }
          : {}),
      }),
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Login failed');

    if (IS_DEV) {
      if (data.access_token)
        localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token)
        localStorage.setItem('refresh_token', data.refresh_token);
      if (data.session_id) localStorage.setItem('session_id', data.session_id);
    }

    setAccessToken(data.access_token);
    await fetchMe(data.access_token);
    if (!options?.silent) {
      const target = options?.redirectTo || `/${getLocale()}/dashboard`;
      router.replace(target);
      router.refresh();
    }
  };

  const loginWithPhone = async (
    phone: string,
    options?: { silent?: boolean; redirectTo?: string; phoneOtpToken?: string },
  ) => {
    const normalizedPhone = phone.replace(/\D/g, '');
    const res = await fetch('/api/auth/login-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: normalizedPhone,
        ...(options?.phoneOtpToken
          ? { phone_otp_token: options.phoneOtpToken }
          : {}),
      }),
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Phone login failed');

    if (IS_DEV) {
      if (data.access_token)
        localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token)
        localStorage.setItem('refresh_token', data.refresh_token);
      if (data.session_id) localStorage.setItem('session_id', data.session_id);
    }

    setAccessToken(data.access_token);
    await fetchMe(data.access_token);
    if (!options?.silent) {
      const target = options?.redirectTo || `/${getLocale()}/dashboard`;
      router.replace(target);
      router.refresh();
    }
  };

  const register = async (payload: any): Promise<Record<string, unknown>> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as any)?.error || 'Register failed');
    }

    if (IS_DEV) {
      if ((data as any)?.access_token) {
        localStorage.setItem('access_token', (data as any).access_token);
      }
      if ((data as any)?.refresh_token) {
        localStorage.setItem('refresh_token', (data as any).refresh_token);
      }
      if ((data as any)?.session_id) {
        localStorage.setItem('session_id', (data as any).session_id);
      }
    }

    if ((data as any)?.access_token) {
      setAccessToken((data as any).access_token);
      await fetchMe((data as any).access_token);
    } else {
      const token = await refresh();
      if (token) {
        await fetchMe(token);
      }
    }

    return data as Record<string, unknown>;
  };

  const logout = async (options?: { redirectTo?: string }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if ((data as any).shouldClearLocalAuth || IS_DEV) {
        hardResetAuth();
      }
    } catch {
      hardResetAuth();
    } finally {
      hardResetAuth();
      if (typeof window !== 'undefined') {
        window.location.replace(options?.redirectTo || `/${getLocale()}/login`);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accessToken,
        isAuthenticated: !!user,
        login,
        loginWithPhone,
        register,
        logout,
        authFetch,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
