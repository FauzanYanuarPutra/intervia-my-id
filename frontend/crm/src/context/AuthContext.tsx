'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { authApi, type AuthMeResponse } from '@/lib/api';

const ALLOWED_ROLES = ['sales', 'admin', 'support', 'super_admin'];
const ACCESS_TOKEN_KEY = 'crm_access_token';
const REFRESH_TOKEN_KEY = 'crm_refresh_token';
const SESSION_ID_KEY = 'crm_session_id';
const STEP_UP_KEY = 'crm_stepup_verified_at';
const PENDING_AUTH_KEY = 'crm_pending_auth';

type User = AuthMeResponse;

type AuthBundle = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: User;
};

type SessionConfirmationResponse = {
  success: boolean;
  message?: string;
  purpose?: string;
  delivery?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  isAuthenticated: boolean;
  stepUpVerifiedAt: number | null;
  login: (email: string, password: string) => Promise<void>;
  requestStepUp: () => Promise<SessionConfirmationResponse | null>;
  verifyStepUp: (confirmation: string) => Promise<void>;
  isStepUpFresh: (maxAgeMs?: number) => boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepUpVerifiedAt, setStepUpVerifiedAt] = useState<number | null>(null);
  const router = useRouter();

  const checkAccess = useCallback((roles: string[]) => {
    return roles.some(role =>
      ALLOWED_ROLES.includes(String(role).trim().toLowerCase()),
    );
  }, []);

  const clearPendingLogin = useCallback(() => {
    localStorage.removeItem(PENDING_AUTH_KEY);
  }, []);

  const clearActiveAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setStepUpVerifiedAt(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(STEP_UP_KEY);
  }, []);

  const persistActiveAuth = useCallback(
    (bundle: AuthBundle, verifiedAt: number) => {
      setUser(bundle.user);
      setAccessToken(bundle.accessToken);
      setStepUpVerifiedAt(verifiedAt);
      localStorage.setItem(ACCESS_TOKEN_KEY, bundle.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, bundle.refreshToken);
      localStorage.setItem(SESSION_ID_KEY, bundle.sessionId);
      localStorage.setItem(STEP_UP_KEY, String(verifiedAt));
    },
    [],
  );

  const markSessionConfirmed = useCallback(() => {
    const verifiedAt = Date.now();
    setStepUpVerifiedAt(verifiedAt);
    localStorage.setItem(STEP_UP_KEY, String(verifiedAt));
    return verifiedAt;
  }, []);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedStepUp = Number(localStorage.getItem(STEP_UP_KEY) || '');

    localStorage.removeItem(PENDING_AUTH_KEY);
    setStepUpVerifiedAt(Number.isFinite(storedStepUp) ? storedStepUp : null);

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userData = await authApi.me(token);
      if (!checkAccess(userData.roles || [])) {
        throw new Error('Access denied: insufficient permissions');
      }
      setUser(userData);
      setAccessToken(token);
    } catch {
      clearActiveAuth();
    } finally {
      setLoading(false);
    }
  }, [checkAccess, clearActiveAuth]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login(email, password);
      const roles = response.roles || [];
      if (!checkAccess(roles)) {
        throw new Error(
          'Access denied: You do not have permission to access CRM',
        );
      }

      const userData = await authApi.me(response.access_token);
      if (!checkAccess(userData.roles || [])) {
        throw new Error(
          'Access denied: You do not have permission to access CRM',
        );
      }

      const activeBundle: AuthBundle = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        sessionId: response.session_id,
        user: userData,
      };

      clearPendingLogin();
      persistActiveAuth(activeBundle, Date.now());
      router.push('/');
    },
    [checkAccess, clearPendingLogin, persistActiveAuth, router],
  );

  const requestStepUp = useCallback(async () => {
    if (!user?.email) return null;
    return {
      success: true,
      message:
        'Aksi sensitif akan dikonfirmasi dari sesi agent aktif dan masuk audit trail.',
      purpose: 'login',
      delivery: 'session',
    };
  }, [user?.email]);

  const verifyStepUp = useCallback(
    async () => {
      if (!user?.email) {
        throw new Error('No authenticated CRM user for session confirmation.');
      }
      markSessionConfirmed();
    },
    [markSessionConfirmed, user?.email],
  );

  const isStepUpFresh = useCallback(
    (maxAgeMs: number = 15 * 60 * 1000) => {
      if (!stepUpVerifiedAt) return false;
      return Date.now() - stepUpVerifiedAt <= maxAgeMs;
    },
    [stepUpVerifiedAt],
  );

  const logout = useCallback(async () => {
    if (accessToken) {
      try {
        await authApi.logout(accessToken);
      } catch {
        // Ignore logout errors
      }
    }

    clearActiveAuth();
    clearPendingLogin();
    router.push('/login');
  }, [accessToken, clearActiveAuth, clearPendingLogin, router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accessToken,
        isAuthenticated: !!user,
        stepUpVerifiedAt,
        login,
        requestStepUp,
        verifyStepUp,
        isStepUpFresh,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function useRequireAuth() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  return { isAuthenticated, loading };
}
