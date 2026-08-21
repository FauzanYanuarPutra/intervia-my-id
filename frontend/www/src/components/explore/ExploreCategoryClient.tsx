'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CircleAlert,
  Plus,
  Search,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ExploreBusinessCard } from '@/components/explore/cards/ExploreBusinessCard';
import { ExploreCommunityCard } from '@/components/explore/cards/ExploreCommunityCard';
import { ExploreListingCard } from '@/components/explore/cards/ExploreListingCard';
import { ExploreVideoCard } from '@/components/explore/cards/ExploreVideoCard';
import { ExploreSearchResults } from '@/components/explore/ExploreSearchResults';
import {
  ExploreArtwork,
  ExploreSurface,
  useExploreEmblaRail,
} from '@/components/explore/ExploreVisualSystem';
import { Header } from '@/components/layout/Header';
import { CompactSeeAllLink } from '@/components/common/CompactSectionAction';
import { EmblaDesktopControls } from '@/components/common/EmblaDesktopControls';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import {
  LAJUKAN_EXPLORE_CATEGORIES,
  MARKETPLACE_EXPLORE_CATEGORIES,
  buildCategorySearchHref,
  buildExploreCategoryHref,
  normalizeExploreSide,
  type ExploreSectionConfig,
  type LajukanExploreCategory,
  type LajukanLocale,
} from '@/lib/discovery/lajukanCategories';
import type {
  ExploreCategoryResponse,
  ExploreFaq,
  ExploreGuide,
} from '@/lib/explore/exploreData';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import {
  emptyGlobalSearchResponse,
  parseGlobalSearchState,
  type GlobalSearchResponse,
  type GlobalSearchTab,
} from '@/lib/search/globalSearch';
import { exploreCategoryCopy } from '@/components/explore/ExploreCopy';
import { cn } from '@/lib/utils';

