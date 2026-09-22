'use client';

import { ArrowRight, Clock3, Newspaper } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { LajukanNewsArticle } from '@/lib/news';
import { NewsCard } from '@/components/news/NewsCard';

export function HomeNewsSection({
  locale,
  items,
}: {
  locale: string;
  items: LajukanNewsArticle[];
}) {
  const visibleItems = items.slice(0, 4);
  const isId = locale === 'id';

  return (
    <section
      className="w-full overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] py-3.5 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.22)]"
      aria-labelledby="home-news-title"
      data-testid="home-news-section"
    >
      <div className="flex min-h-9 items-center justify-between gap-3 px-3 sm:px-4 md:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-emerald-700 text-[12px] font-black text-white shadow-sm">
            L
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 id="home-news-title" className="truncate text-[13px] font-black tracking-[-0.025em] text-[color:var(--app-text)] sm:text-[14px]">
                Lajukan News
              </h2>
              {visibleItems.length ? (
                <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 sm:inline dark:bg-emerald-950/60 dark:text-emerald-300">
                  {isId ? 'Terbaru' : 'Latest'}
                </span>
              ) : null}
            </div>
            <p className="hidden truncate text-[10px] font-medium text-[color:var(--app-text-soft)] sm:block">
              {isId ? 'Berita bisnis, UMKM, ekonomi, teknologi, dan daerah.' : 'Business, SME, economy, technology, and local news.'}
            </p>
          </div>
        </div>

        <Link
          href="/news"
          className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-[10px] px-2 text-[10px] font-extrabold text-[color:var(--app-accent)] transition hover:bg-[color:var(--app-accent-soft)]"
        >
          {isId ? 'Semua berita' : 'All news'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {visibleItems.length ? (
        <>
          <div className="mt-3 hidden gap-3 px-3 sm:grid sm:px-4 md:px-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <NewsCard article={visibleItems[0]} locale={locale} variant="hero" priority />
            <div className="grid min-w-0 gap-2.5 sm:gap-3">
              {visibleItems.slice(1).map(item => (
                <NewsCard key={item.id} article={item} locale={locale} variant="compact" />
              ))}
            </div>
          </div>

          <div className="mt-2.5 flex gap-2 overflow-x-auto px-3 pb-0.5 sm:hidden">
            {visibleItems.map(item => (
              <div key={item.id} className="min-w-[82vw] max-w-[340px] shrink-0">
                <NewsCard article={item} locale={locale} variant="hero" priority={item.id === visibleItems[0]?.id} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-[16px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 sm:mx-4 md:mx-5">
          <div className="flex min-w-0 items-center gap-2">
            <Newspaper className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
                {isId ? 'Belum ada berita terbaru yang terbit.' : 'No published news yet.'}
              </p>
              <p className="mt-0.5 text-[9px] font-medium text-[color:var(--app-text-soft)]">
                {isId ? 'Coba lagi nanti untuk update terbaru.' : 'Check again later for the latest updates.'}
              </p>
            </div>
          </div>
          <Link
            href="/news"
            className="inline-flex min-h-8 shrink-0 items-center rounded-[10px] border border-[color:var(--app-accent-border)] px-2.5 text-[10px] font-bold text-[color:var(--app-accent)]"
          >
            {isId ? 'Buka News' : 'Open News'}
          </Link>
        </div>
      )}
    </section>
  );
}
