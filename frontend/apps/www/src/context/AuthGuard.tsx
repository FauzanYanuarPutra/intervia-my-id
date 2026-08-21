'use client';

import { useAuth } from '@/context/AuthContext';
import { buildLoginPath } from '@/lib/authRoutes';
import { getLocaleFromPathname, isSupportedLocale } from '@/lib/locale';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

const LOCALE_COOKIE = 'NEXT_LOCALE';

function readCookieValue(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const pattern = new RegExp(`(?:^|; )${name}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function resolveLocale(pathname: string): 'en' | 'id' {
  const fromPath = getLocaleFromPathname(pathname);
  if (fromPath) return fromPath;
  const fromCookie = readCookieValue(LOCALE_COOKIE);
  if (isSupportedLocale(fromCookie)) return fromCookie;
  return 'id';
}

function readCurrentSearch(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search.replace(/^\?/, '');
}

export default function AuthGuard({
  children,
  requiredRoles = [],
}: AuthGuardProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const locale = resolveLocale(pathname);

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.replace(buildLoginPath(locale, pathname, readCurrentSearch()));
      } else if (
        requiredRoles.length > 0 &&
        !requiredRoles.some(r => user?.roles.includes(r))
      ) {
        router.replace(`/${locale}/unauthorized`);
      }
    }
  }, [
    isAuthenticated,
    loading,
    locale,
    pathname,
    requiredRoles,
    router,
    user,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[color:var(--app-accent)] mb-4"></div>
        <p className="text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] font-medium">
          Memverifikasi Sesi...
        </p>
      </div>
    );
  }

  // Jika tidak terautentikasi atau role salah, jangan render apapun (akan diredirect oleh useEffect)
  if (
    !isAuthenticated ||
    (requiredRoles.length > 0 &&
      !requiredRoles.some(r => user?.roles.includes(r)))
  ) {
    return null;
  }

  return <>{children}</>;
}
