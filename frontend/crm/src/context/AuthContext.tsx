'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  authApi,
  securityApi,
  type AuthMeResponse,
  type OtpSendResponse,
} from '@/lib/api';

const ALLOWED_ROLES = ['sales', 'admin', 'support', 'super_admin'];
const ACCESS_TOKEN_KEY = 'crm_access_token';
const REFRESH_TOKEN_KEY = 'crm_refresh_token';
const SESSION_ID_KEY = 'crm_session_id';
const STEP_UP_KEY = 'crm_stepup_verified_at';
const PENDING_AUTH_KEY = 'crm_pending_auth';

type User = AuthMeResponse;

type PendingAuth = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: User;
  createdAt: number;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  isAuthenticated: boolean;
  pendingEmail: string | null;
  stepUpVerifiedAt: number | null;
  login: (email: string, password: string) => Promise<OtpSendResponse | void>;
  resendLoginOtp: () => Promise<OtpSendResponse | null>;
  completeLoginOtp: (otp: string) => Promise<void>;
  cancelPendingLogin: () => void;
  requestStepUp: () => Promise<OtpSendResponse | null>;
  verifyStepUp: (otp: string) => Promise<void>;
  isStepUpFresh: (maxAgeMs?: number) => boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function safeParsePendingAuth(raw: string | null): PendingAuth | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingAuth>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.sessionId || !parsed.user) {
      return null;
    }
    return {
      accessToken: String(parsed.accessToken),
      refreshToken: String(parsed.refreshToken),
      sessionId: String(parsed.sessionId),
      user: parsed.user as User,
      createdAt:
        typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAuth, setPendingAuth] = useState<PendingAuth | null>(null);
  const [stepUpVerifiedAt, setStepUpVerifiedAt] = useState<number | null>(null);
  const router = useRouter();

  const checkAccess = useCallback((roles: string[]) => {
    return roles.some(role =>
      ALLOWED_ROLES.includes(String(role).trim().toLowerCase()),
    );
  }, []);

  const clearPendingLogin = useCallback(() => {
    setPendingAuth(null);
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

  const persistPendingAuth = useCallback((bundle: PendingAuth) => {
    setPendingAuth(bundle);
    localStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(bundle));
  }, []);

  const persistActiveAuth = useCallback((bundle: PendingAuth, verifiedAt: number) => {
    setUser(bundle.user);
    setAccessToken(bundle.accessToken);
    setStepUpVerifiedAt(verifiedAt);
    localStorage.setItem(ACCESS_TOKEN_KEY, bundle.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, bundle.refreshToken);
    localStorage.setItem(SESSION_ID_KEY, bundle.sessionId);
    localStorage.setItem(STEP_UP_KEY, String(verifiedAt));
  }, []);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const pending = safeParsePendingAuth(localStorage.getItem(PENDING_AUTH_KEY));
    const storedStepUp = Number(localStorage.getItem(STEP_UP_KEY) || '');

    if (pending) {
      setPendingAuth(pending);
    } else {
      setPendingAuth(null);
    }

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

      clearActiveAuth();
      const nextPending: PendingAuth = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        sessionId: response.session_id,
        user: userData,
        createdAt: Date.now(),
      };
      persistPendingAuth(nextPending);

      const otpResult = await securityApi.sendOtp(userData.email, 'login');
      router.push('/login');
      return otpResult;
    },
    [checkAccess, clearActiveAuth, persistPendingAuth, router],
  );

  const resendLoginOtp = useCallback(async () => {
    if (!pendingAuth?.user.email) return null;
    return securityApi.sendOtp(pendingAuth.user.email, 'login');
  }, [pendingAuth?.user.email]);

  const completeLoginOtp = useCallback(
    async (otp: string) => {
      if (!pendingAuth?.user.email) {
        throw new Error('No pending CRM login to verify.');
      }

      await securityApi.verifyOtp(pendingAuth.user.email, otp, 'login');
      const verifiedAt = Date.now();
      persistActiveAuth(pendingAuth, verifiedAt);
      clearPendingLogin();
      router.push('/');
    },
    [clearPendingLogin, pendingAuth, persistActiveAuth, router],
  );

  const requestStepUp = useCallback(async () => {
    if (!user?.email) return null;
    return securityApi.sendOtp(user.email, 'login');
  }, [user?.email]);

  const verifyStepUp = useCallback(
    async (otp: string) => {
      if (!user?.email) {
        throw new Error('No authenticated CRM user for step-up verification.');
      }
      await securityApi.verifyOtp(user.email, otp, 'login');
      const verifiedAt = Date.now();
      setStepUpVerifiedAt(verifiedAt);
      localStorage.setItem(STEP_UP_KEY, String(verifiedAt));
    },
    [user?.email],
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
        pendingEmail: pendingAuth?.user.email || null,
        stepUpVerifiedAt,
        login,
        resendLoginOtp,
        completeLoginOtp,
        cancelPendingLogin: clearPendingLogin,
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
