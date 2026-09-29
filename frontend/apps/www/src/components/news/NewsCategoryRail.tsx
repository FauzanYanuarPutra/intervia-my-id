'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { Link } from '@/i18n/navigation';
import { useEmblaWheelGestures } from '@/components/common/useEmblaWheelGestures';

const CATEGORIES = [
  'Ekonomi',
  'Bisnis',
  'UMKM',
  'Teknologi',
  'Keuangan',
  'Regulasi',
  'Industri',
  'Daerah',
] as const;

export function NewsCategoryRail({
  activeCategory,
  locale,
}: {
  activeCategory?: string;
  locale: string;
}) {
  const [viewportRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });

  useEmblaWheelGestures(emblaApi, {
    desktopOnly: true,
    threshold: 36,
  });

  const isId = locale === 'id';

  return (
    <nav
      aria-label={isId ? 'Kategori berita' : 'News categories'}
      className="min-w-0 overflow-hidden py-0.5"
    >
      <div ref={viewportRef} className="min-w-0 overflow-hidden">
        <div className="-ml-1.5 flex min-w-max touch-pan-y">
          <Link
            href="/news"
            className={
              \`ml-1.5 shrink-0 snap-start rounded-full px-3.5 py-2 text-xs font-black transition \` +
              (activeCategory
                ? 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200'
                : 'bg-emerald-700 text-white shadow-sm')
            }
          >
            {isId ? 'Semua' : 'All'}
          </Link>
          {CATEGORIES.map(category => {
            const active =
              activeCategory?.toLowerCase() === category.toLowerCase();

            return (
              <Link
                key={category}
                href={\`/news?category=\${encodeURIComponent(category)}\`}
                className={
                  \`ml-1.5 shrink-0 snap-start rounded-full px-3.5 py-2 text-xs font-bold transition \` +
                  (active
                    ? 'bg-emerald-700 font-black text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200')
                }
              >
                {category}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
