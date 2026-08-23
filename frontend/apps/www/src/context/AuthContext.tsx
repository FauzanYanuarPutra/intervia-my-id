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
import { clearChatMessageCache } from '@/lib/chatMessageCache';
import { getLocaleFromPathname, isSupportedLocale } from '@/lib/locale';
import { clearPersonalAiCache } from '@/lib/personal-ai/browserCache';
const IS_DEV = process.env.NODE_ENV === 'development';
const LOCALE_COOKIE = 'NEXT_LOCALE';
const CHAT_INBOX_CACHE_PREFIX = 'lajukan:chat-inbox:v1:';
const CHAT_AI_SETTINGS_PREFIX = 'chat_ai_settings:';
const AUTH_SESSION_REQUEST_TIMEOUT_MS = 8_000;

async function fetchAuthBootstrap(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    AUTH_SESSION_REQUEST_TIMEOUT_MS,
  );

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function clearLocalMessagingData(userId: string): Promise<void> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(
        `${CHAT_INBOX_CACHE_PREFIX}${encodeURIComponent(normalizedUserId)}`,
      );
      window.localStorage.removeItem(
        `${CHAT_AI_SETTINGS_PREFIX}${normalizedUserId}`,
      );
    } catch {
      // Storage can be unavailable in private modes; IndexedDB cleanup continues.
    }
  }
  await Promise.allSettled([
    clearChatMessageCache(normalizedUserId),
    clearPersonalAiCache(normalizedUserId),
  ]);
}

async function disconnectLocalChatTransport(): Promise<void> {
  try {
    const { disconnectChatSocket } = await import('@/lib/socket');
    disconnectChatSocket();
  } catch {
    // Authentication cleanup must not depend on the optional chat bundle.
  }
}

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
  avatarStyle?: unknown;
  avatar_style?: unknown;
  sub?: string;
  name?: string;
  username?: string;
  emailVerified?: boolean;
  phone?: string;
  phoneVerified?: boolean;
  hasPassword?: boolean;
  has_password?: boolean;
  bio?: string | null;
  location?: string | null;
  fullName?: string;
  full_name?: string;
  metadata?: {
    avatar_url?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  accessToken: string | null; // Digunakan frontend untuk Authorization Header di Dev
  isAuthenticated: boolean;
  login: (
    username: string,
    password: string,
    options?: {
      silent?: boolean;
      redirectTo?: string;
      captchaToken?: string;
      otpToken?: string;
      otpType?: 'email' | 'phone';
      otpTarget?: string;
    },
  ) => Promise<void>;
  loginWithPhone: (
    phone: string,
    options?: { silent?: boolean; redirectTo?: string; phoneOtpToken?: string },
  ) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
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

function readPlainRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  return value as Record<string, unknown>;
}