function appendSearchParams(
  path: string,
  params: URLSearchParams,
) {
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

const CATEGORY_RESULT_PARAMS = new Set([
  'q',
  'subcategory',
  'location',
  'lat',
  'lng',
  'distance',
  'sort',
  'min_price',
  'max_price',
  'condition',
  'service_mode',
  'verified',
  'status',
  'privacy',
]);

function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const CATEGORY_OVERVIEW_CACHE =
  new Map<string, ExploreCategoryResponse>();

const CATEGORY_SEARCH_CACHE =
  new Map<string, GlobalSearchResponse>();

const MAX_CATEGORY_CACHE_ENTRIES = 10;
const ALL_CATEGORY_IMAGE = '/images/hero/menu/semua-01.png';

function rememberBounded<T>(
  cache: Map<string, T>,
  key: string,
  value: T,
) {
  cache.delete(key);
  cache.set(key, value);

  while (cache.size > MAX_CATEGORY_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;

    if (!oldestKey) break;

    cache.delete(oldestKey);
  }
}

function hasCategoryResultState(
  params: URLSearchParams,
): boolean {
  return Array.from(params.entries()).some(
    ([key, value]) => {
      if (
        !CATEGORY_RESULT_PARAMS.has(key) ||
        !value.trim()
      ) {
        return false;
      }

      if (key === 'q') {
        return normalizeQuery(value).length >= 2;
      }

      if (key === 'sort') {
        return value !== 'relevance';
      }

      return true;
    },
  );
}

/**
 * Normalize the marketplace side of an API item.
 *
 * Important:
 * category != side.
 *
 * A category such as "Bahan & Supplier" can contain:
 * - products offered by sellers
 * - needs posted by buyers
 *
 * Therefore we must preserve supply/demand from the item.
 */
function withResolvedSide(
  item: GlobalSearchItem,
  forcedSide?: 'supply' | 'demand',
): GlobalSearchItem {
  if (forcedSide) {
    return {
      ...item,
      side: forcedSide,
    };
  }

  const resolvedSide = normalizeExploreSide({
    side: item.side,
    kind: item.kind,
    metadata: item.metadata,
  });

  return {
    ...item,
    side: resolvedSide,
  };
}

function SectionSkeleton() {
  return (
    <section
      className="py-4 sm:py-5"
      aria-hidden="true"
    >
      <div className="h-5 w-48 animate-pulse rounded bg-[color:var(--app-border)]" />

      <div className="mt-4 w-full min-w-0 overflow-hidden">
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map(
            (_, index) => (
              <div
                key={index}
                className="min-w-0 shrink-0 flex-[0_0_47%] sm:flex-[0_0_31%] lg:flex-[0_0_24%]"
              >
                <div className="h-48 animate-pulse rounded-2xl bg-[color:var(--app-border)]" />
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyPrimarySection({
  locale,
  category,
  mode,
}: {
  locale: LajukanLocale;
  category: LajukanExploreCategory;
  mode: 'supply' | 'demand';
}) {
  const isId = locale === 'id';
  const isCommunity = category.id === 'community';
  const isVideo = category.id === 'video';

  const actionHref = isCommunity
    ? '/community'
    : isVideo
      ? '/reels'
      : mode === 'demand'
        ? `/create?side=supply&category=${encodeURIComponent(
            category.slug,
          )}`
        : `/create?side=demand&category=${encodeURIComponent(
            category.slug,
          )}`;

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-black text-[color:var(--app-text)] sm:text-sm">
          {isId
            ? isCommunity || isVideo
              ? 'Belum ada hasil yang cocok.'
              : mode === 'demand'
                ? 'Belum ada kebutuhan yang cocok.'
                : 'Belum ada penawaran yang cocok.'
            : isCommunity || isVideo
              ? 'No matching results yet.'
              : mode === 'demand'
                ? 'No matching needs yet.'
                : 'No matching offers yet.'}
        </p>

        <p className="mt-0.5 line-clamp-1 text-[10px] text-[color:var(--app-text-soft)] sm:text-[11px]">
          {isId
            ? isVideo
              ? 'Buka Video untuk melihat unggahan terbaru.'
              : isCommunity
                ? 'Buka Komunitas untuk melihat diskusi terbaru.'
                : mode === 'demand'
                  ? 'Belum menemukan kebutuhan yang cocok? Tawarkan produk atau jasamu.'
                  : 'Belum menemukan penawaran yang cocok? Pasang kebutuhanmu agar penyedia dapat merespons.'
            : isVideo
              ? 'Open Videos to see the latest uploads.'
              : isCommunity
                ? 'Open Community to see the latest discussions.'
                : mode === 'demand'
                  ? 'Cannot find a matching need? Post your offer.'
                  : 'Cannot find a matching offer? Post your need.'}
        </p>
      </div>

      <Link
        href={actionHref}
        className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white transition hover:bg-[color:var(--app-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 dark:text-slate-950"
      >
        {isCommunity || isVideo ? (
          <ArrowRight className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}

        {isId
          ? isVideo
            ? 'Buka Video'
            : isCommunity
              ? 'Buka Komunitas'
              : mode === 'demand'
                ? 'Pasang penawaran'
                : 'Pasang kebutuhan'
          : isVideo
            ? 'Open Videos'
            : isCommunity
              ? 'Open Community'
              : mode === 'demand'
                ? 'Post an offer'
                : 'Post a need'}
      </Link>
    </div>
  );
}

function DataSection({
  config,
  items,
  locale,
  category,
  kind,
}: {
  config: ExploreSectionConfig;
  items: GlobalSearchItem[];
  locale: LajukanLocale;
  category: LajukanExploreCategory;
  kind:
    | 'listing'
    | 'business'
    | 'community'
    | 'video';
}) {
  const isId = locale === 'id';
  const { emblaRef, emblaApi } =
    useExploreEmblaRail();

  if (items.length === 0) return null;

  const isNeedSection =
    config.key === 'latest-needs';

  const forcedSide =
    kind === 'listing'
      ? isNeedSection
        ? 'demand'
        : 'supply'
      : undefined;

  const normalizedItems = items.map(
    item =>
      withResolvedSide(
        item,
        forcedSide,
      ),
  );

  const previewItems = normalizedItems.slice(
    0,
    kind === 'video'
      ? 10
      : isNeedSection ||
          kind === 'business' ||
          kind === 'community'
        ? 8
        : 10,
  );

  const seeAllHref = (() => {
    if (kind === 'community') {
      return '/community';
    }

    if (kind === 'video') {
      return '/reels';
    }

    const params = new URLSearchParams();

    if (config.key === 'latest-needs') {
      params.set('side', 'demand');
      params.set('tab', 'needs');
    } else if (kind === 'business') {
      params.set('side', 'supply');
      params.set('tab', 'businesses');
    } else {
      params.set('side', 'supply');
    }

    params.set('sort', 'latest');

    return appendSearchParams(
      buildExploreCategoryHref(category),
      params,
    );
  })();

  const slideClass =
    kind === 'video'
      ? 'flex-[0_0_46%] min-[420px]:flex-[0_0_38%] sm:flex-[0_0_30%] md:flex-[0_0_23.5%] lg:flex-[0_0_19%]'
      : isNeedSection ||
          kind === 'business' ||
          kind === 'community'
        ? 'flex-[0_0_86%] min-[420px]:flex-[0_0_74%] sm:flex-[0_0_48%] lg:flex-[0_0_32%]'
        : 'flex-[0_0_46%] min-[420px]:flex-[0_0_38%] sm:flex-[0_0_30%] md:flex-[0_0_23.5%] lg:flex-[0_0_19%]';

  const renderCard = (
    item: GlobalSearchItem,
  ) => {
    if (kind === 'business') {
      return (
        <ExploreBusinessCard
          item={item}
          locale={locale}
        />
      );
    }

    if (kind === 'community') {
      return (
        <ExploreCommunityCard
          item={item}
          locale={locale}
        />
      );
    }

    if (kind === 'video') {
      return <ExploreVideoCard item={item} />;
    }

    return (
      <ExploreListingCard
        item={item}
        locale={locale}
      />
    );
  };

  return (
    <ExploreSurface className="mt-3 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="min-w-0 truncate text-[13px] font-black text-[color:var(--app-text)] sm:text-sm">
            {isId
              ? config.titleId
              : config.titleEn}
          </h2>

          {config.key === 'latest-listings' &&
          kind === 'listing' ? (
            <p className="mt-0.5 text-[9px] font-medium text-[color:var(--app-text-soft)] sm:text-[10px]">
              {isId
                ? 'Produk dan jasa yang sedang ditawarkan.'
                : 'Products and services currently offered.'}
            </p>
          ) : null}

          {config.key === 'latest-needs' ? (
            <p className="mt-0.5 text-[9px] font-medium text-[color:var(--app-text-soft)] sm:text-[10px]">
              {isId
                ? 'Permintaan dari pengguna yang sedang mencari penyedia.'
                : 'Requests from users currently looking for providers.'}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <EmblaDesktopControls
            api={emblaApi}
            isId={isId}
            compact
          />

          <CompactSeeAllLink
            href={seeAllHref}
            isId={isId}
            onClick={() => {
              void trackLajukanEvent(
                'explore_see_all_click',
                {
                  properties: {
                    locale,
                    source: 'explore_category',
                    route:
                      buildExploreCategoryHref(
                        category,
                      ),
                    category: category.slug,
                    contentType: kind,
                    side:
                      forcedSide || undefined,
                  },
                },
              );
            }}
            ariaLabel={
              isId
                ? `Lihat semua ${
                    config.titleId
                  }`
                : `View all ${config.titleEn}`
            }
          />
        </div>
      </div>

      <div
        ref={emblaRef}
        className="mt-2.5 w-full min-w-0 cursor-grab overflow-hidden pb-1 active:cursor-grabbing"
        aria-label={
          isId
            ? config.titleId
            : config.titleEn
        }
      >
        <div className="flex touch-pan-y gap-3 [backface-visibility:hidden] [will-change:transform]">
          {previewItems.map(item => (
            <div
              key={`${kind}-${item.id}`}
              className={cn(
                'min-w-0 shrink-0 select-none [backface-visibility:hidden]',
                slideClass,
              )}
            >
              <div className="h-full w-full">
                {renderCard(item)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ExploreSurface>
  );
}

function GuidesSection({
  config,
  items,
  locale,
}: {
  config: ExploreSectionConfig;
  items: ExploreGuide[];
  locale: LajukanLocale;
}) {
  const isId = locale === 'id';
  const { emblaRef, emblaApi } =
    useExploreEmblaRail();

  return (
    <section className="py-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-black text-[color:var(--app-text)] sm:text-sm">
            {isId
              ? config.titleId
              : config.titleEn}
          </h3>

          <p className="mt-1 text-[10px] leading-4 text-[color:var(--app-text-soft)] sm:text-[11px]">
            {isId
              ? config.descriptionId
              : config.descriptionEn}
          </p>
        </div>

        {items.length > 1 ? (
          <EmblaDesktopControls
            api={emblaApi}
            isId={isId}
            compact
          />
        ) : null}
      </div>

      <div
        ref={emblaRef}
        className="mt-2 w-full min-w-0 cursor-grab overflow-hidden pb-1 active:cursor-grabbing"
      >
        <div className="flex touch-pan-y gap-3">
          {items.map(item => (
            <div
              key={item.href}
              className="min-w-0 shrink-0 flex-[0_0_86%] sm:flex-[0_0_48%] lg:flex-[0_0_32%]"
            >
              <Link
                href={item.href}
                className="group flex h-full min-h-[100px] cursor-pointer flex-col rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2"
              >
                <h3 className="text-sm font-bold text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)]">
                  {isId
                    ? item.titleId
                    : item.titleEn}
                </h3>

                <p className="mt-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                  {isId
                    ? item.summaryId
                    : item.summaryEn}
                </p>

                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-bold text-[color:var(--app-accent)]">
                  {isId
                    ? 'Baca panduan'
                    : 'Read guide'}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({
  config,
  items,
  locale,
}: {
  config: ExploreSectionConfig;
  items: ExploreFaq[];
  locale: LajukanLocale;
}) {
  const isId = locale === 'id';

  return (
    <section className="py-2">
      <h3 className="text-[13px] font-black text-[color:var(--app-text)] sm:text-sm">
        {isId
          ? config.titleId
          : config.titleEn}
      </h3>

      <div className="mt-2 divide-y divide-[color:var(--app-border)] border-y border-[color:var(--app-border)]">
        {items.map(item => (
          <details
            key={item.questionId}
            className="group py-2.5"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-[color:var(--app-text)] marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 sm:text-sm">
              {isId
                ? item.questionId
                : item.questionEn}

              <Plus className="h-4 w-4 shrink-0 transition group-open:rotate-45" />
            </summary>

            <p className="max-w-3xl pb-1 pt-1.5 text-xs leading-5 text-[color:var(--app-text-soft)] sm:text-sm sm:leading-6">
              {isId
                ? item.answerId
                : item.answerEn}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ExploreCategoryClient({
  category,
  locale,
}: {
  category: LajukanExploreCategory;
  locale: LajukanLocale;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchKey = searchParams.toString();

  const searchState = useMemo(
    () =>
      parseGlobalSearchState(
        new URLSearchParams(searchKey),
      ),
    [searchKey],
  );

  const searchSide: 'supply' | 'demand' =
    searchState.side === 'demand'
      ? 'demand'
      : 'supply';

  const [queryDraft, setQueryDraft] =
    useState({
      source: searchState.query,
      value: searchState.query,
    });

  const queryInput =
    queryDraft.source === searchState.query
      ? queryDraft.value
      : searchState.query;

  const setQueryInput = (
    value: string,
  ) => {
    setQueryDraft({
      source: searchState.query,
      value,
    });
  };

  const [payload, setPayload] =
    useState<ExploreCategoryResponse | null>(
      null,
    );

  const [searchPayload, setSearchPayload] =
    useState<GlobalSearchResponse>(() =>
      emptyGlobalSearchResponse(
        searchState.query,
      ),
    );

  const [loading, setLoading] =
    useState(false);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [error, setError] =
    useState(false);

  const [searchError, setSearchError] =
    useState(false);

  const [retryKey, setRetryKey] =
    useState(0);

  const [
    searchRetryKey,
    setSearchRetryKey,
  ] = useState(0);

  const isId = locale === 'id';

  const isFilteredSearchMode = useMemo(
    () =>
      hasCategoryResultState(
        new URLSearchParams(searchKey),
      ),
    [searchKey],
  );

  const {
    emblaRef: categoryRailRef,
    emblaApi: categoryRailApi,
  } = useExploreEmblaRail();

  const {
    emblaRef: subcategoryRailRef,
    emblaApi: subcategoryRailApi,
  } = useExploreEmblaRail();

  /**
   * Explicitly switch between:
   * - supply = Menawarkan
   * - demand = Membutuhkan
   *
   * Never rely on deleting `side` to represent supply.
   */
  const selectSearchSide = (
    side: 'supply' | 'demand',
  ) => {
    if (
      category.id === 'community' ||
      category.id === 'video'
    ) {
      return;
    }

    void trackLajukanEvent(
      'filter_applied',
      {
        properties: {
          locale,
          source: 'explore_category_mode',
          route:
            buildExploreCategoryHref(
              category,
            ),
          filter: 'discovery_mode',
          value: side,
          category: category.slug,
        },
      },
    );

    const params =
      new URLSearchParams(searchKey);

    // Always make the side explicit.
    params.set('side', side);

    if (side === 'demand') {
      params.set('tab', 'needs');
    } else {
      if (params.get('tab') === 'needs') {
        params.delete('tab');
      }

      // Supply can use all supply content types.
      if (
        params.get('tab') !==
          'products' &&
        params.get('tab') !==
          'services' &&
        params.get('tab') !==
          'businesses'
      ) {
        params.set('tab', 'all');
      }
    }

    params.delete('cursor');

    router.replace(
      appendSearchParams(
        `/${locale}${buildExploreCategoryHref(
          category,
        )}`,
        params,
      ),
      { scroll: false },
    );
  };

  const load = useCallback(
    async (signal: AbortSignal) => {
      const cachedPayload =
        CATEGORY_OVERVIEW_CACHE.get(
          category.slug,
        );

      if (cachedPayload) {
        setPayload(cachedPayload);
      }

      setLoading(true);
      setError(false);

      try {
        const response = await fetch(
          `/api/explore/${encodeURIComponent(
            category.slug,
          )}`,
          {
            cache: 'no-store',
            signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            'explore_failed',
          );
        }

        const nextPayload =
          (await response.json()) as ExploreCategoryResponse;

        if (signal.aborted) return;

        rememberBounded(
          CATEGORY_OVERVIEW_CACHE,
          category.slug,
          nextPayload,
        );

        setPayload(nextPayload);
      } catch {
        if (!signal.aborted) {
          setError(true);
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [category.slug],
  );

  useEffect(() => {
    if (isFilteredSearchMode) {
      setLoading(false);
      return;
    }

    const controller =
      new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [
    isFilteredSearchMode,
    load,
    retryKey,
  ]);

  useEffect(() => {
    if (!isFilteredSearchMode) return;

    const controller =
      new AbortController();

    const params =
      new URLSearchParams(searchKey);

    params.delete('type');
    params.set(
      'category',
      category.slug,
    );

    // Always send an explicit side.
    params.set(
      'side',
      searchSide,
    );

    if (searchSide === 'demand') {
      params.set('tab', 'needs');
    } else if (
      params.get('tab') === 'needs'
    ) {
      params.set('tab', 'all');
    }

    const requestKey =
      params.toString();

    const cachedPayload =
      CATEGORY_SEARCH_CACHE.get(
        requestKey,
      );

    if (cachedPayload) {
      setSearchPayload(
        cachedPayload,
      );
    } else {
      setSearchPayload(
        emptyGlobalSearchResponse(
          searchState.query,
        ),
      );
    }

    queueMicrotask(() => {
      if (controller.signal.aborted) return;

      setSearchLoading(true);
      setSearchError(false);
    });

    void fetch(
      `/api/search?${requestKey}`,
      {
        cache: 'no-store',
        signal: controller.signal,
      },
    )
      .then(async response => {
        if (!response.ok) {
          throw new Error(
            'search_failed',
          );
        }

        return (await response.json()) as GlobalSearchResponse;
      })
      .then(nextPayload => {
        if (controller.signal.aborted) return;

        rememberBounded(
          CATEGORY_SEARCH_CACHE,
          requestKey,
          nextPayload,
        );

        setSearchPayload(
          nextPayload,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSearchError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    category.slug,
    isFilteredSearchMode,
    searchKey,
    searchRetryKey,
    searchSide,
    searchState.query,
  ]);

  useEffect(() => {
    void trackLajukanEvent(
      'explore_section_view',
      {
        properties: {
          locale,
          source: 'explore_category',
          route:
            buildExploreCategoryHref({
              slug: category.slug,
            }),
          category: category.slug,
        },
      },
    );
  }, [
    category.slug,
    locale,
  ]);

  const groups = payload?.groups;

  /**
   * Supply listing data.
   *
   * These are not needs.
   */
  const listings = useMemo(
    () =>
      [
        ...(groups?.products.items ||
          []),
        ...(groups?.services.items ||
          []),
      ].map(item =>
        withResolvedSide(
          item,
          'supply',
        ),
      ),
    [groups],
  );

  /**
   * Supply business data.
   */
  const businesses = useMemo(
    () =>
      (groups?.businesses.items ||
        []).map(item =>
          withResolvedSide(
            item,
            'supply',
          ),
        ),
    [groups],
  );

  /**
   * Demand / needs data.
   */
  const needs = useMemo(
    () =>
      (groups?.needs.items || [])
        .map(item =>
          withResolvedSide(
            item,
            'demand',
          ),
        ),
    [groups],
  );

  const communityGroups =
    useMemo(
      () =>
        (
          groups?.communities
            .items || []
        ).filter(
          item =>
            item.metadata
              .entityType ===
            'group',
        ),
      [groups],
    );

  const communityDiscussions =
    useMemo(
      () =>
        (
          groups?.communities
            .items || []
        ).filter(
          item =>
            item.metadata
              .entityType ===
            'discussion',
        ),
      [groups],
    );

  const marketplaceDemandTotal =
    groups?.needs.total || 0;

  const marketplaceSupplyTotal =
    (groups?.products.total || 0) +
    (groups?.services.total || 0) +
    (groups?.businesses.total || 0);

  const primaryResultTotal =
    category.id === 'video'
      ? groups?.videos.total || 0
      : category.id === 'community'
        ? groups?.communities.total || 0
        : searchSide === 'demand'
          ? marketplaceDemandTotal
          : marketplaceSupplyTotal;

  const dataSections =
    category.sections.filter(
      section => {
        if (
          category.id ===
            'community' ||
          category.id === 'video'
        ) {
          return [
            'communities',
            'videos',
            'latest-listings',
          ].includes(section.key);
        }

        if (searchSide === 'demand') {
          return (
            section.key ===
            'latest-needs'
          );
        }

        return [
          'featured-providers',
          'latest-listings',
        ].includes(section.key);
      },
    );

  const submitSearch = (
    nextQuery = queryInput,
  ) => {
    const clean =
      normalizeQuery(nextQuery);

    if (clean.length < 2) {
      return;
    }

    if (
      category.id === 'community' ||
      category.id === 'video'
    ) {
      const target =
        category.id ===
        'community'
          ? 'community'
          : 'reels';

      router.push(
        `/${locale}/${target}?q=${encodeURIComponent(
          clean,
        )}`,
      );

      return;
    }

    const params =
      new URLSearchParams(searchKey);

    params.set('q', clean);

    // Explicitly preserve selected marketplace side.
    params.set(
      'side',
      searchSide,
    );

    if (searchSide === 'demand') {
      params.set(
        'tab',
        'needs',
      );
    } else if (
      params.get('tab') ===
      'needs'
    ) {
      params.set(
        'tab',
        'all',
      );
    }

    params.delete('cursor');
    params.delete('type');
    params.delete('category');

    router.push(
      appendSearchParams(
        `/${locale}${buildExploreCategoryHref(
          category,
        )}`,
        params,
      ),
    );
  };

  const selectSearchTab = (
    tab: GlobalSearchTab,
  ) => {
    const params =
      new URLSearchParams(searchKey);

    if (tab === 'all') {
      params.delete('tab');
    } else {
      params.set(
        'tab',
        tab,
      );
    }

    // Keep current market side explicit.
    params.set(
      'side',
      searchSide,
    );

    if (
      searchSide === 'demand'
    ) {
      params.set(
        'tab',
        'needs',
      );
    }

    params.delete('cursor');

    router.push(
      appendSearchParams(
        `/${locale}${buildExploreCategoryHref(
          category,
        )}`,
        params,
      ),
      { scroll: false },
    );
  };

  const isSocialCategory =
    category.id ===
      'community' ||
    category.id ===
      'video';

  const effectiveSearchTab:
    GlobalSearchTab =
    isSocialCategory
      ? searchState.tab
      : searchSide === 'demand'
        ? 'needs'
        : [
              'all',
              'products',
              'services',
              'businesses',
            ].includes(
              searchState.tab,
            )
          ? searchState.tab
          : 'all';

  const categoryRailItems =
    isSocialCategory
      ? LAJUKAN_EXPLORE_CATEGORIES
      : MARKETPLACE_EXPLORE_CATEGORIES;

  const selectedSubcategory =
    new URLSearchParams(
      searchKey,
    ).get('subcategory');

  useEffect(() => {
    if (!categoryRailApi) return;

    const activeIndex =
      categoryRailItems.findIndex(
        item =>
          item.id === category.id,
      );

    if (activeIndex < 0) return;

    categoryRailApi.scrollTo(
      activeIndex +
        (isSocialCategory
          ? 0
          : 1),
      true,
    );
  }, [
    category.id,
    categoryRailApi,
    categoryRailItems,
    isSocialCategory,
  ]);

  useEffect(() => {
    if (
      !subcategoryRailApi ||
      !selectedSubcategory
    ) {
      return;
    }

    const activeIndex =
      category.subcategories.findIndex(
        item =>
          item.slug ===
          selectedSubcategory,
      );

    if (activeIndex >= 0) {
      subcategoryRailApi.scrollTo(
        activeIndex + 1,
        true,
      );
    }
  }, [
    category.subcategories,
    selectedSubcategory,
    subcategoryRailApi,
  ]);

  const searchAction =
    isSocialCategory
      ? `/${locale}/${
          category.id ===
          'community'
            ? 'community'
            : 'reels'
        }`
      : `/${locale}${buildExploreCategoryHref(
          category,
        )}`;

  const guidesConfig =
    category.sections.find(
      section =>
        section.key ===
        'guides',
    );

  const faqConfig =
    category.sections.find(
      section =>
        section.key === 'faq',
    );

  const showHelpSection =
    !payload?.degraded &&
    primaryResultTotal > 0 &&
    Boolean(
      (guidesConfig &&
        payload?.guides.length) ||
        (faqConfig &&
          payload?.faq.length),
    );

  const categoryCopy =
    exploreCategoryCopy(
      category.id,
      isId,
      searchSide,
    );

  const categoryTitle =
    categoryCopy.title;

  const heroDescription =
    categoryCopy.description;

  const searchPlaceholder =
    categoryCopy.placeholder;

  return (
    <div className="min-h-[100svh] overflow-x-clip bg-[color:var(--app-surface-muted)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10">
      <div className="lg:hidden">
        <Header />
        <div className="h-[calc(52px+env(safe-area-inset-top))]" />
      </div>

      <main className="mx-auto w-full min-w-0 max-w-[1080px] px-3 py-2.5 sm:px-5 sm:py-4 lg:px-6 lg:py-5">
        <Link
          href="/explore"
          aria-label={
            isId
              ? 'Kembali ke Jelajahi'
              : 'Back to Explore'
          }
          className="mb-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg px-1 text-[11px] font-bold text-zinc-500 transition hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 dark:text-zinc-400 dark:hover:text-white sm:mb-2.5 sm:text-xs"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />

          {isId
            ? 'Jelajahi'
            : 'Explore'}
        </Link>

        <ExploreSurface
          elevated
          className="p-3 sm:p-4"
        >
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(330px,430px)] lg:items-center lg:gap-5">
            <div className="flex min-w-0 items-center gap-3">
              <ExploreArtwork
                src={category.image}
                alt=""
                visualId={
                  category.id
                }
                size="sm"
              />

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 className="min-w-0 text-[clamp(1.25rem,4vw,2rem)] font-black leading-[1.05] tracking-[-0.035em] text-zinc-950 dark:text-white">
                    {categoryTitle}
                  </h1>

                  {!loading &&
                  primaryResultTotal >
                    0 &&
                  !isFilteredSearchMode ? (
                    <span className="inline-flex shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400 sm:text-[10px]">
                      {primaryResultTotal.toLocaleString(
                        locale === 'id'
                          ? 'id-ID'
                          : 'en-US',
                      )}{' '}
                      {isId
                        ? 'hasil'
                        : 'results'}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 line-clamp-2 max-w-2xl text-[10px] font-medium leading-4 text-zinc-500 dark:text-zinc-400 sm:text-[11px] sm:leading-[18px]">
                  {heroDescription}
                </p>
              </div>
            </div>

            <div className="min-w-0">
              <form
                action={
                  searchAction
                }
                method="get"
                role="search"
                onSubmit={event => {
                  event.preventDefault();

                  const submitted =
                    new FormData(
                      event.currentTarget,
                    ).get(
                      'q',
                    );

                  submitSearch(
                    typeof submitted ===
                      'string'
                      ? submitted
                      : queryInput,
                  );
                }}
                className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-[13px] border border-zinc-200 bg-zinc-50 p-1 pl-2.5 transition focus-within:border-emerald-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-900/70 dark:focus-within:border-emerald-800 dark:focus-within:bg-zinc-950"
              >
                <Search
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-zinc-400"
                />

                <label
                  htmlFor={`explore-category-search-${category.id}`}
                  className="sr-only"
                >
                  {isId
                    ? `Cari di ${category.labelId}`
                    : `Search ${category.labelEn}`}
                </label>

                <input
                  type="search"
                  id={`explore-category-search-${category.id}`}
                  name="q"
                  value={
                    queryInput
                  }
                  onChange={event =>
                    setQueryInput(
                      event.target
                        .value,
                    )
                  }
                  placeholder={
                    searchPlaceholder
                  }
                  className={cn(
                    'min-w-0 flex-1 bg-transparent outline-none',
                    'text-[11px] font-semibold text-zinc-800',
                    'placeholder:text-[9.5px] placeholder:font-medium placeholder:text-zinc-400',
                    'dark:text-zinc-100 dark:placeholder:text-zinc-600',
                    'min-[400px]:placeholder:text-[10px]',
                    'sm:text-xs sm:placeholder:text-[11px]',
                  )}
                  autoComplete="off"
                  enterKeyHint="search"
                />

                <button
                  type="submit"
                  disabled={
                    queryInput.trim()
                      .length < 2
                  }
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] bg-zinc-950 px-3 text-[10px] font-black text-white transition hover:bg-emerald-700 disabled:pointer-events-none dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 sm:text-[11px]',
                    queryInput.trim()
                      .length < 2 &&
                      'opacity-40',
                  )}
                >
                  {isId
                    ? 'Cari'
                    : 'Search'}
                </button>

                {!isSocialCategory ? (
                  <>
                    <input
                      type="hidden"
                      name="side"
                      value={
                        searchSide
                      }
                    />

                    {searchSide ===
                    'demand' ? (
                      <input
                        type="hidden"
                        name="tab"
                        value="needs"
                      />
                    ) : null}
                  </>
                ) : null}
              </form>

              {queryInput.trim()
                .length === 1 ? (
                <p
                  className="mt-1 px-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-400"
                  role="status"
                >
                  {isId
                    ? 'Minimal 2 karakter.'
                    : 'Enter at least 2 characters.'}
                </p>
              ) : null}

              {!isSocialCategory ? (
                <div
                  role="group"
                  aria-label={
                    isId
                      ? 'Tujuan pencarian'
                      : 'Search purpose'
                  }
                  className="mt-2 grid grid-cols-2 gap-1 rounded-[12px] bg-zinc-100 p-1 dark:bg-zinc-900"
                >
                  <button
                    type="button"
                    aria-pressed={
                      searchSide ===
                      'supply'
                    }
                    onClick={() =>
                      selectSearchSide(
                        'supply',
                      )
                    }
                    className={cn(
                      'min-h-8 rounded-[9px] px-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 sm:text-[11px]',
                      searchSide ===
                        'supply'
                        ? 'bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950'
                        : 'text-zinc-500 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white',
                    )}
                  >
                    {isId
                      ? 'Menawarkan'
                      : 'Offering'}
                  </button>

                  <button
                    type="button"
                    aria-pressed={
                      searchSide ===
                      'demand'
                    }
                    onClick={() =>
                      selectSearchSide(
                        'demand',
                      )
                    }
                    className={cn(
                      'min-h-8 rounded-[9px] px-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 sm:text-[11px]',
                      searchSide ===
                        'demand'
                        ? 'bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950'
                        : 'text-zinc-500 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white',
                    )}
                  >
                    {isId
                      ? 'Membutuhkan'
                      : 'Looking for'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </ExploreSurface>

        <ExploreSurface className="mt-2.5 p-2.5 sm:p-3">
          <div className="flex min-h-7 items-center justify-between gap-2">
            <h2 className="text-[11px] font-black text-zinc-900 dark:text-zinc-100 sm:text-xs">
              {isId
                ? 'Kategori'
                : 'Categories'}
            </h2>

            <EmblaDesktopControls
              api={categoryRailApi}
              isId={isId}
              compact
            />
          </div>

          <div
            ref={
              categoryRailRef
            }
            className="mt-1.5 w-full min-w-0 cursor-grab overflow-hidden pb-1 pt-1 active:cursor-grabbing"
            aria-label={
              isId
                ? 'Kategori Jelajahi'
                : 'Explore categories'
            }
          >
            <div className="flex touch-pan-y gap-1.5 [backface-visibility:hidden] [will-change:transform]">
              {!isSocialCategory ? (
                <div className="min-w-0 shrink-0 flex-[0_0_68px] sm:flex-[0_0_74px]">
                  <Link
                    href={(() => {
                      const params =
                        new URLSearchParams();

                      const query =
                        new URLSearchParams(
                          searchKey,
                        ).get('q');

                      if (query) {
                        params.set(
                          'q',
                          query,
                        );
                      }

                      params.set(
                        'side',
                        searchSide,
                      );

                      params.set(
                        'tab',
                        searchSide ===
                          'demand'
                          ? 'needs'
                          : 'all',
                      );

                      return `/${locale}/explore?${params.toString()}`;
                    })()}
                    className="flex h-full min-h-[78px] flex-col items-center justify-center rounded-[13px] border border-zinc-200 bg-white p-1.5 text-center text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    <ExploreArtwork
                      src={
                        ALL_CATEGORY_IMAGE
                      }
                      alt=""
                      visualId="all"
                      size="xs"
                      muted
                    />

                    <span className="mt-1 line-clamp-1 text-[9px] font-black sm:text-[10px]">
                      {isId
                        ? 'Semua'
                        : 'All'}
                    </span>
                  </Link>
                </div>
              ) : null}

              {categoryRailItems.map(
                item => {
                  const active =
                    item.id ===
                    category.id;

                  const href =
                    buildCategorySearchHref(
                      {
                        category:
                          item,
                        side:
                          isSocialCategory
                            ? undefined
                            : searchSide,
                      },
                    );

                  const label =
                    locale === 'id'
                      ? item.shortLabelId
                      : item.shortLabelEn;

                  const content = (
                    <>
                      <ExploreArtwork
                        src={
                          item.image
                        }
                        alt=""
                        visualId={
                          item.id
                        }
                        size="xs"
                        active={
                          active
                        }
                        muted={
                          !active
                        }
                      />

                      <span
                        className={cn(
                          'mt-1 line-clamp-2 text-[9px] font-black leading-[11px] sm:text-[10px] sm:leading-3',
                          active
                            ? 'text-white dark:text-zinc-950'
                            : 'text-zinc-700 dark:text-zinc-200',
                        )}
                      >
                        {label}
                      </span>
                    </>
                  );

                  return (
                    <div
                      key={
                        item.id
                      }
                      className="min-w-0 shrink-0 flex-[0_0_68px] sm:flex-[0_0_74px]"
                    >
                      {active ? (
                        <span
                          aria-current="page"
                          className="flex h-full min-h-[78px] flex-col items-center justify-center rounded-[13px] border border-zinc-950 bg-zinc-950 p-1.5 text-center text-white shadow-sm dark:border-white dark:bg-white dark:text-zinc-950"
                        >
                          {content}
                        </span>
                      ) : (
                        <Link
                          href={href}
                          className="group flex h-full min-h-[78px] flex-col items-center justify-center rounded-[13px] border border-zinc-200/80 bg-white p-1.5 text-center transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          {content}
                        </Link>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </div>

          {category.subcategories.length >
          0 ? (
            <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.06em] text-zinc-400 sm:text-[10px]">
                  {isId
                    ? 'Jenis'
                    : 'Type'}
                </span>

                <div
                  ref={
                    subcategoryRailRef
                  }
                  className="min-w-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
                  aria-label={
                    isId
                      ? 'Subkategori'
                      : 'Subcategories'
                  }
                >
                  <div className="flex touch-pan-y gap-1.5">
                    <div className="shrink-0">
                      <Link
                        href={buildCategorySearchHref(
                          {
                            category,
                            side:
                              isSocialCategory
                                ? undefined
                                : searchSide,
                            query:
                              new URLSearchParams(
                                searchKey,
                              ).get(
                                'q',
                              ) ||
                              undefined,
                          },
                        )}
                        aria-current={
                          !selectedSubcategory
                            ? 'page'
                            : undefined
                        }
                        className={cn(
                          'inline-flex h-8 items-center rounded-full border px-3 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 sm:text-[10px]',
                          !selectedSubcategory
                            ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                            : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white',
                        )}
                      >
                        {isId
                          ? 'Semua'
                          : 'All'}
                      </Link>
                    </div>

                    {category.subcategories.map(
                      (
                        subcategory,
                        index,
                      ) => {
                        const selected =
                          selectedSubcategory ===
                          subcategory.slug;

                        return (
                          <div
                            key={
                              subcategory.slug
                            }
                            className="shrink-0"
                          >
                            <Link
                              href={buildCategorySearchHref(
                                {
                                  category,
                                  side:
                                    isSocialCategory
                                      ? undefined
                                      : searchSide,
                                  subcategory:
                                    subcategory.slug,
                                },
                              )}
                              aria-current={
                                selected
                                  ? 'page'
                                  : undefined
                              }
                              onClick={() => {
                                void trackLajukanEvent(
                                  'explore_subcategory_click',
                                  {
                                    properties:
                                      {
                                        locale,
                                        source:
                                          'explore_category',
                                        route:
                                          buildExploreCategoryHref(
                                            category,
                                          ),
                                        category:
                                          category.slug,
                                        subcategory:
                                          subcategory.slug,
                                        position:
                                          index,
                                        side:
                                          isSocialCategory
                                            ? undefined
                                            : searchSide,
                                      },
                                  },
                                );
                              }}
                              className={cn(
                                'inline-flex h-8 max-w-[190px] items-center rounded-full border px-3 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 sm:max-w-[220px] sm:text-[10px]',
                                selected
                                  ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                                  : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white',
                              )}
                            >
                              <span className="truncate">
                                {isId
                                  ? subcategory.labelId
                                  : subcategory.labelEn}
                              </span>
                            </Link>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>

                {category
                  .subcategories
                  .length >
                3 ? (
                  <div className="hidden shrink-0 sm:block">
                    <EmblaDesktopControls
                      api={
                        subcategoryRailApi
                      }
                      isId={
                        isId
                      }
                      compact
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </ExploreSurface>

        {isFilteredSearchMode ? (
          <section className="mt-3 min-w-0">
            <ExploreSearchResults
              payload={
                searchPayload
              }
              loading={
                searchLoading
              }
              error={
                searchError
              }
              locale={
                locale
              }
              searchSide={searchSide}
              activeTab={
                effectiveSearchTab
              }
              onSelectTab={
                selectSearchTab
              }
              onRetry={() =>
                setSearchRetryKey(
                  value => value + 1,
                )
              }
            />
          </section>
        ) : null}

        {!isFilteredSearchMode &&
        loading &&
        !payload ? (
          <SectionSkeleton />
        ) : null}

        {!isFilteredSearchMode &&
        error &&
        !payload ? (
          <ExploreSurface className="mt-3 border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/25">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-black text-amber-950 dark:text-amber-100">
                  <CircleAlert className="h-4 w-4" />
                  {isId
                    ? 'Data belum bisa dimuat.'
                    : 'Data could not be loaded.'}
                </p>

                <p className="mt-1 text-xs text-amber-900/70 dark:text-amber-200/70">
                  {isId
                    ? 'Kamu masih bisa pindah kategori. Coba muat lagi.'
                    : 'You can still switch categories. Try loading again.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setRetryKey(
                    value =>
                      value + 1,
                  )
                }
                className="min-h-9 rounded-[11px] border border-amber-300 bg-white px-3 text-xs font-black text-amber-950 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
              >
                {isId
                  ? 'Coba lagi'
                  : 'Retry'}
              </button>
            </div>
          </ExploreSurface>
        ) : null}

        {!isFilteredSearchMode &&
        payload ? (
          <>
            {!payload.degraded
              ? dataSections.map(
                  section => {
                    if (
                      section.key ===
                      'latest-needs'
                    ) {
                      return (
                        <DataSection
                          key={
                            section.key
                          }
                          config={
                            section
                          }
                          items={
                            needs
                          }
                          locale={
                            locale
                          }
                          category={
                            category
                          }
                          kind="listing"
                        />
                      );
                    }

                    if (
                      section.key ===
                      'featured-providers'
                    ) {
                      return (
                        <DataSection
                          key={
                            section.key
                          }
                          config={
                            section
                          }
                          items={
                            businesses
                          }
                          locale={
                            locale
                          }
                          category={
                            category
                          }
                          kind="business"
                        />
                      );
                    }

                    if (
                      section.key ===
                      'latest-listings'
                    ) {
                      return (
                        <DataSection
                          key={
                            section.key
                          }
                          config={
                            section
                          }
                          items={
                            category.id ===
                            'community'
                              ? communityDiscussions
                              : category.id ===
                                  'video'
                                ? groups
                                    ?.videos
                                    .items ||
                                  []
                                : listings
                          }
                          locale={
                            locale
                          }
                          category={
                            category
                          }
                          kind={
                            category.id ===
                            'community'
                              ? 'community'
                              : category.id ===
                                  'video'
                                ? 'video'
                                : 'listing'
                          }
                        />
                      );
                    }

                    if (
                      section.key ===
                      'communities'
                    ) {
                      return (
                        <DataSection
                          key={
                            section.key
                          }
                          config={
                            section
                          }
                          items={
                            communityGroups
                          }
                          locale={
                            locale
                          }
                          category={
                            category
                          }
                          kind="community"
                        />
                      );
                    }

                    if (
                      section.key ===
                      'videos'
                    ) {
                      return (
                        <DataSection
                          key={
                            section.key
                          }
                          config={
                            section
                          }
                          items={
                            groups
                              ?.videos
                              .items ||
                            []
                          }
                          locale={
                            locale
                          }
                          category={
                            category
                          }
                          kind="video"
                        />
                      );
                    }

                    return null;
                  },
                )
              : null}

            {payload.degraded ? (
              <ExploreSurface className="mt-3 border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/25">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-black text-amber-950 dark:text-amber-100">
                      <CircleAlert className="h-4 w-4" />
                      {isId
                        ? 'Data sedang tidak tersedia.'
                        : 'Data is temporarily unavailable.'}
                    </p>

                    <p className="mt-1 text-xs text-amber-900/70 dark:text-amber-200/70">
                      {isId
                        ? 'Coba muat ulang.'
                        : 'Please retry.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setRetryKey(
                        value =>
                          value + 1,
                      )
                    }
                    className="min-h-9 rounded-[11px] border border-amber-300 bg-white px-3 text-xs font-black text-amber-950 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
                  >
                    {isId
                      ? 'Coba lagi'
                      : 'Retry'}
                  </button>
                </div>
              </ExploreSurface>
            ) : null}

            {!payload.degraded &&
            primaryResultTotal ===
              0 ? (
              <div className="mt-3">
                <EmptyPrimarySection
                  locale={locale}
                  category={
                    category
                  }
                  mode={
                    searchSide
                  }
                />
              </div>
            ) : null}

            {showHelpSection ? (
              <ExploreSurface className="mt-2.5 px-3 py-2.5 sm:px-4">
                <details className="group">
                  <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-4 rounded-xl text-left marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25">
                    <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 sm:text-sm">
                      {isId
                        ? 'Panduan & bantuan'
                        : 'Guides & help'}
                    </span>

                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition group-open:rotate-180" />
                  </summary>

                  <div className="mt-3">
                    {guidesConfig &&
                    payload.guides
                      .length ? (
                      <GuidesSection
                        config={
                          guidesConfig
                        }
                        items={
                          payload.guides
                        }
                        locale={
                          locale
                        }
                      />
                    ) : null}

                    {faqConfig &&
                    payload.faq
                      .length ? (
                      <FaqSection
                        config={
                          faqConfig
                        }
                        items={
                          payload.faq
                        }
                        locale={
                          locale
                        }
                      />
                    ) : null}
                  </div>
                </details>
              </ExploreSurface>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
