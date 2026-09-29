'use client';

import { useEffect, useRef } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';

type InfiniteScrollSentinelProps = {
  hasMore: boolean;
  loading?: boolean;
  disabled?: boolean;
  rootMargin?: string;
  className?: string;
  label?: string;
  loadingLabel?: string;
  retryLabel?: string;
  error?: string | null;
  onLoadMore: () => void;
  onRetry?: () => void;
};

export function InfiniteScrollSentinel({
  hasMore,
  loading = false,
  disabled = false,
  rootMargin = '800px 0px',
  className = '',
  label = 'Muat lebih banyak',
  loadingLabel = 'Memuat...',
  retryLabel = 'Coba lagi',
  error = null,
  onLoadMore,
  onRetry,
}: InfiniteScrollSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || disabled) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      {
        root: null,
        rootMargin,
        threshold: 0.01,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [disabled, hasMore, loading, onLoadMore, rootMargin]);

  if (!hasMore && !error) return null;

  return (
    <div
      ref={sentinelRef}
      className={`mt-5 flex min-h-14 items-center justify-center ${className}`}
      aria-live="polite"
      aria-busy={loading}
    >
      {error ? (
        <div className="flex w-full flex-col items-center gap-2 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-3 text-center dark:border-rose-900/60 dark:bg-rose-950/25">
          <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
            {error}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[10px] font-black text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100 dark:bg-slate-950 dark:text-rose-300 dark:ring-rose-900/60 dark:hover:bg-rose-950/40"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {retryLabel}
            </button>
          ) : null}
        </div>
      ) : loading ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-[10px] font-black text-[color:var(--app-text-soft)] shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {loadingLabel}
        </div>
      ) : (
        <div className="flex w-full items-center justify-center py-1">
          <span className="sr-only">{label}</span>
        </div>
      )}
    </div>
  );
}
