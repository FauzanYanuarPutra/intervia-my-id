import { ArrowRight, Clock3, Newspaper } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { LajukanNewsArticle } from '@/lib/news';

function formatNewsDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
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
      className="w-full py-2"
      aria-labelledby="home-news-title"
      data-testid="home-news-section"
    >
      <div className="flex min-h-9 items-center justify-between gap-3 px-1 sm:px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60">
            <Newspaper className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2
              id="home-news-title"
              className="truncate text-[13px] font-bold tracking-[-0.025em] text-[color:var(--app-text)] sm:text-sm"
            >
              Lajukan News
            </h2>
            <p className="hidden truncate text-[10px] font-medium text-[color:var(--app-text-soft)] sm:block">
              {isId
                ? 'Berita ekonomi, bisnis, UMKM, dan perkembangan daerah.'
                : 'Economy, business, SME, and local developments.'}
            </p>
          </div>
        </div>

        <Link
          href="/news"
          className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-[10px] px-2 text-[10px] font-bold text-[color:var(--app-accent)] transition hover:bg-[color:var(--app-accent-soft)]"
        >
          {isId ? 'Lihat semua' : 'See all'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {visibleItems.length > 0 ? (
        <div className="mt-2 flex gap-2.5 overflow-x-auto px-1 pb-1 sm:gap-3 sm:px-3 md:px-6 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {visibleItems.map((item, index) => {
            const dateLabel = formatNewsDate(item.publishedAt, locale);

            return (
              <Link
                key={item.id}
                href={`/news/${encodeURIComponent(item.slug)}`}
                className="group flex w-[min(78vw,290px)] shrink-0 flex-col overflow-hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_16px_32px_-26px_rgba(15,23,42,0.28)] lg:w-auto"
                data-testid="home-news-card"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-[color:var(--app-surface-muted)]">
                  {item.coverImage ? (
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
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
                    className={`absolute inset-0 items-center justify-center bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_100%)] dark:bg-[linear-gradient(135deg,#092016_0%,#0f172a_100%)] ${item.coverImage ? 'hidden' : 'flex'}`}
                    aria-hidden="true"
                  >
                    <Newspaper className="h-8 w-8 text-emerald-700/35 dark:text-emerald-300/35" />
                  </div>

                  <span className="absolute left-2.5 top-2.5 max-w-[calc(100%-20px)] truncate rounded-full bg-white/92 px-2 py-1 text-[9px] font-bold text-emerald-800 shadow-sm backdrop-blur dark:bg-slate-950/88 dark:text-emerald-300">
                    {item.category}
                  </span>
                </div>

                <div className="flex min-h-[136px] flex-1 flex-col p-3">
                  <h3 className="line-clamp-2 text-[13px] font-bold leading-[18px] tracking-[-0.02em] text-[color:var(--app-text)] transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                    {item.title}
                  </h3>

                  {item.summary ? (
                    <p className="mt-1.5 line-clamp-2 text-[10.5px] leading-[16px] text-[color:var(--app-text-soft)]">
                      {item.summary}
                    </p>
                  ) : null}

                  <div className="mt-auto flex min-w-0 items-center gap-1.5 pt-3 text-[9px] font-semibold text-[color:var(--app-text-soft)]">
                    <Clock3 className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {dateLabel || (isId ? 'Terbaru' : 'Latest')}
                    </span>
                    {item.location ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{item.location}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 px-1 sm:px-3 md:px-6">
          <div className="flex items-center justify-between gap-3 rounded-[16px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3">
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
        </div>
      )}
    </section>
  );
}
