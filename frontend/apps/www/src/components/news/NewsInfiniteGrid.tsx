'use client';

import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

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
  title: string;
  eyebrow?: string;
};

export function NewsInfiniteGrid({
  initialItems,
  initialNextCursor,
  locale,
  category,
  topic,
  location,
  query,
  title,
  eyebrow,
}: NewsInfiniteGridProps) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const language = locale === 'en' ? 'en' : 'id';

  const baseParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('language', language);
    params.set('limit', '36');
    if (category?.trim()) params.set('category', category.trim());
    if (topic?.trim()) params.set('topic', topic.trim());
    if (location?.trim()) params.set('location', location.trim());
    if (query?.trim()) params.set('q', query.trim());
    return params;
  }, [category, language, location, query, topic]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const params = new URLSearchParams(baseParams);
      params.set('cursor', nextCursor);

      const response = await fetch(
        `/api/news?${params.toString()}`,
        {
          cache: 'no-store',
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        items?: LajukanNewsArticle[];
        nextCursor?: string | null;
        hasMore?: boolean;
      };

      if (!response.ok) {
        throw new Error(
          typeof (payload as { error?: unknown }).error === 'string'
            ? String((payload as { error?: unknown }).error)
            : 'Failed to load more news',
        );
      }

      const incoming = Array.isArray(payload.items)
        ? payload.items
        : [];

      setItems(current => {
        const seen = new Set(current.map(item => item.id));
        return [
          ...current,
          ...incoming.filter(item => !seen.has(item.id)),
        ];
      });
      setNextCursor(payload.hasMore ? payload.nextCursor || null : null);
    } catch {
      setError(
        language === 'id'
          ? 'Berita berikutnya belum bisa dimuat.'
          : 'The next stories could not be loaded.',
      );
    } finally {
      setLoadingMore(false);
    }
  }, [baseParams, language, loadingMore, nextCursor]);

  return (
    <section className="mt-7 min-w-0 sm:mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
            {title}
          </h2>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-slate-400">
          {items.length} {language === 'id' ? 'artikel' : 'stories'}
        </span>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(item => (
          <NewsCard
            key={item.id}
            article={item}
            locale={locale}
            variant="grid"
          />
        ))}
      </div>

      {nextCursor ? (
        <InfiniteScrollSentinel
          hasMore
          loading={loadingMore}
          onLoadMore={loadMore}
          loadingLabel={
            language === 'id'
              ? 'Memuat berita berikutnya…'
              : 'Loading more stories…'
          }
        />
      ) : null}

      {error ? (
        <div className="flex flex-col items-center gap-2 pt-2 text-center">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
          {nextCursor ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-amber-200 bg-white px-3.5 text-xs font-black text-amber-800 transition hover:border-amber-300 disabled:opacity-60 dark:border-amber-900/60 dark:bg-slate-900 dark:text-amber-200"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              {language === 'id' ? 'Coba lagi' : 'Try again'}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