function normalizeUserPayload(payload: unknown): User {
  if (!payload || typeof payload !== 'object') return payload as User;

  const base = payload as Record<string, unknown>;

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

  const metadata = readPlainRecord(base.metadata);
  const metadataMedia = readPlainRecord(metadata?.media);
  const extended = readPlainRecord(metadata?.extended);
  const normalizedAvatarUrl =
    readNonEmptyString(base.avatarUrl) ||
    readNonEmptyString(base.avatar_url) ||
    readNonEmptyString(metadata?.avatar_url) ||
    readNonEmptyString(metadataMedia?.avatar_url);

  if (normalizedAvatarUrl) {
    base.avatarUrl = normalizedAvatarUrl;
    base.avatar_url = normalizedAvatarUrl;
  }

  const normalizedAvatarStyle =
    base.avatarStyle ??
    base.avatar_style ??
    metadata?.avatar_style ??
    extended?.avatar_style;

  if (normalizedAvatarStyle !== undefined && normalizedAvatarStyle !== null) {
    base.avatarStyle = normalizedAvatarStyle;
    base.avatar_style = normalizedAvatarStyle;
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
  const currentUserIdRef = useRef('');
  const previousLocalDataOwnerRef = useRef('');

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
    const cacheOwner = currentUserIdRef.current;
    void disconnectLocalChatTransport();
    if (cacheOwner) void clearLocalMessagingData(cacheOwner);
    setUser(null);
    setAccessToken(null);
    refreshPromise.current = null;
    if (typeof window !== 'undefined' && IS_DEV) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('session_id');
    }
  }, []);

  useEffect(() => {
    const nextUserId = user?.id?.trim() || '';
    const previousUserId = previousLocalDataOwnerRef.current;
    currentUserIdRef.current = nextUserId;
    if (previousUserId && previousUserId !== nextUserId) {
      void clearLocalMessagingData(previousUserId);
    }
    previousLocalDataOwnerRef.current = nextUserId;
  }, [user?.id]);

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
        const res = await fetchAuthBootstrap('/api/auth/refresh', {
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
      } catch (error) {
        if (
          IS_DEV &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          hardResetAuth();
        }
        return null;
      } finally {
        refreshPromise.current = null;
      }
    })();

    return refreshPromise.current;
  }, [hardResetAuth]);

  /* ================= FETCH USER (ME) ================= */
  const fetchMe = useCallback(
    async (token: string | null): Promise<boolean> => {
      try {
        const headers: HeadersInit = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetchAuthBootstrap('/api/auth/me', {
          headers,
          credentials: 'include',
        });
        const data = await res.json();

        if (res.ok) {
          const normalizedUser = normalizeUserPayload(data);
          saveAccountSnapshot(normalizedUser);
          setUser(normalizedUser);
          return true;
        }

        if (data.shouldClearLocalAuth || res.status === 401 || res.status === 403) {
          hardResetAuth();
        }
        return false;
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('FetchMe Error:', err);
        }
        return false;
      }
    },
    [hardResetAuth],
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
    async function bootstrapSession(options?: { redirectOnFailure?: boolean }) {
      try {
        const localToken = IS_DEV ? localStorage.getItem('access_token') : null;

        if (IS_DEV && localToken) {
          setAccessToken(localToken);
          const loaded = await fetchMe(localToken);
          if (!loaded && options?.redirectOnFailure) handleInvalidToken();
          return;
        }

        if (!shouldBootstrapSession(pathname)) return;

        const token = await refresh();
        if (token) {
          const loaded = await fetchMe(token);
          if (!loaded && options?.redirectOnFailure) handleInvalidToken();
          return;
        }

        if (options?.redirectOnFailure && isProtectedRoutePath(pathname)) {
          handleInvalidToken();
        }
      } finally {
        setLoading(false);
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

    const onProtectedRoute = isProtectedRoutePath(pathname);
    setLoading(onProtectedRoute);
    void bootstrapSession({ redirectOnFailure: onProtectedRoute });
  }, [bootstrapSession, pathname, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncAuthState = () => {
      const hasMarker = hasAuthMarkerCookie();
      const onProtectedRoute = isProtectedRoutePath(pathname);

      if (user && !hasMarker) {
        hardResetAuth();
        if (onProtectedRoute) redirectToLogin();
        return;
      }

      if (!user && !loading && (hasMarker || onProtectedRoute)) {
        setLoading(onProtectedRoute);
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
  }, [
    bootstrapSession,
    hardResetAuth,
    loading,
    pathname,
    redirectToLogin,
    user,
  ]);

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
    username: string,
    password: string,
    options?: {
      silent?: boolean;
      redirectTo?: string;
      captchaToken?: string;
      otpToken?: string;
      otpType?: 'email' | 'phone';
      otpTarget?: string;
    },
  ) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        ...(options?.captchaToken
          ? { captcha_token: options.captchaToken }
          : {}),
        ...(options?.otpToken
          ? {
              otp_token: options.otpToken,
              otp_type: options.otpType || 'email',
              otp_target: options.otpTarget,
            }
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
      const target = options?.redirectTo || `/${getLocale()}/home`;
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
      const target = options?.redirectTo || `/${getLocale()}/home`;
      router.replace(target);
      router.refresh();
    }
  };

  const register = async (
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      throw new Error(readNonEmptyString(data.error) || 'Register failed');
    }

    const issuedAccessToken = readNonEmptyString(data.access_token);
    const refreshToken = readNonEmptyString(data.refresh_token);
    const sessionId = readNonEmptyString(data.session_id);
    const initialAvatarUrl =
      readNonEmptyString(payload.avatar_url) ||
      readNonEmptyString(payload.avatarUrl);
    const initialMetadata = readPlainRecord(payload.metadata);

    const persistInitialProfile = async (token: string) => {
      if (!initialAvatarUrl) return;
      await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          avatar_url: initialAvatarUrl,
          ...(initialMetadata ? { metadata: initialMetadata } : {}),
        }),
      }).catch(() => null);
    };

    if (IS_DEV) {
      if (issuedAccessToken)
        localStorage.setItem('access_token', issuedAccessToken);
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
      if (sessionId) localStorage.setItem('session_id', sessionId);
    }

    if (issuedAccessToken) {
      setAccessToken(issuedAccessToken);
      await persistInitialProfile(issuedAccessToken);
      await fetchMe(issuedAccessToken);
    } else {
      const token = await refresh();
      if (token) {
        await persistInitialProfile(token);
        await fetchMe(token);
      }
    }

    return data as Record<string, unknown>;
  };

  const logout = async (options?: { redirectTo?: string }) => {
    const cacheOwner = user?.id?.trim() || currentUserIdRef.current;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (data.shouldClearLocalAuth === true || IS_DEV) {
        hardResetAuth();
      }
    } catch {
      hardResetAuth();
    } finally {
      await disconnectLocalChatTransport();
      if (cacheOwner) {
        await Promise.race([
          clearLocalMessagingData(cacheOwner),
          new Promise<void>(resolve => window.setTimeout(resolve, 1_000)),
        ]);
      }
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
