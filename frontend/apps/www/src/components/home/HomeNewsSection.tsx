'use client';

import { ArrowRight, Clock3, Newspaper, MapPin } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buildNewsPath, type LajukanNewsArticle } from '@/lib/news';

function formatNewsDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function articleKindLabel(
  articleKind: LajukanNewsArticle['articleKind'],
  isId: boolean,
) {
  if (articleKind === 'analysis') return isId ? 'Analisis' : 'Analysis';
  if (articleKind === 'press_release') {
    return isId ? 'Rilis' : 'Press release';
  }
  return isId ? 'Berita' : 'News';
}

function NewsImage({
  item,
  priority = false,
  className = '',
}: {
  item: LajukanNewsArticle;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[color:var(--app-surface-muted)] ${className}`}
    >
      {item.coverImage ? (
        <img
          src={item.coverImage}
          alt={item.title}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
          onError={event => {
            event.currentTarget.style.display = 'none';
            const fallback =
              event.currentTarget.parentElement?.querySelector(
                '[data-news-image-fallback]',
              );
            if (fallback instanceof HTMLElement) {
              fallback.classList.remove('hidden');
            }
          }}
        />
      ) : null}

      <div
        data-news-image-fallback
        className={`absolute inset-0 items-center justify-between gap-4 bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_58%,#fff7ed_100%)] p-4 dark:bg-[linear-gradient(135deg,#082319_0%,#0f172a_62%,#1c1917_100%)] ${item.coverImage ? 'hidden flex' : 'flex'}`}
        aria-hidden="true"
      >
        <div className="min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-emerald-700 text-sm font-black text-white shadow-sm">L</div>
          <p className="mt-2 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-300">Lajukan News</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-600 dark:text-slate-300">{item.category}</p>
        </div>
        <Newspaper className="h-9 w-9 shrink-0 text-emerald-700/20 dark:text-emerald-300/20" />
      </div>

      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />

      <div className="absolute left-3 top-3 flex min-w-0 items-center gap-1.5">
        <span className="max-w-[48%] truncate rounded-full bg-white/92 px-2 py-1 text-[9px] font-extrabold text-emerald-800 shadow-sm backdrop-blur dark:bg-slate-950/90 dark:text-emerald-300">
          {item.category}
        </span>
        <span className="max-w-[45%] truncate rounded-full bg-black/50 px-2 py-1 text-[9px] font-bold text-white backdrop-blur">
          {articleKindLabel(item.articleKind, item.language === 'id')}
        </span>
      </div>
    </div>
  );
}

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
      className="w-full overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] py-3 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.22)]"
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
              <h2
                id="home-news-title"
                className="truncate text-[13px] font-black tracking-[-0.025em] text-[color:var(--app-text)] sm:text-[14px]"
              >
                Lajukan News
              </h2>
              {visibleItems.length > 0 ? (
                <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 sm:inline dark:bg-emerald-950/60 dark:text-emerald-300">
                  {isId ? 'Terbaru' : 'Latest'}
                </span>
              ) : null}
            </div>
            <p className="hidden truncate text-[10px] font-medium text-[color:var(--app-text-soft)] sm:block">
              {isId
                ? 'Berita ekonomi, bisnis, UMKM, teknologi, dan daerah yang relevan untuk usaha.'
                : 'Economy, business, SME, technology, and local news relevant to businesses.'}
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

      {visibleItems.length > 0 ? (
        <>
          <div className="mt-3 hidden gap-2.5 px-3 sm:grid sm:gap-3 sm:px-4 md:px-5 lg:grid-cols-2">
            {visibleItems.slice(0, 1).map(item => (
              <Link
                key={item.id}
                href={buildNewsPath(item.slug)}
                className="group flex min-w-0 h-full flex-col overflow-hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-left transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-sm"
                data-testid="home-news-headline-card"
              >
                <div className="aspect-[16/9] sm:aspect-[16/8.7] lg:aspect-[16/10]">
                  <NewsImage item={item} priority className="h-full w-full" />
                </div>
                <div className="flex-1 p-3.5 sm:p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">{item.category}</span>
                    <span className="text-[9px] font-semibold text-[color:var(--app-text-soft)]">{articleKindLabel(item.articleKind, item.language === 'id')}</span>
                  </div>
                  <h3 className="mt-1 line-clamp-3 text-[17px] font-black leading-[21px] tracking-[-0.03em] text-[color:var(--app-text)] group-hover:text-emerald-700 dark:group-hover:text-emerald-300 sm:text-[20px] sm:leading-[24px]">{item.title}</h3>
                  {item.summary ? <p className="mt-1.5 line-clamp-2 text-[11px] leading-[17px] text-[color:var(--app-text-soft)]">{item.summary}</p> : null}
                  <div className="mt-2.5 flex min-w-0 items-center gap-2 text-[9px] font-semibold text-[color:var(--app-text-soft)]">
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      {formatNewsDate(item.publishedAt, locale) || (isId ? 'Terbaru' : 'Latest')}
                    </span>
                    {item.location ? <span className="inline-flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{item.location}</span></span> : null}
                  </div>
                </div>
              </Link>
            ))}

            <div className="grid min-w-0 gap-2.5 sm:gap-3">
              {visibleItems.slice(1).map(item => (
                <Link
                  key={item.id}
                  href={buildNewsPath(item.slug)}
                  className="group grid min-w-0 grid-cols-[112px_minmax(0,1fr)] gap-3 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2.5 text-left transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)] sm:grid-cols-[132px_minmax(0,1fr)] sm:p-3"
                  data-testid="home-news-card"
                >
                  <NewsImage
                    item={item}
                    className="aspect-[4/3] w-full rounded-[12px]"
                  />

                  <div className="min-w-0 py-0.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="max-w-[48%] truncate text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300">
                        {item.category}
                      </span>
                      <span className="truncate text-[9px] font-semibold text-[color:var(--app-text-soft)]">
                        {formatNewsDate(item.publishedAt, locale) ||
                          (isId ? 'Terbaru' : 'Latest')}
                      </span>
                    </div>
                    <h3 className="mt-1 line-clamp-2 text-[12px] font-extrabold leading-[17px] tracking-[-0.018em] text-[color:var(--app-text)] transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-300 sm:text-[13px]">
                      {item.title}
                    </h3>
                    {item.summary ? (
                      <p className="mt-1 line-clamp-2 text-[10px] leading-[15px] text-[color:var(--app-text-soft)]">
                        {item.summary}
                      </p>
                    ) : null}
                    {item.location ? (
                      <p className="mt-1.5 flex items-center gap-1 truncate text-[9px] font-semibold text-[color:var(--app-text-soft)]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-2.5 flex gap-2 overflow-x-auto px-3 pb-0.5 sm:hidden">
            {visibleItems.map(item => (
              <Link
                key={`mobile-${item.id}`}
                href={buildNewsPath(item.slug)}
                className="group min-w-[76vw] max-w-[310px] shrink-0 overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)]"
                data-testid="home-news-mobile-card"
              >
                <div className="aspect-[16/9]">
                  <NewsImage item={item} className="h-full w-full" />
                </div>
                <div className="p-3">
                  <p className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                    {item.category}
                  </p>
                  <h3 className="mt-1 line-clamp-2 text-[13px] font-extrabold leading-[18px] text-[color:var(--app-text)]">
                    {item.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-[16px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 sm:mx-4 md:mx-5">
          <div className="flex min-w-0 items-center gap-2">
            <Newspaper className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
            <p className="min-w-0 text-[10px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Belum ada berita terbaru yang terbit.'
                : 'No published news yet.'}
            </p>
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
