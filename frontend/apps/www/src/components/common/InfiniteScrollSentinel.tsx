'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useInView } from 'react-intersection-observer';

export type InfiniteScrollSentinelProps = {
  enabled?: boolean;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => Promise<void> | void;
  loadingLabel?: string;
  className?: string;
};

export function InfiniteScrollSentinel({
  enabled = true,
  hasMore,
  loading,
  onLoadMore,
  loadingLabel = 'Memuat berikutnya…',
  className = '',
}: InfiniteScrollSentinelProps) {
  const triggerLockRef = useRef(false);
  const { ref, inView } = useInView({
    rootMargin: '700px 0px',
    threshold: 0.01,
    triggerOnce: false,
  });

  useEffect(() => {
    if (!enabled || !hasMore || loading || !inView || triggerLockRef.current) {
      return;
    }

    triggerLockRef.current = true;
    Promise.resolve(onLoadMore()).finally(() => {
      triggerLockRef.current = false;
    });
  }, [enabled, hasMore, inView, loading, onLoadMore]);

  if (!enabled || !hasMore) return null;

  return (
    <div
      ref={ref}
      className={`flex min-h-14 items-center justify-center py-3 ${className}`}
      aria-hidden={loading ? undefined : true}
      data-infinite-scroll-sentinel="true"
    >
      {loading ? (
        <span
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-1.5 text-[10px] font-bold text-[color:var(--app-text-soft)] shadow-sm"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {loadingLabel}
        </span>
      ) : (
        <span className="sr-only">{loadingLabel}</span>
      )}
    </div>
  );
}
