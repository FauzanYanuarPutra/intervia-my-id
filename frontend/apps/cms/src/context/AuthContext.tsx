'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

const ALLOWED_ROLES = ['content_admin', 'admin', 'super_admin'];
const SESSION_MARKER = 'cookie-session';

type User = {
  id: string;
  email: string;
  username?: string;
  roles: string[];
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  /** Compatibility marker only. Real credentials live in HttpOnly cookies. */
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const clearLegacyBrowserTokens = useCallback(() => {
    localStorage.removeItem('cms_access_token');
    localStorage.removeItem('cms_refresh_token');
    localStorage.removeItem('cms_session_id');
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    clearLegacyBrowserTokens();
  }, [clearLegacyBrowserTokens]);

  const checkAccess = useCallback((roles: string[]) => {
    return roles.some(role => ALLOWED_ROLES.includes(String(role).trim().toLowerCase()));
  }, []);

  const loadUser = useCallback(async () => {
    clearLegacyBrowserTokens();
    try {
      const userData = await authApi.me('');
      if (!checkAccess(userData.roles || [])) {
        throw new Error('Access denied: insufficient permissions');
      }
      setUser(userData);
      setAccessToken(SESSION_MARKER);
    } catch {
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, [clearAuth, clearLegacyBrowserTokens, checkAccess]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUser();
    });
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    await authApi.login(email, password);
    const userData = await authApi.me('');
    if (!checkAccess(userData.roles || [])) {
      await authApi.logout('').catch(() => undefined);
      throw new Error('Access denied: You do not have permission to access CMS');
    }

    clearLegacyBrowserTokens();
    setUser(userData);
    setAccessToken(SESSION_MARKER);
    router.replace('/');
  };

  const logout = async () => {
    try {
      await authApi.logout('');
    } catch {
      // Always clear local UI state even when the upstream logout endpoint is unavailable.
    }
    clearAuth();
    router.replace('/login');
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, accessToken, isAuthenticated: !!user, login, logout }}
    >
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
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, loading, router]);

  return { isAuthenticated, loading };
}
