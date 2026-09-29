'use client';

import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Loader2, RotateCcw } from 'lucide-react';

type InfiniteScrollTriggerProps = {
  hasMore: boolean;
  loading: boolean;
  error?: boolean;
  onLoadMore: () => void | Promise<void>;
  isId?: boolean;
  rootMargin?: string;
  className?: string;
};

export function InfiniteScrollTrigger({
  hasMore,
  loading,
  error = false,
  onLoadMore,
  isId = true,
  rootMargin = '900px 0px',
  className = '',
}: InfiniteScrollTriggerProps) {
  const { ref, inView } = useInView({
    rootMargin,
    threshold: 0.01,
    skip: !hasMore || loading || error,
  });

  useEffect(() => {
    if (!inView || !hasMore || loading || error) return;
    void onLoadMore();
  }, [error, hasMore, inView, loading, onLoadMore]);

  if (!hasMore && !loading && !error) return null;

  return (
    <div
      ref={ref}
      className={`flex min-h-12 items-center justify-center py-3 ${className}`}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {loading ? (
        <div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[10px] font-bold text-[color:var(--app-text-soft)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {isId ? 'Memuat berikutnya…' : 'Loading more…'}
        </div>
      ) : null}

      {error ? (
        <button
          type="button"
          onClick={() => void onLoadMore()}
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[10px] font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {isId ? 'Coba muat lagi' : 'Retry'}
        </button>
      ) : null}

      {!hasMore && !loading && !error ? (
        <span className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">
          {isId ? 'Semua hasil sudah ditampilkan.' : 'All results are shown.'}
        </span>
      ) : null}
    </div>
  );
}
