'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  Search,
} from 'lucide-react';
import {
  useRouter,
  useSearchParams,
} from 'next/navigation';

import { ExploreSearchResults } from '@/components/explore/ExploreSearchResults';
import { EmblaDesktopControls } from '@/components/common/EmblaDesktopControls';
import { Header } from '@/components/layout/Header';
import {
  ExploreArtwork,
  ExploreModeTabs,
  ExploreSurface,
  useExploreEmblaRail,
} from '@/components/explore/ExploreVisualSystem';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import {
  MARKETPLACE_EXPLORE_CATEGORIES,
  buildExploreCategoryHref,
  getExploreCategoryBySlug,
  type LajukanLocale,
} from '@/lib/discovery/lajukanCategories';
import {
  emptyGlobalSearchResponse,
  parseGlobalSearchState,
  type GlobalSearchResponse,
  type GlobalSearchSide,
  type GlobalSearchTab,
} from '@/lib/search/globalSearch';
import { cn } from '@/lib/utils';

function appendSearchParams(
  path: string,
  params: URLSearchParams,
) {
  const search = params.toString();

  return search
    ? `${path}?${search}`
    : path;
}

type ExploreSearchMode =
  | 'supply'
  | 'demand'
  | 'people'
  | 'references';

const SEARCH_RESPONSE_CACHE =
  new Map<string, GlobalSearchResponse>();

const MAX_SEARCH_CACHE_ENTRIES = 12;

const EXPLORE_ADVANCED_FILTER_KEYS = [
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
] as const;

const SUPPLY_TABS = new Set([
  'all',
  'products',
  'services',
  'businesses',
]);

const ALL_CATEGORY_IMAGE =
  '/images/hero/menu/semua-01.png';

function rememberSearchResponse(
  key: string,
  payload: GlobalSearchResponse,
) {
  SEARCH_RESPONSE_CACHE.delete(key);
  SEARCH_RESPONSE_CACHE.set(
    key,
    payload,
  );

  while (
    SEARCH_RESPONSE_CACHE.size >
    MAX_SEARCH_CACHE_ENTRIES
  ) {
    const oldestKey =
      SEARCH_RESPONSE_CACHE
        .keys()
        .next()
        .value;

    if (!oldestKey) break;

    SEARCH_RESPONSE_CACHE.delete(
      oldestKey,
    );
  }
}

function normalizeQuery(
  value: string,
): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Marketplace canonicalization:
 *
 * supply:
 *   side=supply
 *   tab=all|products|services|businesses
 *
 * demand:
 *   side=demand
 *   tab=needs
 */
function canonicalizeMarketplaceParams(
  params: URLSearchParams,
  side: 'supply' | 'demand',
) {
  params.set('side', side);

  if (side === 'demand') {
    params.set('tab', 'needs');
    return;
  }

  const requestedTab =
    params.get('tab');

  params.set(
    'tab',
    requestedTab &&
      SUPPLY_TABS.has(requestedTab)
      ? requestedTab
      : 'all',
  );
}

