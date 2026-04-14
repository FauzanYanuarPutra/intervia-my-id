'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

const ALLOWED_ROLES = ['content_admin', 'admin', 'super_admin'];

type User = {
  id: string;
  email: string;
  username?: string;
  roles: string[];
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
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

  const clearAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('cms_access_token');
    localStorage.removeItem('cms_refresh_token');
    localStorage.removeItem('cms_session_id');
  }, []);

  const checkAccess = useCallback((roles: string[]) => {
    return roles.some(role => ALLOWED_ROLES.includes(role));
  }, []);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('cms_access_token');
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
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, [clearAuth, checkAccess]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    
    const roles = response.roles || [];
    if (!checkAccess(roles)) {
      throw new Error('Access denied: You do not have permission to access CMS');
    }

    localStorage.setItem('cms_access_token', response.access_token);
    localStorage.setItem('cms_refresh_token', response.refresh_token);
    localStorage.setItem('cms_session_id', response.session_id);

    setAccessToken(response.access_token);
    
    const userData = await authApi.me(response.access_token);
    setUser(userData);
    
    router.push('/');
  };

  const logout = async () => {
    if (accessToken) {
      try {
        await authApi.logout(accessToken);
      } catch {
        // Ignore logout errors
      }
    }
    clearAuth();
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accessToken,
        isAuthenticated: !!user,
        login,
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