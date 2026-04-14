'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

const MESSAGES = {
  en: {
    title: 'Something went wrong',
    description: 'Please try again. If the problem persists, contact support.',
    tryAgain: 'Try again',
    goHome: 'Go home',
  },
  id: {
    title: 'Terjadi kesalahan',
    description: 'Silakan coba lagi. Jika masalah berlanjut, hubungi dukungan.',
    tryAgain: 'Coba lagi',
    goHome: 'Ke beranda',
  },
};

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retryCount, setRetryCount] = useState(0);
  const pathname = usePathname();
  const locale = pathname?.startsWith('/id') ? 'id' : 'en';
  const t = MESSAGES[locale];
  const homeHref = `/${locale}/home`;
  const shouldAutoRetry = useMemo(() => {
    const message = `${error?.message || ''}`.toLowerCase();
    return /(408|timeout|timed out|temporar|service unavailable|network|fetch|500)/.test(
      message,
    );
  }, [error]);

  useEffect(() => {
    console.error('[APP_ERROR_BOUNDARY]', error?.message, error?.stack, error);
  }, [error]);

  useEffect(() => {
    if (!shouldAutoRetry || retryCount >= 2) return;
    const delayMs = retryCount === 0 ? 1200 : 2500;
    const timer = setTimeout(() => {
      setRetryCount((prev) => prev + 1);
      reset();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [reset, retryCount, shouldAutoRetry]);

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] container-touch">
      <div className="max-w-md w-full rounded-2xl border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg sm:text-xl font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {t.title}
        </h2>
        <p className="mt-2 text-sm sm:text-base text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          {t.description}
        </p>
        {isDev && error?.message && (
          <p className="mt-3 p-3 rounded-lg bg-[color:var(--app-danger-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-danger)_20%,_transparent)] text-[color:var(--app-danger)] dark:text-[color:var(--app-danger)] text-xs font-mono break-words">
            {error.message}
          </p>
        )}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg bg-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-strong)] px-4 py-3 text-sm font-medium text-[color:var(--app-text-inverse)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:ring-offset-2"
          >
            {t.tryAgain}
          </button>
          <Link
            href={homeHref}
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] px-4 py-3 text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] dark:hover:bg-[color:var(--app-surface-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-border-strong)] focus:ring-offset-2"
          >
            {t.goHome}
          </Link>
        </div>
      </div>
    </div>
  );
}