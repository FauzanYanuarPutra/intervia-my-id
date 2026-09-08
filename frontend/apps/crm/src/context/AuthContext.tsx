'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, type AuthMeResponse } from '@/lib/api';
import { safeInternalRedirect } from '@/lib/sessionProxy';

const ALLOWED_ROLES = ['sales', 'admin', 'support', 'super_admin'];
const STEP_UP_KEY = 'crm_stepup_verified_at';
const SESSION_MARKER = 'cookie-session';

type User = AuthMeResponse;
type SessionConfirmationResponse = { success: boolean; message?: string; purpose?: string; delivery?: string };
type AuthContextType = {
  user: User | null;
  loading: boolean;
  /** Compatibility marker only. Real credentials live in HttpOnly cookies. */
  accessToken: string | null;
  isAuthenticated: boolean;
  stepUpVerifiedAt: number | null;
  login: (email: string, password: string, nextPath?: string | null) => Promise<void>;
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

  const clearLegacySecrets = useCallback(() => {
    for (const key of ['crm_access_token', 'crm_refresh_token', 'crm_session_id', 'crm_pending_auth']) {
      localStorage.removeItem(key);
    }
  }, []);
  const checkAccess = useCallback((roles: string[]) =>
    roles.some(role => ALLOWED_ROLES.includes(String(role).trim().toLowerCase())), []);
  const clearActiveAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setStepUpVerifiedAt(null);
    clearLegacySecrets();
    localStorage.removeItem(STEP_UP_KEY);
  }, [clearLegacySecrets]);
  const markSessionConfirmed = useCallback(() => {
    const verifiedAt = Date.now();
    setStepUpVerifiedAt(verifiedAt);
    localStorage.setItem(STEP_UP_KEY, String(verifiedAt));
    return verifiedAt;
  }, []);

  const loadUser = useCallback(async () => {
    clearLegacySecrets();
    const storedStepUp = Number(localStorage.getItem(STEP_UP_KEY) || '');
    setStepUpVerifiedAt(Number.isFinite(storedStepUp) && storedStepUp > 0 ? storedStepUp : null);
    try {
      const userData = await authApi.me('');
      if (!checkAccess(userData.roles || [])) throw new Error('Access denied');
      setUser(userData);
      setAccessToken(SESSION_MARKER);
    } catch {
      clearActiveAuth();
    } finally {
      setLoading(false);
    }
  }, [checkAccess, clearActiveAuth, clearLegacySecrets]);

  useEffect(() => { void loadUser(); }, [loadUser]);

  const login = useCallback(async (email: string, password: string, nextPath?: string | null) => {
    await authApi.login(email, password);
    const userData = await authApi.me('');
    if (!checkAccess(userData.roles || [])) {
      await authApi.logout('').catch(() => undefined);
      throw new Error('Access denied: You do not have permission to access CRM');
    }
    clearLegacySecrets();
    setUser(userData);
    setAccessToken(SESSION_MARKER);
    markSessionConfirmed();
    router.replace(safeInternalRedirect(nextPath));
  }, [checkAccess, clearLegacySecrets, markSessionConfirmed, router]);

  const requestStepUp = useCallback(async () => {
    if (!user?.email) return null;
    return {
      success: true,
      message: 'Aksi sensitif akan dikonfirmasi dari sesi agent aktif dan masuk audit trail.',
      purpose: 'login',
      delivery: 'session',
    };
  }, [user?.email]);

  const verifyStepUp = useCallback(async () => {
    if (!user?.email) throw new Error('No authenticated CRM user for session confirmation.');
    markSessionConfirmed();
  }, [markSessionConfirmed, user?.email]);

  const isStepUpFresh = useCallback((maxAgeMs: number = 15 * 60 * 1000) =>
    Boolean(stepUpVerifiedAt && Date.now() - stepUpVerifiedAt <= maxAgeMs), [stepUpVerifiedAt]);

  const logout = useCallback(async () => {
    try { await authApi.logout(''); } catch { /* always clear UI state */ }
    clearActiveAuth();
    router.replace('/login');
  }, [clearActiveAuth, router]);

  return (
    <AuthContext.Provider value={{ user, loading, accessToken, isAuthenticated: !!user, stepUpVerifiedAt, login, requestStepUp, verifyStepUp, isStepUpFresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function useRequireAuth() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const next = typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(safeInternalRedirect(next))}`);
    }
  }, [isAuthenticated, loading, router]);
  return { isAuthenticated, loading };
}
