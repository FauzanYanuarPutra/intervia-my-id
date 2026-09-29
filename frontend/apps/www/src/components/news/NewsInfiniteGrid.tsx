'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LajukanNewsArticle } from '@/lib/news';
import { NewsCard } from '@/components/news/NewsCard';
import { InfiniteScrollTrigger } from '@/components/common/InfiniteScrollTrigger';

type NewsInfiniteGridProps = {
  initialItems: LajukanNewsArticle[];
  initialNextCursor: string | null;
  locale: string;
  category?: string;
  topic?: string;
  location?: string;
  query?: string;
  variant?: 'grid' | 'compact';
};

function mergeUnique(
  current: LajukanNewsArticle[],
  incoming: LajukanNewsArticle[],
): LajukanNewsArticle[] {
  const seen = new Set(current.map(item => item.id));
  const result = [...current];
  for (const article of incoming) {
    if (seen.has(article.id)) continue;
    seen.add(article.id);
    result.push(article);
  }
  return result;
}

export function NewsInfiniteGrid({
  initialItems,
  initialNextCursor,
  locale,
  category,
  topic,
  location,
  query,
  variant = 'grid',
}: NewsInfiniteGridProps) {
  const initialKey = useMemo(
    () => initialItems.map(item => item.id).join('|'),
    [initialItems],
  );
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setItems(initialItems);
    setNextCursor(initialNextCursor);
    setLoading(false);
    setError(false);
  }, [initialKey, initialItems, initialNextCursor]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return;

    setLoading(true);
    setError(false);

    try {
      const params = new URLSearchParams({
        cursor: nextCursor,
        language: locale === 'en' ? 'en' : 'id',
        limit: '48',
      });
      if (category) params.set('category', category);
      if (topic) params.set('topic', topic);
      if (location) params.set('location', location);
      if (query) params.set('q', query);

      const response = await fetch('/api/news?' + params.toString(), {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('news_pagination_failed');

      const payload = (await response.json()) as {
        items?: LajukanNewsArticle[];
        hasMore?: boolean;
        nextCursor?: string | null;
      };
      const incoming = Array.isArray(payload.items) ? payload.items : [];
      setItems(current => mergeUnique(current, incoming));
      setNextCursor(payload.hasMore ? payload.nextCursor || null : null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [category, locale, location, loading, nextCursor, query, topic]);

  if (!items.length) return null;

  return (
    <>
      <section className={
        variant === 'compact'
          ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
          : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'
      }>
        {items.map(article => (
          <NewsCard key={article.id} article={article} locale={locale} variant="grid" />
        ))}
      </section>

      <InfiniteScrollTrigger
        hasMore={Boolean(nextCursor)}
        loading={loading}
        error={error}
        onLoadMore={loadMore}
        isId={locale === 'id'}
      />

      <noscript>
        {nextCursor ? (
          <div className="flex justify-center py-4">
            <a
              href="/news"
              rel="next"
              className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-5 text-xs font-black text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
            >
              {locale === 'id' ? 'Berita berikutnya' : 'Next stories'}
            </a>
          </div>
        ) : null}
      </noscript>
    </>
  );
}