export function ExploreAllSearchClient({
  locale,
}: {
  locale: LajukanLocale;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchKey =
    searchParams.toString();

  const state = useMemo(
    () =>
      parseGlobalSearchState(
        new URLSearchParams(
          searchKey,
        ),
      ),
    [searchKey],
  );

  const activeCategory = useMemo(
    () =>
      getExploreCategoryBySlug(
        state.category,
      ),
    [state.category],
  );

  const activeSubcategory =
    useMemo(
      () =>
        activeCategory?.subcategories.find(
          subcategory =>
            subcategory.slug ===
            state.subcategory,
        ),
      [
        activeCategory,
        state.subcategory,
      ],
    );

  const isId = locale === 'id';

  const referenceMode =
    state.tab === 'references';

  const peopleMode =
    state.tab === 'users';

  /**
   * Marketplace default is explicitly supply.
   */
  const searchSide: Exclude<
    GlobalSearchSide,
    'all'
  > =
    state.side === 'demand'
      ? 'demand'
      : 'supply';

  const [queryDraft, setQueryDraft] =
    useState({
      source: state.query,
      value: state.query,
    });

  const queryInput =
    queryDraft.source ===
    state.query
      ? queryDraft.value
      : state.query;

  const setQueryInput = (
    value: string,
  ) => {
    setQueryDraft({
      source: state.query,
      value,
    });
  };

  const [payload, setPayload] =
    useState<GlobalSearchResponse>(
      () =>
        emptyGlobalSearchResponse(
          state.query,
        ),
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  const [retryKey, setRetryKey] =
    useState(0);

  const {
    emblaRef: categoryRailRef,
    emblaApi: categoryRailApi,
  } =
    useExploreEmblaRail();

  const {
    emblaRef: subcategoryRailRef,
    emblaApi: subcategoryRailApi,
  } =
    useExploreEmblaRail();

  /**
   * Keep category carousel synchronized.
   */
  useEffect(() => {
    if (!categoryRailApi) {
      return;
    }

    const index = activeCategory
      ? MARKETPLACE_EXPLORE_CATEGORIES.findIndex(
          item =>
            item.id ===
            activeCategory.id,
        ) + 1
      : 0;

    categoryRailApi.scrollTo(
      Math.max(0, index),
      true,
    );
  }, [
    activeCategory,
    categoryRailApi,
  ]);

  /**
   * Keep subcategory carousel synchronized.
   */
  useEffect(() => {
    if (
      !subcategoryRailApi ||
      !activeSubcategory ||
      !activeCategory
    ) {
      return;
    }

    const index =
      activeCategory.subcategories.findIndex(
        item =>
          item.slug ===
          activeSubcategory.slug,
      );

    if (index >= 0) {
      subcategoryRailApi.scrollTo(
        index + 1,
        true,
      );
    }
  }, [
    activeCategory,
    activeSubcategory,
    subcategoryRailApi,
  ]);

  /**
   * Canonicalize URL state.
   *
   * This prevents cases such as:
   *
   * /explore
   * /explore?tab=all
   * /explore?side=
   * /explore?side=supply
   *
   * from representing different states accidentally.
   */
  useEffect(() => {
    const params =
      new URLSearchParams(
        searchKey,
      );

    let changed = false;

    const rawQuery =
      params.get('q') || '';

    const cleanQuery =
      normalizeQuery(rawQuery);

    if (
      rawQuery !== cleanQuery ||
      cleanQuery.length === 1
    ) {
      if (
        cleanQuery.length >= 2
      ) {
        params.set(
          'q',
          cleanQuery,
        );
      } else {
        params.delete('q');
      }

      changed = true;
    }

    /**
     * References and people are not marketplace modes.
     * Remove marketplace-only parameters.
     */
    if (
      referenceMode ||
      peopleMode
    ) {
      if (params.has('side')) {
        params.delete('side');
        changed = true;
      }

      if (
        params.has('category')
      ) {
        params.delete('category');
        changed = true;
      }

      if (
        params.has(
          'subcategory',
        )
      ) {
        params.delete(
          'subcategory',
        );
        changed = true;
      }

      if (
        params.has('cursor') &&
        !referenceMode
      ) {
        params.delete('cursor');
        changed = true;
      }

      if (
        peopleMode &&
        params.get('tab') !==
          'users'
      ) {
        params.set(
          'tab',
          'users',
        );
        changed = true;
      }

      if (
        referenceMode &&
        params.get('tab') !==
          'references'
      ) {
        params.set(
          'tab',
          'references',
        );
        changed = true;
      }
    } else {
      /**
       * Marketplace always has explicit side.
       */
      const canonicalSide =
        state.side === 'demand'
          ? 'demand'
          : 'supply';

      const previousSide =
        params.get('side');

      if (
        previousSide !==
        canonicalSide
      ) {
        params.set(
          'side',
          canonicalSide,
        );
        changed = true;
      }

      const previousTab =
        params.get('tab');

      if (
        canonicalSide ===
        'demand'
      ) {
        if (
          previousTab !==
          'needs'
        ) {
          params.set(
            'tab',
            'needs',
          );

          changed = true;
        }
      } else {
        const canonicalTab: string =
          previousTab &&
          SUPPLY_TABS.has(
            previousTab,
          )
            ? previousTab
            : 'all';

        if (
          previousTab !==
          canonicalTab
        ) {
          params.set(
            'tab',
            canonicalTab,
          );

          changed = true;
        }
      }

      if (
        params.has('cursor')
      ) {
        params.delete(
          'cursor',
        );
        changed = true;
      }

      /**
       * Validate category.
       */
      const rawCategory =
        params.get(
          'category',
        ) || '';

      const validCategory =
        rawCategory
          ? getExploreCategoryBySlug(
              rawCategory,
            )
          : undefined;

      if (
        rawCategory &&
        !validCategory
      ) {
        params.delete(
          'category',
        );
        params.delete(
          'subcategory',
        );
        changed = true;
      } else if (
        validCategory &&
        params.has(
          'subcategory',
        )
      ) {
        const subcategory =
          params.get(
            'subcategory',
          ) || '';

        const validSubcategory =
          validCategory.subcategories.some(
            item =>
              item.slug ===
              subcategory,
          );

        if (!validSubcategory) {
          params.delete(
            'subcategory',
          );
          changed = true;
        }
      }
    }

    if (
      params.has('type')
    ) {
      params.delete('type');
      changed = true;
    }

    if (changed) {
      router.replace(
        appendSearchParams(
          `/${locale}/explore`,
          params,
        ),
        {
          scroll: false,
        },
      );
    }
  }, [
    locale,
    peopleMode,
    referenceMode,
    router,
    searchKey,
    state.side,
    state.tab,
  ]);

  /**
   * Fetch search results.
   */
  useEffect(() => {
    const controller =
      new AbortController();

    const params =
      new URLSearchParams(
        searchKey,
      );

    params.delete('type');

    if (referenceMode) {
      params.delete(
        'category',
      );
      params.delete(
        'subcategory',
      );
      params.delete('side');

      params.set(
        'tab',
        'references',
      );
    } else if (peopleMode) {
      params.delete('side');
      params.delete(
        'category',
      );
      params.delete(
        'subcategory',
      );
      params.delete(
        'cursor',
      );

      params.set(
        'tab',
        'users',
      );
    } else {
      /**
       * Marketplace:
       * ALWAYS explicitly specify side.
       */
      canonicalizeMarketplaceParams(
        params,
        searchSide,
      );

      params.delete(
        'cursor',
      );
    }

    const requestKey =
      params.toString();

    const cachedPayload =
      SEARCH_RESPONSE_CACHE.get(
        requestKey,
      );

    queueMicrotask(() => {
      if (
        controller.signal.aborted
      ) {
        return;
      }

      if (cachedPayload) {
        setPayload(
          cachedPayload,
        );
      } else {
        setPayload(
          emptyGlobalSearchResponse(
            state.query,
          ),
        );
      }

      setLoading(true);
      setError(false);
    });

    void fetch(
      `/api/search?${requestKey}`,
      {
        cache: 'no-store',
        signal:
          controller.signal,
      },
    )
      .then(
        async response => {
          if (!response.ok) {
            throw new Error(
              'search_failed',
            );
          }

          return (await response.json()) as GlobalSearchResponse;
        },
      )
      .then(
        nextPayload => {
          if (
            controller.signal
              .aborted
          ) {
            return;
          }

          rememberSearchResponse(
            requestKey,
            nextPayload,
          );

          setPayload(
            nextPayload,
          );
        },
      )
      .catch(() => {
        if (
          !controller.signal
            .aborted
        ) {
          setError(true);
        }
      })
      .finally(() => {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(false);
        }
      });

    return () =>
      controller.abort();
  }, [
    peopleMode,
    referenceMode,
    retryKey,
    searchKey,
    searchSide,
    state.query,
  ]);

  /**
   * Update URL parameters.
   *
   * Marketplace side is preserved unless the caller
   * explicitly enters people/reference mode.
   */
  const updateParams = (
    changes: Record<
      string,
      string | null
    >,
    mode:
      | 'push'
      | 'replace' = 'push',
  ) => {
    const params =
      new URLSearchParams(
        searchKey,
      );

    Object.entries(changes).forEach(
      ([key, value]) => {
        const isDefaultFilterValue =
          (key === 'sort' &&
            value ===
              'relevance') ||
          ([
            'condition',
            'service_mode',
            'status',
            'privacy',
          ].includes(key) &&
            value === 'all');

        if (
          value === null ||
          value === '' ||
          isDefaultFilterValue
        ) {
          params.delete(key);
        } else {
          params.set(
            key,
            value,
          );
        }
      },
    );

    /**
     * Canonicalize marketplace state after changes.
     */
    const targetTab =
      params.get('tab');

    const targetIsSpecialMode =
      targetTab ===
        'references' ||
      targetTab === 'users';

    if (!targetIsSpecialMode) {
      const targetSide =
        params.get('side') ===
        'demand'
          ? 'demand'
          : 'supply';

      canonicalizeMarketplaceParams(
        params,
        targetSide,
      );
    }

    params.delete('cursor');
    params.delete('type');

    router[mode](
      appendSearchParams(
        `/${locale}/explore`,
        params,
      ),
      {
        scroll: false,
      },
    );
  };

  /**
   * Submit search.
   */
  const submitSearch = (
    nextQuery = queryInput,
  ) => {
    const clean =
      normalizeQuery(nextQuery);

    if (
      clean.length === 1
    ) {
      return;
    }

    if (
      clean.length < 2 &&
      !referenceMode &&
      !peopleMode
    ) {
      return;
    }

    if (
      clean.length >= 2
    ) {
      void trackLajukanEvent(
        'navbar_search_submit',
        {
          properties: {
            locale,
            source:
              'explore_all',
            route: '/explore',
            query: clean,
            side:
              referenceMode
                ? 'reference'
                : peopleMode
                  ? 'people'
                  : searchSide,
          },
        },
      );
    }

    if (referenceMode) {
      updateParams({
        q: clean || null,
        side: null,
        tab: 'references',
      });

      return;
    }

    if (peopleMode) {
      updateParams({
        q: clean || null,
        side: null,
        tab: 'users',
      });

      return;
    }

    updateParams({
      q: clean || null,
      side: searchSide,
      tab:
        searchSide ===
        'demand'
          ? 'needs'
          : 'all',
    });
  };

  /**
   * Switch main discovery mode.
   */
  const selectMode = (
    mode: ExploreSearchMode,
  ) => {
    void trackLajukanEvent(
      'filter_applied',
      {
        properties: {
          locale,
          source:
            'explore_results_mode',
          route: '/explore',
          filter:
            'discovery_mode',
          value: mode,
        },
      },
    );

    if (
      mode ===
      'references'
    ) {
      updateParams(
        {
          side: null,
          tab: 'references',
          category: null,
          subcategory: null,
        },
        'replace',
      );

      return;
    }

    if (
      mode === 'people'
    ) {
      updateParams(
        {
          side: null,
          tab: 'users',
          category: null,
          subcategory: null,
        },
        'replace',
      );

      return;
    }

    /**
     * Marketplace mode.
     *
     * Supply and demand remain explicit.
     */
    updateParams(
      {
        side: mode,
        tab:
          mode ===
          'demand'
            ? 'needs'
            : 'all',
        category:
          activeCategory?.slug ||
          null,
        subcategory:
          activeSubcategory?.slug ||
          null,
      },
      'replace',
    );
  };

  /**
   * Change result tab.
   */
  const selectTab = (
    tab: GlobalSearchTab,
  ) => {
    if (
      tab === 'references'
    ) {
      selectMode(
        'references',
      );
      return;
    }

    if (
      peopleMode
    ) {
      return;
    }

    if (
      searchSide ===
      'demand'
    ) {
      /**
       * Demand has exactly one marketplace tab.
       */
      updateParams({
        side: 'demand',
        tab: 'needs',
      });

      void trackLajukanEvent(
        'search_tab_change',
        {
          properties: {
            locale,
            source:
              'explore_results',
            route: '/explore',
            contentType:
              'needs',
            query:
              state.query,
            side: 'demand',
          },
        },
      );

      return;
    }

    const safeTab =
      SUPPLY_TABS.has(
        tab,
      )
        ? tab
        : 'all';

    updateParams({
      side: 'supply',
      tab: safeTab,
    });

    void trackLajukanEvent(
      'search_tab_change',
      {
        properties: {
          locale,
          source:
            'explore_results',
          route: '/explore',
          contentType:
            safeTab,
          query:
            state.query,
          side: 'supply',
        },
      },
    );
  };

  /**
   * Select category while preserving current marketplace side.
   */
  const selectCategory = (
    category: ReturnType<
      typeof getExploreCategoryBySlug
    >,
  ) => {
    if (
      referenceMode ||
      peopleMode
    ) {
      return;
    }

    updateParams({
      category:
        category?.slug ||
        null,
      subcategory: null,
      side: searchSide,
    });

    void trackLajukanEvent(
      'search_category_change',
      {
        properties: {
          locale,
          source:
            'explore_results',
          route: '/explore',
          category:
            category?.slug ||
            'all',
          query: state.query,
          side: searchSide,
        },
      },
    );
  };

  /**
   * Select subcategory while preserving current side.
   */
  const selectSubcategory = (
    subcategory: string | null,
  ) => {
    if (
      referenceMode ||
      peopleMode
    ) {
      return;
    }

    updateParams({
      subcategory,
      side: searchSide,
    });

    void trackLajukanEvent(
      'search_subcategory_change',
      {
        properties: {
          locale,
          source:
            'explore_results',
          route: '/explore',
          category:
            activeCategory?.slug ||
            'all',
          subcategory:
            subcategory ||
            'all',
          query: state.query,
          side: searchSide,
        },
      },
    );
  };

  /**
   * Reference pagination.
   */
  const loadNextReferenceBatch = (
    cursor: string,
  ) => {
    const cleanCursor =
      cursor.trim();

    if (
      !referenceMode ||
      !cleanCursor ||
      cleanCursor.length >
        96 ||
      !/^\d{1,19}:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        cleanCursor,
      )
    ) {
      return;
    }

    const params =
      new URLSearchParams(
        searchKey,
      );

    params.set(
      'tab',
      'references',
    );

    params.set(
      'cursor',
      cleanCursor,
    );

    params.delete('side');
    params.delete(
      'category',
    );
    params.delete(
      'subcategory',
    );
    params.delete('type');

    router.push(
      appendSearchParams(
        `/${locale}/explore`,
        params,
      ),
      {
        scroll: false,
      },
    );
  };

  const normalizedQueryLength =
    queryInput.trim().length;

  const canSubmit =
    referenceMode ||
    peopleMode
      ? normalizedQueryLength ===
          0 ||
        normalizedQueryLength >=
          2
      : normalizedQueryLength >= 2;

  const advancedFilterCount =
    EXPLORE_ADVANCED_FILTER_KEYS.filter(
      key => {
        const value =
          new URLSearchParams(
            searchKey,
          ).get(key);

        return Boolean(
          value &&
            value.trim(),
        );
      },
    ).length;

  const clearAdvancedFilters =
    () => {
      updateParams(
        Object.fromEntries(
          EXPLORE_ADVANCED_FILTER_KEYS.map(
            key => [
              key,
              null,
            ],
          ),
        ),
        'replace',
      );
    };

  /**
   * Effective result tab.
   */
  const effectiveResultTab:
    GlobalSearchTab =
    referenceMode
      ? 'references'
      : peopleMode
        ? 'users'
        : searchSide ===
            'demand'
          ? 'needs'
          : SUPPLY_TABS.has(
                state.tab,
              )
            ? state.tab
            : 'all';

  /**
   * Active top-level mode.
   */
  const activeMode:
    ExploreSearchMode =
    referenceMode
      ? 'references'
      : peopleMode
        ? 'people'
        : searchSide;

  /**
   * Main discovery modes.
   */
  const modeOptions: Array<{
    value: ExploreSearchMode;
    label: string;
  }> = [
    {
      value: 'supply',
      label: isId
        ? 'Menawarkan'
        : 'Offering',
    },
    {
      value: 'demand',
      label: isId
        ? 'Membutuhkan'
        : 'Looking for',
    },
    {
      value: 'people',
      label: isId
        ? 'Orang'
        : 'People',
    },
    {
      value: 'references',
      label: isId
        ? 'Peta usaha'
        : 'Business map',
    },
  ];

  /**
   * Hero title follows actual mode.
   */
  const heroTitle =
    referenceMode
      ? isId
        ? 'Cari usaha di sekitar'
        : 'Find nearby businesses'
      : peopleMode
        ? isId
          ? 'Cari orang & keahlian'
          : 'Find people & skills'
        : searchSide ===
            'demand'
          ? isId
            ? 'Cari yang kamu butuhkan'
            : 'Find what you need'
          : isId
            ? 'Lihat penawaran usaha'
            : 'Explore business offers';

  /**
   * Search placeholder follows actual mode.
   */
  const searchPlaceholder =
    referenceMode
      ? isId
        ? 'Nama usaha atau lokasi...'
        : 'Business name or location...'
      : peopleMode
        ? isId
          ? 'Nama, keahlian, atau kota...'
          : 'Name, skill, or city...'
        : searchSide ===
            'demand'
          ? isId
            ? 'Cari produk, jasa, supplier, atau kebutuhan...'
            : 'Search products, services, suppliers, or needs...'
          : isId
            ? 'Cari produk, jasa, supplier, atau mesin...'
            : 'Search products, services, suppliers, or equipment...';

  return (
    <div className="min-h-[100svh] overflow-x-clip bg-[color:var(--app-surface-muted)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10">
      <div className="lg:hidden">
        <Header />
        <div className="h-[calc(52px+env(safe-area-inset-top))]" />
      </div>

      <main className="mx-auto w-full min-w-0 max-w-[1080px] px-3 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-5">
        <ExploreSurface
          elevated
          className="p-3 sm:p-4"
        >
          <h1 className="text-[clamp(1.25rem,4vw,1.8rem)] font-black leading-[1.05] tracking-[-0.035em] text-zinc-950 dark:text-white">
            {heroTitle}
          </h1>

          <form
            action={`/${locale}/explore`}
            method="get"
            role="search"
            aria-label={
              isId
                ? 'Cari di Lajukan'
                : 'Search Lajukan'
            }
            onSubmit={event => {
              event.preventDefault();

              const submitted =
                new FormData(
                  event.currentTarget,
                ).get('q');

              submitSearch(
                typeof submitted ===
                  'string'
                  ? submitted
                  : queryInput,
              );
            }}
            className="mt-2.5 flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-[13px] border border-zinc-200 bg-white p-1 pl-2.5 transition focus-within:border-emerald-300 focus-within:ring-3 focus-within:ring-emerald-500/5 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-emerald-800"
          >
            <Search
              className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />

            <label
              htmlFor="explore-results-search"
              className="sr-only"
            >
              {isId
                ? 'Cari di Lajukan'
                : 'Search Lajukan'}
            </label>

            <input
              type="search"
              id="explore-results-search"
              name="q"
              value={queryInput}
              onChange={event =>
                setQueryInput(
                  event.target.value,
                )
              }
              placeholder={
                searchPlaceholder
              }
              className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600 sm:text-sm"
              aria-describedby={
                normalizedQueryLength ===
                1
                  ? 'explore-results-search-help'
                  : undefined
              }
              aria-invalid={
                normalizedQueryLength ===
                1
                  ? true
                  : undefined
              }
              autoComplete="off"
              enterKeyHint="search"
            />

            {referenceMode ? (
              <input
                type="hidden"
                name="tab"
                value="references"
              />
            ) : peopleMode ? (
              <input
                type="hidden"
                name="tab"
                value="users"
              />
            ) : (
              <>
                <input
                  type="hidden"
                  name="side"
                  value={searchSide}
                />

                {searchSide ===
                'demand' ? (
                  <input
                    type="hidden"
                    name="tab"
                    value="needs"
                  />
                ) : (
                  <input
                    type="hidden"
                    name="tab"
                    value="all"
                  />
                )}
              </>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                'inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-[10px] bg-zinc-950 px-3 text-[10px] font-black text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:pointer-events-none dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 sm:px-3.5 sm:text-[11px]',
                !canSubmit &&
                  'opacity-40',
              )}
            >
              {(referenceMode ||
                peopleMode) &&
              !queryInput.trim()
                ? isId
                  ? 'Lihat'
                  : 'Browse'
                : isId
                  ? 'Cari'
                  : 'Search'}

              <ArrowRight
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
            </button>
          </form>

          {normalizedQueryLength ===
          1 ? (
            <p
              id="explore-results-search-help"
              role="status"
              className="mt-1.5 px-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
            >
              {isId
                ? 'Minimal 2 karakter.'
                : 'Enter at least 2 characters.'}
            </p>
          ) : null}

          <ExploreModeTabs
            value={activeMode}
            options={modeOptions}
            onChange={selectMode}
            ariaLabel={
              isId
                ? 'Jenis pencarian'
                : 'Search type'
            }
            className="mt-2"
          />
        </ExploreSurface>

        {referenceMode ? (
          <div className="mt-2 rounded-[14px] border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/20 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-amber-950 dark:text-amber-100 sm:text-xs">
                {isId
                  ? 'Data lokasi publik'
                  : 'Public location data'}
              </p>

              <p className="mt-0.5 text-[10px] font-medium leading-4 text-amber-900/70 dark:text-amber-200/70 sm:text-[11px]">
                {isId
                  ? 'Untuk mencari nama dan lokasi usaha. Stok dan harga belum tentu tersedia.'
                  : 'For business names and locations. Stock and pricing may not be available.'}
              </p>

              <p className="mt-1 text-[9px] font-medium text-amber-800/65 dark:text-amber-300/60">
                {isId
                  ? 'Sumber:'
                  : 'Source:'}{' '}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-bold hover:underline"
                >
                  OpenStreetMap
                  <ExternalLink
                    className="h-2.5 w-2.5"
                    aria-hidden="true"
                  />
                </a>
                {' · '}
                <a
                  href="https://opendatacommons.org/licenses/odbl/1-0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-bold hover:underline"
                >
                  ODbL
                  <ExternalLink
                    className="h-2.5 w-2.5"
                    aria-hidden="true"
                  />
                </a>
              </p>
            </div>

            <Link
              href="/umkm?scope=references"
              className="mt-2 inline-flex min-h-8 shrink-0 items-center rounded-[9px] bg-zinc-950 px-3 text-[10px] font-black text-white transition hover:bg-amber-800 dark:bg-white dark:text-zinc-950 sm:mt-0 sm:text-[11px]"
            >
              {isId
                ? 'Buka peta'
                : 'Open map'}
            </Link>
          </div>
        ) : peopleMode ? (
          <div className="mt-2 rounded-[14px] border border-teal-200/70 bg-teal-50/60 px-3 py-2 text-[10px] font-medium leading-4 text-teal-950 dark:border-teal-900/60 dark:bg-teal-950/25 dark:text-teal-100/80 sm:text-[11px]">
            <span className="font-black">
              {isId
                ? 'Profil publik · '
                : 'Public profiles · '}
            </span>

            {isId
              ? 'Kontak pribadi tetap disembunyikan.'
              : 'Private contact details stay hidden.'}
          </div>
        ) : (
          <ExploreSurface
            className="mt-2 p-2.5 sm:p-3"
            aria-labelledby="explore-result-category-title"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <h2
                id="explore-result-category-title"
                className="min-w-0 text-[12px] font-black text-zinc-900 dark:text-zinc-100 sm:text-sm"
              >
                {isId
                  ? 'Kategori'
                  : 'Category'}

                {activeCategory ? (
                  <span className="ml-1.5 font-semibold text-zinc-400 dark:text-zinc-500">
                    ·{' '}
                    {isId
                      ? activeCategory.shortLabelId
                      : activeCategory.shortLabelEn}
                  </span>
                ) : null}
              </h2>

              <div className="flex shrink-0 items-center gap-1">
                <EmblaDesktopControls
                  api={
                    categoryRailApi
                  }
                  isId={isId}
                  compact
                />

                {activeCategory ? (
                  <Link
                    href={buildExploreCategoryHref(
                      activeCategory,
                    )}
                    className="hidden min-h-7 items-center rounded-[8px] px-2 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40 sm:inline-flex"
                  >
                    {isId
                      ? 'Buka'
                      : 'Open'}
                  </Link>
                ) : null}

                {advancedFilterCount >
                0 ? (
                  <button
                    type="button"
                    onClick={
                      clearAdvancedFilters
                    }
                    className="inline-flex min-h-7 items-center rounded-[8px] px-2 text-[9px] font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40 sm:text-[10px]"
                  >
                    {isId
                      ? `Hapus filter (${advancedFilterCount})`
                      : `Clear (${advancedFilterCount})`}
                  </button>
                ) : null}
              </div>
            </div>

            <div
              ref={
                categoryRailRef
              }
              className="mt-2 w-full min-w-0 cursor-grab overflow-hidden pb-1 active:cursor-grabbing"
              aria-label={
                isId
                  ? 'Kategori pencarian'
                  : 'Search categories'
              }
            >
              <div className="flex touch-pan-y gap-1.5 [backface-visibility:hidden] [will-change:transform]">
                <div className="min-w-0 shrink-0 flex-[0_0_68px] min-[420px]:flex-[0_0_72px] sm:flex-[0_0_78px]">
                  <button
                    type="button"
                    aria-label={
                      isId
                        ? 'Semua kategori'
                        : 'All categories'
                    }
                    aria-current={
                      !activeCategory
                        ? 'page'
                        : undefined
                    }
                    aria-pressed={
                      !activeCategory
                        ? true
                        : undefined
                    }
                    onClick={() =>
                      selectCategory(
                        null,
                      )
                    }
                    className={cn(
                      'flex h-full min-h-[74px] w-full flex-col items-center justify-center rounded-[13px] border p-1.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 sm:min-h-[78px]',
                      !activeCategory
                        ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm dark:border-white dark:bg-white dark:text-zinc-950'
                        : 'border-zinc-200/70 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700',
                    )}
                  >
                    <ExploreArtwork
                      src={
                        ALL_CATEGORY_IMAGE
                      }
                      alt=""
                      visualId="all"
                      size="xs"
                      active={
                        !activeCategory
                      }
                      muted={Boolean(
                        activeCategory,
                      )}
                    />

                    <span
                      className={cn(
                        'mt-1 line-clamp-2 text-[9px] font-black leading-[11px] sm:text-[10px] sm:leading-3',
                        !activeCategory
                          ? 'text-white dark:text-zinc-950'
                          : 'text-zinc-700 dark:text-zinc-200',
                      )}
                    >
                      {isId
                        ? 'Semua'
                        : 'All'}
                    </span>
                  </button>
                </div>

                {MARKETPLACE_EXPLORE_CATEGORIES.map(
                  category => {
                    const selected =
                      activeCategory?.id ===
                      category.id;

                    const label =
                      isId
                        ? category.shortLabelId
                        : category.shortLabelEn;

                    return (
                      <div
                        key={
                          category.id
                        }
                        className="min-w-0 shrink-0 flex-[0_0_68px] min-[420px]:flex-[0_0_72px] sm:flex-[0_0_78px]"
                      >
                        <button
                          type="button"
                          aria-label={label}
                          aria-current={
                            selected
                              ? 'page'
                              : undefined
                          }
                          aria-pressed={
                            selected
                              ? true
                              : undefined
                          }
                          onClick={() =>
                            selectCategory(
                              category,
                            )
                          }
                          className={cn(
                            'group flex h-full min-h-[74px] w-full flex-col items-center justify-center rounded-[13px] border p-1.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 sm:min-h-[78px]',
                            selected
                              ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm dark:border-white dark:bg-white dark:text-zinc-950'
                              : 'border-zinc-200/70 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700',
                          )}
                        >
                          <ExploreArtwork
                            src={
                              category.image
                            }
                            alt=""
                            visualId={
                              category.id
                            }
                            size="xs"
                            active={
                              selected
                            }
                            muted={
                              !selected
                            }
                          />

                          <span
                            className={cn(
                              'mt-1 line-clamp-2 text-[9px] font-black leading-[11px] sm:text-[10px] sm:leading-3',
                              selected
                                ? 'text-white dark:text-zinc-950'
                                : 'text-zinc-700 dark:text-zinc-200',
                            )}
                          >
                            {label}
                          </span>
                        </button>
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            {activeCategory?.subcategories
              .length ? (
              <div className="mt-2 flex min-w-0 items-center gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <span className="shrink-0 text-[10px] font-black text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
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
                      ? 'Subkategori pencarian'
                      : 'Search subcategories'
                  }
                >
                  <div className="flex touch-pan-y gap-1.5">
                    <div className="shrink-0">
                      <button
                        type="button"
                        aria-pressed={
                          !activeSubcategory
                            ? true
                            : undefined
                        }
                        onClick={() =>
                          selectSubcategory(
                            null,
                          )
                        }
                        className={cn(
                          'inline-flex h-8 items-center rounded-full border px-3 text-[9px] font-semibold transition sm:text-[10px]',
                          !activeSubcategory
                            ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                            : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white',
                        )}
                      >
                        {isId
                          ? 'Semua'
                          : 'All'}
                      </button>
                    </div>

                    {activeCategory.subcategories.map(
                      subcategory => {
                        const selected =
                          activeSubcategory?.slug ===
                          subcategory.slug;

                        return (
                          <div
                            key={
                              subcategory.slug
                            }
                            className="shrink-0"
                          >
                            <button
                              type="button"
                              aria-pressed={
                                selected
                                  ? true
                                  : undefined
                              }
                              onClick={() =>
                                selectSubcategory(
                                  subcategory.slug,
                                )
                              }
                              className={cn(
                                'inline-flex h-8 max-w-[190px] items-center rounded-full border px-3 text-[9px] font-semibold transition sm:text-[10px]',
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
                            </button>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>

                {activeCategory
                  .subcategories
                  .length > 4 ? (
                  <div className="hidden shrink-0 sm:block">
                    <EmblaDesktopControls
                      api={
                        subcategoryRailApi
                      }
                      isId={isId}
                      compact
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </ExploreSurface>
        )}

        <section className="mt-2 min-w-0 sm:mt-3">
          <ExploreSearchResults
            payload={payload}
            loading={loading}
            error={error}
            locale={locale}
            searchSide={searchSide}
            activeTab={
              effectiveResultTab
            }
            onSelectTab={
              selectTab
            }
            onNextCursor={
              loadNextReferenceBatch
            }
            onRetry={() =>
              setRetryKey(
                value => value + 1,
              )
            }
          />
        </section>
      </main>
    </div>
  );
}
