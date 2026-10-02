'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLajukanEmbla } from '@/components/common/useLajukanEmbla';
import { Clock3, MapPin } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { LajukanNewsArticle } from '@/lib/news';
import { NewsMedia } from '@/components/news/NewsMedia';
import { EmblaDesktopControls } from '@/components/common/EmblaDesktopControls';

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function kindLabel(article: LajukanNewsArticle, isId: boolean) {
  if (article.articleKind === 'analysis') return isId ? 'Analisis' : 'Analysis';
  if (article.articleKind === 'press_release') return isId ? 'Rilis' : 'Release';
  return isId ? 'Berita' : 'News';
}

export function NewsCarousel({
  articles,
  locale,
  title,
  eyebrow,
  related = false,
}: {
  articles: LajukanNewsArticle[];
  locale: string;
  title: string;
  eyebrow?: string;
  related?: boolean;
}) {
  const [viewportRef, emblaApi] = useLajukanEmbla({
    align: 'start',
    containScroll: 'trimSnaps',
    loop: articles.length > 2,
    dragFree: false,
    skipSnaps: false,
    wheel: {
      enabled: articles.length > 1,
      desktopOnly: true,
      threshold: 42,
    },
  });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  const dots = useMemo(() => Math.min(articles.length, 6), [articles.length]);

  if (!articles.length) return null;

  return (
    <section className={related ? 'mt-0' : 'mt-1'}>
      <div className="mb-3 flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 truncate text-[20px] font-black tracking-[-0.035em] text-slate-950 dark:text-white sm:text-[22px]">
            {title}
          </h2>
        </div>
        {articles.length > 1 ? (
          <EmblaDesktopControls
            api={emblaApi}
            isId={locale === 'id'}
            compact
            className="lg:flex"
          />
        ) : null}
      </div>

      <div ref={viewportRef} className="min-w-0 overflow-hidden overscroll-x-contain" data-news-carousel>
        <div className="-ml-2.5 flex touch-pan-y sm:-ml-3">
          {articles.map(article => (
            <div
              key={article.id}
              className={`min-w-0 shrink-0 grow-0 pl-2.5 sm:pl-3 ${related ? 'basis-[87%] sm:basis-[49%] xl:basis-[32%]' : 'basis-[92%] sm:basis-[68%] lg:basis-[54%]'}`}
            >
              <Link
                href={'/news/' + article.slug}
                className="group block h-full min-w-0 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_44px_-34px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_22px_48px_-32px_rgba(15,23,42,0.32)] dark:border-white/10 dark:bg-slate-900"
              >
                <div className="relative">
                  <NewsMedia
                    article={article}
                    variant={related ? 'card' : 'hero'}
                    showLabels={false}
                    className="w-full"
                    priority={selected === 0 && !related}
                  />
                  <div className="absolute left-3 top-3 flex min-w-0 items-center gap-1.5">
                    <span className="max-w-[55%] truncate rounded-full bg-white/[0.94] px-2 py-1 text-[9px] font-black uppercase text-emerald-800 shadow-sm backdrop-blur dark:bg-slate-950/90 dark:text-emerald-300">
                      {article.category}
                    </span>
                    <span className="truncate rounded-full bg-black/[0.48] px-2 py-1 text-[9px] font-bold text-white backdrop-blur">
                      {kindLabel(article, locale === 'id')}
                    </span>
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <h3
                    className={`${related ? 'line-clamp-2 text-[16px] leading-5' : 'line-clamp-3 text-[22px] leading-7 sm:text-[27px] sm:leading-8'} font-black tracking-[-0.035em] text-slate-950 transition group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300`}
                  >
                    {article.title}
                  </h3>
                  {article.summary ? (
                    <p
                      className={`${related ? 'line-clamp-2 text-xs leading-5' : 'line-clamp-3 text-sm leading-6'} mt-2 font-semibold text-slate-500 dark:text-slate-300`}
                    >
                      {article.summary}
                    </p>
                  ) : null}
                  <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5 shrink-0" />
                      {formatDate(article.publishedAt, locale)}
                    </span>
                    {article.location ? (
                      <span className="inline-flex min-w-0 items-center gap-1 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{article.location}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {articles.length > 1 ? (
        <div className="mt-3 flex min-w-0 items-center justify-center gap-1.5 sm:justify-start">
          {Array.from({ length: dots }).map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={locale === 'id' ? `Buka berita ${index + 1}` : `Open story ${index + 1}`}
              onClick={() => emblaApi?.scrollTo(index)}
              className={`h-1.5 rounded-full transition-all ${selected === index ? 'w-5 bg-emerald-700 dark:bg-emerald-400' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`}
            />
          ))}
          <span className="ml-1 text-[9px] font-bold text-slate-400">
            {locale === 'id' ? 'Geser untuk berita lain' : 'Swipe for more'}
          </span>
        </div>
      ) : null}
    </section>
  );
}
