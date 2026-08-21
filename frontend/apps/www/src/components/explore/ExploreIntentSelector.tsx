'use client';

import { Search, ShoppingBag, UsersRound } from 'lucide-react';

import type { LajukanLocale } from '@/lib/discovery/lajukanCategories';
import { cn } from '@/lib/utils';

export type ExploreIntent = 'supply' | 'demand' | 'people';

const INTENT_COPY = {
  supply: {
    titleId: 'Barang & jasa',
    titleEn: 'Products & services',
    descriptionId: 'Cari kebutuhan usahamu',
    descriptionEn: 'Find what your business needs',
    Icon: Search,
  },
  demand: {
    titleId: 'Cari pembeli',
    titleEn: 'Find buyers',
    descriptionId: 'Lihat kebutuhan terbaru',
    descriptionEn: 'See the latest buyer requests',
    Icon: ShoppingBag,
  },
  people: {
    titleId: 'Orang & usaha',
    titleEn: 'People & businesses',
    descriptionId: 'Lihat profil publik',
    descriptionEn: 'Browse public profiles',
    Icon: UsersRound,
  },
} as const;

export function ExploreIntentSelector({
  locale,
  value,
  onChange,
  className,
}: {
  locale: LajukanLocale;
  value: ExploreIntent;
  onChange: (value: ExploreIntent) => void;
  className?: string;
}) {
  const isId = locale === 'id';

  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="mb-2 text-xs font-bold text-[color:var(--app-text)]">
        {isId ? 'Lihat:' : 'Show:'}
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(INTENT_COPY) as ExploreIntent[]).map(intent => {
          const copy = INTENT_COPY[intent];
          const active = value === intent;
          const Icon = copy.Icon;
          const title = isId ? copy.titleId : copy.titleEn;
          const description = isId ? copy.descriptionId : copy.descriptionEn;

          return (
            <button
              key={intent}
              type="button"
              onClick={() => onChange(intent)}
              aria-pressed={active}
              aria-label={`${title}. ${description}`}
              className={cn(
                'flex min-h-[72px] min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 sm:min-h-[76px] sm:flex-row sm:justify-start sm:gap-2 sm:px-3 sm:text-left',
                active
                  ? 'cursor-default border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] shadow-sm'
                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)]',
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  'h-5 w-5 shrink-0',
                  active ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-text-soft)]',
                )}
              />
              <span className="min-w-0">
                <span className="block text-xs font-bold leading-4">
                  {title}
                </span>
                <span
                  className={cn(
                    'sr-only mt-0.5 text-xs font-medium leading-4 lg:not-sr-only lg:line-clamp-2',
                    active
                      ? 'text-[color:var(--app-accent)]'
                      : 'text-[color:var(--app-text-soft)]',
                  )}
                >
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
