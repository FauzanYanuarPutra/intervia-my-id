'use client';

import { useCallback, useRef, useState } from 'react';

import { InfiniteScrollSentinel } from '@/components/common/InfiniteScrollSentinel';
import { NewsCard } from '@/components/news/NewsCard';
import type { LajukanNewsArticle } from '@/lib/news';

type NewsInfiniteGridProps = {
  initialItems: LajukanNewsArticle[];
  initialNextCursor: string | null;
  locale: string;
  category?: string;
  topic?: string;
  location?: string;
  query?: string;
  batchSize?: number;
  className?: string;
};

export function NewsInfiniteGrid({
  initialItems,
  initialNextCursor,
  locale,
  category,
  topic,
  location,
  query,
  batchSize = 48,
  className = '',
}: NewsInfiniteGridProps) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const cursorRef = useRef(initialNextCursor);

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!cursor || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        language: locale === 'en' ? 'en' : 'id',
        limit: String(batchSize),
        cursor,
      });
      if (category) params.set('category', category);
      if (topic) params.set('topic', topic);
      if (location) params.set('location', location);
      if (query) params.set('q', query);

      const response = await fetch(
        `/api/news?${params.toString()}`,
        {
          cache: 'no-store',
          credentials: 'same-origin',
        },
      );
      if (!response.ok) {
        throw new Error('news_append_failed');
      }

      const payload = (await response.json()) as {
        items?: LajukanNewsArticle[];
        nextCursor?: string | null;
        hasMore?: boolean;
      };

      const incoming = Array.isArray(payload.items)
        ? payload.items
        : [];

      setItems(current => {
        const existing = new Set(
          current.map(item => item.id),
        );
        const appended = incoming.filter(
          item => !existing.has(item.id),
        );
        return [...current, ...appended];
      });

      const candidateNext =
        payload.hasMore && payload.nextCursor
          ? payload.nextCursor
          : null;
      const next =
        candidateNext &&
        candidateNext !== cursor
          ? candidateNext
          : null;

      cursorRef.current = next;
      setNextCursor(next);
    } catch {
      setError(
        locale === 'id'
          ? 'Gagal memuat berita berikutnya. Coba lagi.'
          : 'Failed to load more stories. Try again.',
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [
    batchSize,
    category,
    locale,
    location,
    query,
    topic,
  ]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(article => (
          <NewsCard
            key={article.id}
            article={article}
            locale={locale}
            variant="grid"
          />
        ))}
      </div>

      {nextCursor || error ? (
        <InfiniteScrollSentinel
          hasMore={Boolean(nextCursor)}
          loading={loading}
          error={error}
          onLoadMore={loadMore}
          onRetry={loadMore}
          rootMargin="700px 0px"
          label={
            locale === 'id'
              ? 'Muat berita berikutnya'
              : 'Load next stories'
          }
          loadingLabel={
            locale === 'id'
              ? 'Memuat berita berikutnya...'
              : 'Loading more stories...'
          }
          retryLabel={locale === 'id' ? 'Coba lagi' : 'Retry'}
        />
      ) : null}
    </div>
  );
}
