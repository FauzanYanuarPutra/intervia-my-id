'use client';

import Image from 'next/image';
import { Grid2X2 } from 'lucide-react';

import {
  MARKETPLACE_EXPLORE_CATEGORIES,
  type LajukanExploreCategory,
  type LajukanLocale,
} from '@/lib/discovery/lajukanCategories';
import { cn } from '@/lib/utils';

type SearchCategoryRailProps = {
  locale: LajukanLocale;
  activeCategory: LajukanExploreCategory | null;
  activeSubcategory: string;
  onSelectCategory: (category: LajukanExploreCategory | null) => void;
  onSelectSubcategory: (subcategory: string | null) => void;
};

export function SearchCategoryRail({
  locale,
  activeCategory,
  activeSubcategory,
  onSelectCategory,
  onSelectSubcategory,
}: SearchCategoryRailProps) {
  const isId = locale === 'id';
  const marketplaceCategory = MARKETPLACE_EXPLORE_CATEGORIES.find(
    category => category.id === activeCategory?.id,
  );

  return (
    <section
      className="bg-[color:var(--app-surface-strong)] pb-1"
      aria-labelledby="search-business-category-title"
    >
      <h2 id="search-business-category-title" className="sr-only">
        {isId ? 'Kategori' : 'Category'}
      </h2>

      <div
        className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        role="listbox"
        aria-label={isId ? 'Pilih kategori' : 'Choose category'}
      >
        <button
          type="button"
          role="option"
          aria-selected={!marketplaceCategory}
          onClick={() => onSelectCategory(null)}
          className={cn(
            'inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-3 text-left text-xs font-bold transition',
            !marketplaceCategory
              ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
              : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)]',
          )}
        >
          <Grid2X2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{isId ? 'Semua' : 'All'}</span>
        </button>

        {MARKETPLACE_EXPLORE_CATEGORIES.map(category => {
          const active = marketplaceCategory?.id === category.id;
          return (
            <button
              key={category.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelectCategory(category)}
              className={cn(
                'inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg border py-1.5 pl-1.5 pr-3 text-left text-xs font-bold transition',
                active
                  ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)]',
              )}
            >
              <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-white">
                <Image
                  src={category.image}
                  alt=""
                  fill
                  sizes="24px"
                  className="object-contain"
                />
              </span>
              <span className="truncate">
                {isId ? category.labelId : category.labelEn}
              </span>
            </button>
          );
        })}
      </div>

      {marketplaceCategory ? (
        <div
          className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--app-border)] pt-4"
          aria-label={isId ? 'Pilih subkategori' : 'Choose subcategory'}
        >
          <button
            type="button"
            aria-pressed={!activeSubcategory}
            onClick={() => onSelectSubcategory(null)}
            className={cn(
              'inline-flex min-h-8 max-w-full items-center rounded-full border px-3 text-[11px] font-semibold transition',
              !activeSubcategory
                ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
                : 'border-[color:var(--app-border)] text-[color:var(--app-text)]',
            )}
          >
            <span className="truncate">
              {isId
                ? `Semua ${marketplaceCategory.shortLabelId}`
                : `All ${marketplaceCategory.shortLabelEn}`}
            </span>
          </button>

          {marketplaceCategory.subcategories.map(subcategory => {
            const active = activeSubcategory === subcategory.slug;
            return (
              <button
                key={subcategory.slug}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectSubcategory(subcategory.slug)}
                className={cn(
                  'inline-flex min-h-8 max-w-full items-center rounded-full border px-3 text-[11px] font-semibold transition',
                  active
                    ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
                    : 'border-[color:var(--app-border)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)]',
                )}
              >
                <span className="truncate">
                  {isId ? subcategory.labelId : subcategory.labelEn}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
