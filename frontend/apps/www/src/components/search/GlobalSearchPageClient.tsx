'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ClipboardList,
  Filter,
  ListFilter,
  MapPin,
  Search,
  SlidersHorizontal,
  Store,
  type LucideIcon,
  X,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Header } from '@/components/layout/Header';
import { CompactSeeAllButton } from '@/components/common/CompactSectionAction';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import {
  SearchFilters,
  type SearchFilterValues,
} from '@/components/search/SearchFilters';
import { SearchCategoryRail } from '@/components/search/SearchCategoryRail';
import { BusinessSearchCard } from '@/components/search/result-cards/BusinessSearchCard';
import { CommunitySearchCard } from '@/components/search/result-cards/CommunitySearchCard';
import { NeedSearchCard } from '@/components/search/result-cards/NeedSearchCard';
import { ProductSearchCard } from '@/components/search/result-cards/ProductSearchCard';
import { ServiceSearchCard } from '@/components/search/result-cards/ServiceSearchCard';
import { UserSearchCard } from '@/components/search/result-cards/UserSearchCard';
import { VideoSearchCard } from '@/components/search/result-cards/VideoSearchCard';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import {
  getExploreCategoryBySlug,
  type LajukanLocale,
} from '@/lib/discovery/lajukanCategories';
import {
  GLOBAL_SEARCH_TABS,
  emptyGlobalSearchResponse,
  parseGlobalSearchState,
  type GlobalSearchGroup,
  type GlobalSearchGroupKey,
  type GlobalSearchItem,
  type GlobalSearchResponse,
  type GlobalSearchSide,
  type GlobalSearchTab,
} from '@/lib/search/globalSearch';
import { cn } from '@/lib/utils';

const TAB_CONFIG: Record<
  GlobalSearchTab,
  {
    labelId: string;
    labelEn: string;
    descriptionId: string;
    descriptionEn: string;
  }
> = {
  all: {
    labelId: 'Semua',
    labelEn: 'All',
    descriptionId:
      'Gabungan dari marketplace, usaha, komunitas, video, dan profil.',
    descriptionEn:
      'Combined marketplace, business, community, video, and profile results.',
  },
  products: {
    labelId: 'Produk',
    labelEn: 'Products',
    descriptionId: 'Bahan, stok, alat, atau barang yang bisa dibandingkan.',
    descriptionEn: 'Materials, stock, tools, or goods you can compare.',
  },
  services: {
    labelId: 'Jasa',
    labelEn: 'Services',
    descriptionId:
      'Penyedia jasa operasional, kreatif, teknis, dan pendukung usaha.',
    descriptionEn:
      'Operational, creative, technical, and business support services.',
  },
  businesses: {
    labelId: 'Usaha',
    labelEn: 'Businesses',
    descriptionId: 'Toko, UMKM, dan profil usaha yang relevan.',
    descriptionEn: 'Relevant stores, MSMEs, and business profiles.',
  },
  references: {
    labelId: 'Referensi data publik',
    labelEn: 'Public data references',
    descriptionId:
      'Lokasi non-transaksi dengan sumber dan lisensi yang bisa diperiksa.',
    descriptionEn:
      'Non-transactional locations with a source and license you can inspect.',
  },
  needs: {
    labelId: 'Kebutuhan',
    labelEn: 'Needs',
    descriptionId: 'Permintaan aktif dari orang yang sedang mencari penyedia.',
    descriptionEn: 'Active requests from people looking for providers.',
  },
  communities: {
    labelId: 'Komunitas',
    labelEn: 'Communities',
    descriptionId: 'Ruang diskusi untuk belajar, tanya jawab, dan jejaring.',
    descriptionEn: 'Discussion spaces for learning, questions, and networking.',
  },
  videos: {
    labelId: 'Video',
    labelEn: 'Videos',
    descriptionId:
      'Konten singkat untuk inspirasi, edukasi, dan bukti aktivitas.',
    descriptionEn:
      'Short content for inspiration, education, and activity proof.',
  },
  users: {
    labelId: 'Orang',
    labelEn: 'Users',
    descriptionId:
      'Profil orang atau pelaku usaha yang bisa dicek lebih lanjut.',
    descriptionEn: 'People or business owner profiles you can inspect further.',
  },
};

const SUPPLY_GROUP_ORDER: GlobalSearchGroupKey[] = [
  'products',
  'businesses',
  'services',
];

const SUPPLY_RESULT_TABS: GlobalSearchTab[] = [
  'all',
  'products',
  'services',
  'businesses',
];

const SEARCH_EXAMPLES: Record<
  LajukanLocale,
  Record<Exclude<GlobalSearchSide, 'all'>, string[]>
> = {
  id: {
    supply: [
      'supplier kaos Bandung',
      'jasa foto produk',
      'sewa ruko',
      'kemasan kopi custom',
      'mesin produksi',
      'franchise minuman',
    ],
    demand: [
      'butuh supplier makanan',
      'cari jasa website',
      'butuh mesin produksi',
      'cari kemasan custom',
      'butuh tempat usaha',
      'cari mitra reseller',
    ],
  },
  en: {
    supply: [
      't-shirt supplier Bandung',
      'product photography service',
      'shophouse rental',
      'custom coffee packaging',
      'production machine',
      'beverage franchise',
    ],
    demand: [
      'needs food supplier',
      'looking for web service',
      'needs production machine',
      'looking for custom packaging',
      'needs business place',
      'looking for resellers',
    ],
  },
};

function readRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(
      window.localStorage.getItem('lajukan:recent-searches:v2') || '[]',
    );
    return Array.isArray(value)
      ? value.filter(item => typeof item === 'string').slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

function SearchLoading() {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading search results"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-40 animate-pulse rounded-[8px] bg-[color:var(--app-border)]"
        />
      ))}
    </div>
  );
}

function SearchResultTabs({
  tabs,
  activeTab,
  payload,
  loading,
  locale,
  onSelectTab,
}: {
  tabs: GlobalSearchTab[];
  activeTab: GlobalSearchTab;
  payload: GlobalSearchResponse;
  loading: boolean;
  locale: LajukanLocale;
  onSelectTab: (tab: GlobalSearchTab) => void;
}) {
  const isId = locale === 'id';

  return (
    <div
      role="tablist"
      aria-label={isId ? 'Jenis hasil pencarian' : 'Search result type'}
      className="flex min-w-0 flex-wrap gap-1"
    >
      {tabs.map(tab => {
        const active = activeTab === tab;
        const config = TAB_CONFIG[tab];
        const count = tab === 'all' ? payload.total : payload.groups[tab].total;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelectTab(tab)}
            className={cn(
              'inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-md border px-2 text-xs font-bold transition',
              active
                ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                : 'border-transparent bg-transparent text-[color:var(--app-text-soft)] hover:border-[color:var(--app-border)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
            )}
          >
            <span className="truncate">
              {isId ? config.labelId : config.labelEn}
            </span>
            <span
              className={cn(
                'rounded-full px-1 py-0.5 text-[10px] flex justify-center items-center',
                active
                  ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]'
                  : 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)]',
              )}
            >
              {loading ? '...' : count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SearchIntentSwitch({
  activeSide,
  locale,
  onSelectSide,
}: {
  activeSide: Exclude<GlobalSearchSide, 'all'>;
  locale: LajukanLocale;
  onSelectSide: (side: Exclude<GlobalSearchSide, 'all'>) => void;
}) {
  const isId = locale === 'id';
  const options: Array<{
    value: Exclude<GlobalSearchSide, 'all'>;
    labelId: string;
    labelEn: string;
    shortLabelId: string;
    shortLabelEn: string;
    descriptionId: string;
    descriptionEn: string;
    icon: LucideIcon;
  }> = [
      {
        value: 'supply',
        labelId: 'Cari yang menawarkan',
        labelEn: 'Find Providers',
        shortLabelId: 'Penyedia',
        shortLabelEn: 'Providers',
        descriptionId: 'Produk, jasa, alat',
        descriptionEn: 'Products, services, tools',
        icon: Store,
      },
      {
        value: 'demand',
        labelId: 'Lihat kebutuhan pembeli',
        labelEn: 'Find Buyers',
        shortLabelId: 'Pembeli',
        shortLabelEn: 'Buyers',
        descriptionId: 'Brief aktif',
        descriptionEn: 'Active needs',
        icon: ClipboardList,
      },
    ];

  return (
    <div
      className="grid w-full grid-cols-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1"
      aria-label={isId ? 'Pilih arah pencarian' : 'Choose search side'}
      role="tablist"
    >
      {options.map(option => {
        const active = activeSide === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelectSide(option.value)}
            role="tab"
            aria-selected={active}
            className={cn(
              'flex min-h-11 min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition sm:px-3',
              active
                ? 'bg-[color:var(--app-accent)] text-white shadow-sm'
                : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-text)]',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block text-xs font-bold sm:hidden">
                {isId ? option.shortLabelId : option.shortLabelEn}
              </span>
              <span className="hidden text-sm font-bold sm:block">
                {isId ? option.labelId : option.labelEn}
              </span>
              <span
                className={cn(
                  'mt-0.5 hidden truncate text-[10px] sm:block',
                  active
                    ? 'text-white/80'
                    : 'text-[color:var(--app-text-soft)]',
                )}
              >
                {isId ? option.descriptionId : option.descriptionEn}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function renderResultCard(item: GlobalSearchItem, locale: LajukanLocale) {
  if (item.kind === 'products')
    return <ProductSearchCard item={item} locale={locale} />;
  if (item.kind === 'services')
    return <ServiceSearchCard item={item} locale={locale} />;
  if (item.kind === 'businesses')
    return <BusinessSearchCard item={item} locale={locale} />;
  if (item.kind === 'needs')
    return <NeedSearchCard item={item} locale={locale} />;
  if (item.kind === 'communities')
    return <CommunitySearchCard item={item} locale={locale} />;
  if (item.kind === 'videos') return <VideoSearchCard item={item} />;
  return <UserSearchCard item={item} locale={locale} />;
}

function SearchResultGroup({
  groupKey,
  group,
  locale,
  compact,
  query,
  onSelectTab,
}: {
  groupKey: GlobalSearchGroupKey;
  group: GlobalSearchGroup;
  locale: LajukanLocale;
  compact: boolean;
  query: string;
  onSelectTab: (tab: GlobalSearchTab) => void;
}) {
  const isId = locale === 'id';
  if (!group.available || (group.items.length === 0 && !group.error))
    return null;
  const config = TAB_CONFIG[groupKey];
  const items = compact
    ? group.items.slice(0, groupKey === 'videos' ? 4 : 3)
    : group.items;

  return (
    <section
      className="border-t border-[color:var(--app-border)] py-6"
      aria-labelledby={`search-group-${groupKey}`}
    >
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            id={`search-group-${groupKey}`}
            className="text-lg font-bold text-[color:var(--app-text)]"
          >
            {isId ? config.labelId : config.labelEn}
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs leading-5 text-[color:var(--app-text-soft)]">
            {compact
              ? `${group.total} ${isId ? 'hasil' : 'results'}`
              : `${isId ? config.descriptionId : config.descriptionEn} ${group.total} ${isId ? 'hasil' : 'results'
              }.`}
          </p>
        </div>
        {compact && group.items.length > 0 ? (
          <CompactSeeAllButton
            isId={isId}
            onClick={() => onSelectTab(groupKey)}
            aria-label={
              isId
                ? `Lihat semua ${config.labelId}`
                : `View all ${config.labelEn}`
            }
          />
        ) : null}
      </div>

      {group.error ? (
        <div className="mt-3 rounded-[8px] border border-dashed border-[color:var(--app-border-strong)] p-4 text-xs text-[color:var(--app-text-soft)]">
          {isId
            ? `Hasil ${config.labelId.toLowerCase()} belum dapat dimuat. Bagian lain tetap tersedia.`
            : `${config.labelEn} results are temporarily unavailable. Other sections remain available.`}
        </div>
      ) : (
        <div
          className={cn(
            'mt-4 grid gap-3',
            groupKey === 'videos'
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
              : 'sm:grid-cols-2 xl:grid-cols-3',
          )}
        >
          {items.map((item, position) => (
            <div
              key={`${item.kind}-${item.id}`}
              onClickCapture={event => {
                if (!(event.target as HTMLElement).closest('a')) return;
                void trackLajukanEvent('search_result_click', {
                  entityType: item.kind,
                  entityId: item.id,
                  properties: {
                    locale,
                    source: compact ? 'explore_all' : 'explore_tab',
                    route: '/explore',
                    contentType: item.kind,
                    query,
                    position,
                  },
                });
              }}
            >
              {renderResultCard(item, locale)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function GlobalSearchPageClient({ locale }: { locale: LajukanLocale }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(
    () => parseGlobalSearchState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const activeCategory = useMemo(
    () => getExploreCategoryBySlug(state.category),
    [state.category],
  );
  const activeSubcategory = useMemo(
    () =>
      activeCategory?.subcategories.find(
        subcategory => subcategory.slug === state.subcategory,
      ),
    [activeCategory, state.subcategory],
  );
  const hasResultContext = state.query.length >= 2 || Boolean(activeCategory);
  const effectiveSearchSide: Exclude<GlobalSearchSide, 'all'> =
    state.side === 'demand' ? 'demand' : 'supply';
  const apiQueryString = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('tab');
    params.delete('type');
    if (hasResultContext && state.side === 'all') {
      params.set('side', effectiveSearchSide);
    }
    return params.toString();
  }, [effectiveSearchSide, hasResultContext, searchParams, state.side]);
  const isId = locale === 'id';
  const [queryDraft, setQueryDraft] = useState({
    source: state.query,
    value: state.query,
  });
  const queryInput =
    queryDraft.source === state.query ? queryDraft.value : state.query;
  const setQueryInput = (value: string) => {
    setQueryDraft({ source: state.query, value });
  };
  const [payload, setPayload] = useState<GlobalSearchResponse>(() =>
    emptyGlobalSearchResponse(state.query),
  );
  const [loading, setLoading] = useState(false);
  const [criticalError, setCriticalError] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [recent] = useState<string[]>(readRecentSearches);
  const [trending, setTrending] = useState<string[]>([]);

  useEffect(() => {
    const legacyType = searchParams.get('type');
    if (!legacyType || searchParams.has('tab')) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('type');
    if (state.tab !== 'all') params.set('tab', state.tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, state.tab]);

  useEffect(() => {
    if (!hasResultContext || state.side !== 'all') return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('type');
    if (state.tab !== 'all') params.set('tab', state.tab);
    params.set('side', 'supply');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, hasResultContext, state.side, state.tab]);

  useEffect(() => {
    if (hasResultContext) return;
    const controller = new AbortController();
    void fetch('/api/search/trending', {
      cache: 'force-cache',
      signal: controller.signal,
    })
      .then(response => response.json())
      .then(data => {
        const items = Array.isArray(data?.items) ? data.items : [];
        setTrending(
          items
            .map((item: { label?: unknown }) => String(item.label || '').trim())
            .filter(Boolean)
            .slice(0, 8),
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [hasResultContext]);

  useEffect(() => {
    if (!hasResultContext) {
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setCriticalError(false);
    });
    void fetch(`/api/search?${apiQueryString}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error('search_failed');
        return (await response.json()) as GlobalSearchResponse;
      })
      .then(setPayload)
      .catch(() => {
        if (!controller.signal.aborted) {
          setPayload(emptyGlobalSearchResponse(state.query));
          setCriticalError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [apiQueryString, hasResultContext, retryKey, state.query]);

  const updateParams = useCallback(
    (
      changes: Record<string, string | null>,
      mode: 'push' | 'replace' = 'push',
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(changes).forEach(([key, value]) => {
        if (
          !value ||
          value === 'all' ||
          value === 'relevance' ||
          value === '0'
        ) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      params.delete('cursor');
      const href = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      router[mode](href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const submitQuery = (query: string) => {
    const clean = query.replace(/\s+/g, ' ').trim();
    if (clean.length < 2) return;
    try {
      const nextRecent = [
        clean,
        ...readRecentSearches().filter(
          item => item.toLowerCase() !== clean.toLowerCase(),
        ),
      ].slice(0, 8);
      window.localStorage.setItem(
        'lajukan:recent-searches:v2',
        JSON.stringify(nextRecent),
      );
    } catch {
      // Search still works when local storage is unavailable.
    }
    void trackLajukanEvent('navbar_search_submit', {
      properties: {
        locale,
        source: 'explore_results',
        route: '/explore',
        query: clean,
      },
    });
    updateParams({
      q: clean,
      cursor: null,
      side: effectiveSearchSide,
      tab: effectiveSearchSide === 'demand' ? 'needs' : null,
    });
  };

  const selectTab = (tab: GlobalSearchTab) => {
    updateParams({ tab: tab === 'all' ? null : tab });
    void trackLajukanEvent('search_tab_change', {
      properties: {
        locale,
        source: 'explore_results',
        route: '/explore',
        contentType: tab,
        query: state.query,
      },
    });
  };

  const selectSide = (side: Exclude<GlobalSearchSide, 'all'>) => {
    updateParams({
      side,
      tab:
        side === 'demand'
          ? 'needs'
          : state.tab === 'needs'
            ? null
            : state.tab === 'all'
              ? null
              : state.tab,
    });
    void trackLajukanEvent('search_side_change', {
      properties: {
        locale,
        source: 'explore_results',
        route: '/explore',
        side,
        query: state.query,
      },
    });
  };

  const filterValues: SearchFilterValues = {
    location: searchParams.get('location') || '',
    lat: searchParams.get('lat') || '',
    lng: searchParams.get('lng') || '',
    distance: searchParams.get('distance') || '',
    sort: searchParams.get('sort') || 'relevance',
    minPrice: searchParams.get('min_price') || '',
    maxPrice: searchParams.get('max_price') || '',
    condition: searchParams.get('condition') || 'all',
    serviceMode: searchParams.get('service_mode') || 'all',
    verified: searchParams.get('verified') || '0',
    status: searchParams.get('status') || 'all',
    privacy: searchParams.get('privacy') || 'all',
  };
  const activeFilterCount = [
    filterValues.location,
    filterValues.distance,
    filterValues.sort !== 'relevance' ? filterValues.sort : '',
    filterValues.minPrice,
    filterValues.maxPrice,
    filterValues.condition !== 'all' ? filterValues.condition : '',
    filterValues.serviceMode !== 'all' ? filterValues.serviceMode : '',
    filterValues.verified === '1' ? filterValues.verified : '',
    filterValues.status !== 'all' ? filterValues.status : '',
  ].filter(Boolean).length;

  const applyFilters = (values: SearchFilterValues) => {
    updateParams({
      location: values.location || null,
      lat: values.lat || null,
      lng: values.lng || null,
      distance: values.distance || null,
      sort: values.sort,
      min_price: values.minPrice || null,
      max_price: values.maxPrice || null,
      condition: values.condition,
      service_mode: values.serviceMode,
      verified: values.verified,
      status: values.status,
      privacy: values.privacy,
    });
    void trackLajukanEvent('search_filter_apply', {
      properties: {
        locale,
        source: 'explore_results',
        route: '/explore',
        contentType: state.tab,
        query: state.query,
      },
    });
  };

  const selectCategory = (
    category: ReturnType<typeof getExploreCategoryBySlug>,
  ) => {
    updateParams({
      category: category?.slug || null,
      subcategory: null,
    });
    void trackLajukanEvent('search_category_change', {
      properties: {
        locale,
        source: 'explore_results',
        route: '/explore',
        category: category?.slug || 'all',
        query: state.query,
      },
    });
  };

  const selectSubcategory = (subcategory: string | null) => {
    updateParams({ subcategory });
    void trackLajukanEvent('search_subcategory_change', {
      properties: {
        locale,
        source: 'explore_results',
        route: '/explore',
        category: activeCategory?.slug || 'all',
        subcategory: subcategory || 'all',
        query: state.query,
      },
    });
  };

  const allowedTabs =
    effectiveSearchSide === 'demand'
      ? (['needs'] satisfies GlobalSearchTab[])
      : SUPPLY_RESULT_TABS;
  const effectiveTab: GlobalSearchTab = allowedTabs.includes(state.tab)
    ? state.tab
    : effectiveSearchSide === 'demand'
      ? 'needs'
      : 'all';
  const visibleGroupOrder =
    effectiveSearchSide === 'demand'
      ? (['needs'] satisfies GlobalSearchGroupKey[])
      : SUPPLY_GROUP_ORDER;
  const tabs = useMemo(() => {
    const available = new Set<GlobalSearchTab>(
      payload.availableTabs || ['all'],
    );
    allowedTabs.forEach(tab => available.add(tab));
    return GLOBAL_SEARCH_TABS.filter(
      tab => available.has(tab) && allowedTabs.includes(tab),
    );
  }, [allowedTabs, payload.availableTabs]);
  const activeGroup =
    effectiveTab === 'all' ? null : payload.groups[effectiveTab];
  const displayedTotal = activeGroup?.total ?? payload.total;
  const hasUnavailableGroups = (
    effectiveTab === 'all' ? visibleGroupOrder : [effectiveTab]
  ).some(groupKey => Boolean(payload.groups[groupKey].error));
  const activeCategoryControlLabel = activeSubcategory
    ? isId
      ? activeSubcategory.labelId
      : activeSubcategory.labelEn
    : activeCategory
      ? isId
        ? activeCategory.shortLabelId
        : activeCategory.shortLabelEn
      : isId
        ? 'Kategori'
        : 'Category';
  const resultContextLabel = activeSubcategory
    ? isId
      ? activeSubcategory.labelId
      : activeSubcategory.labelEn
    : activeCategory
      ? isId
        ? activeCategory.labelId
        : activeCategory.labelEn
      : state.query;
  const searchSummaryBadges = [
    activeCategory
      ? {
        icon: ListFilter,
        label: resultContextLabel,
      }
      : null,
    state.location
      ? {
        icon: MapPin,
        label: state.location,
      }
      : null,
    filterValues.verified === '1'
      ? {
        icon: BadgeCheck,
        label: isId ? 'Terverifikasi' : 'Verified',
      }
      : null,
    state.sort !== 'relevance'
      ? {
        icon: SlidersHorizontal,
        label:
          state.sort === 'nearest'
            ? isId
              ? 'Terdekat'
              : 'Nearest'
            : isId
              ? 'Terbaru'
              : 'Latest',
      }
      : null,
    effectiveTab === 'needs' && filterValues.status === 'open'
      ? {
        icon: ClipboardList,
        label: isId ? 'Masih dibuka' : 'Open',
      }
      : null,
  ].filter(Boolean) as Array<{ icon: LucideIcon; label: string }>;
  const resultTitle =
    state.query.length >= 2
      ? effectiveSearchSide === 'demand'
        ? isId
          ? `Pembeli mencari "${state.query}"`
          : `Buyers looking for "${state.query}"`
        : isId
          ? `Penyedia untuk "${state.query}"`
          : `Providers for "${state.query}"`
      : effectiveSearchSide === 'demand'
        ? isId
          ? `Kebutuhan pembeli: ${resultContextLabel}`
          : `Buyer needs: ${resultContextLabel}`
        : isId
          ? `Penyedia dan penawaran: ${resultContextLabel}`
          : `Providers and offers: ${resultContextLabel}`;
  const searchPlaceholder =
    effectiveSearchSide === 'demand'
      ? isId
        ? 'Cari kebutuhan pembeli'
        : 'Search buyer needs'
      : isId
        ? 'Cari supplier, jasa, alat, tempat'
        : 'Search suppliers, services, tools, places';
  const emptyActionParams = new URLSearchParams({
    side: effectiveSearchSide === 'demand' ? 'supply' : 'demand',
  });
  if (state.query) emptyActionParams.set('q', state.query);
  if (state.category) emptyActionParams.set('category', state.category);
  const emptyActionHref = `/create?${emptyActionParams.toString()}`;
  const emptyActionLabel =
    effectiveSearchSide === 'demand'
      ? isId
        ? 'Pasang penawaran'
        : 'Post an offer'
      : isId
        ? 'Buat kebutuhan'
        : 'Post a need';
  const searchForm = (
    <form
      action={pathname}
      method="get"
      onSubmit={event => {
        event.preventDefault();
        const submitted = new FormData(event.currentTarget).get('q');
        submitQuery(typeof submitted === 'string' ? submitted : queryInput);
      }}
      className="min-w-0"
      role="search"
    >
      <label className="flex min-h-[50px] items-center gap-2 rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] px-3 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.5)] focus-within:border-[color:var(--app-accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--app-accent)_12%,transparent)]">
        <Search className="h-5 w-5 shrink-0 text-[color:var(--app-text-soft)]" />
        <input
          type="search"
          name="q"
          value={queryInput}
          onChange={event => setQueryInput(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
          autoFocus={false}
        />
        {queryInput ? (
          <button
            type="button"
            onClick={() => setQueryInput('')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]"
            aria-label={isId ? 'Hapus pencarian' : 'Clear search'}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="submit"
          aria-disabled={queryInput.trim().length < 2}
          className={cn(
            'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[color:var(--app-accent)] px-3 text-xs font-bold text-white transition hover:bg-[color:var(--app-accent-strong)]',
            queryInput.trim().length < 2 && 'cursor-not-allowed opacity-40',
          )}
        >
          <span className="hidden sm:inline">{isId ? 'Cari' : 'Search'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </label>
      {effectiveSearchSide === 'demand' ? (
        <>
          <input type="hidden" name="side" value="demand" />
          <input type="hidden" name="tab" value="needs" />
        </>
      ) : null}
    </form>
  );

  return (
    <div className="min-h-[100svh] bg-[color:var(--app-surface-muted)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10">
      <div className="lg:hidden">
        <Header />
        <div className="h-[calc(52px+env(safe-area-inset-top))]" />
      </div>

      <main className="mx-auto w-full max-w-[2200px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <section
          className={cn(
            hasResultContext
              ? 'sticky top-[calc(52px+env(safe-area-inset-top))] z-20 -mx-4 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-muted)_96%,transparent)] px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none'
              : 'w-full py-4 sm:py-6',
          )}
        >
          {!hasResultContext ? (
            <div className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.5)] sm:p-5">
              <p className="text-xs font-bold text-[color:var(--app-accent)]">
                {isId ? 'Jelajahi Lajukan' : 'Explore Lajukan'}
              </p>
              <h1 className="mt-2 text-2xl font-bold leading-tight text-[color:var(--app-text)] sm:text-3xl">
                {effectiveSearchSide === 'demand'
                  ? isId
                    ? 'Cari pembeli yang sedang butuh solusi'
                    : 'Find buyers with active needs'
                  : isId
                    ? 'Mau cari apa untuk usahamu?'
                    : 'What does your business need?'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                {effectiveSearchSide === 'demand'
                  ? isId
                    ? 'Ketik produk, jasa, alat, atau tempat yang kamu sediakan.'
                    : 'Type the product, service, tool, or place you provide.'
                  : isId
                    ? 'Ketik supplier, jasa, alat, tempat, atau peluang yang kamu butuhkan.'
                    : 'Type the supplier, service, tool, place, or opportunity you need.'}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[340px_minmax(0,1fr)]">
                <SearchIntentSwitch
                  activeSide={effectiveSearchSide}
                  locale={locale}
                  onSelectSide={selectSide}
                />
                {searchForm}
              </div>
            </div>
          ) : (
            <div className="grid gap-2.5 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-center">
              <SearchIntentSwitch
                activeSide={effectiveSearchSide}
                locale={locale}
                onSelectSide={selectSide}
              />
              {searchForm}
            </div>
          )}
        </section>

        {hasResultContext ? (
          <section className="mt-4 overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_16px_38px_-34px_rgba(15,23,42,0.45)]">
            <div className="grid gap-3 p-3 sm:flex sm:flex-wrap sm:items-center sm:p-4">
              <div className="min-w-0 sm:flex-1">
                {effectiveSearchSide === 'supply' ? (
                  <SearchResultTabs
                    tabs={tabs}
                    activeTab={effectiveTab}
                    payload={payload}
                    loading={loading}
                    locale={locale}
                    onSelectTab={selectTab}
                  />
                ) : (
                  <span className="inline-flex min-h-9 items-center gap-2 rounded-md bg-[#eff6ff] px-3 text-xs font-bold text-[#1d4ed8]">
                    <ClipboardList className="h-4 w-4 shrink-0" />
                    {isId ? 'Kebutuhan pembeli' : 'Buyer needs'}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryOpen(value => !value)}
                  aria-expanded={categoryOpen}
                  className={cn(
                    'inline-flex h-9 min-w-0 max-w-[58vw] items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition sm:max-w-[220px]',
                    activeCategory
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : 'border-[color:var(--app-border)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
                  )}
                >
                  <ListFilter className="h-4 w-4 shrink-0" />
                  <span className="truncate">{activeCategoryControlLabel}</span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 transition',
                      categoryOpen && 'rotate-180',
                    )}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOpen(true)}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition',
                    activeFilterCount > 0
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : 'border-[color:var(--app-border)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
                  )}
                >
                  <Filter className="h-4 w-4" />
                  {isId ? 'Filter' : 'Filters'}
                  {activeFilterCount > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-1 text-[10px] text-white">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>
            {categoryOpen ? (
              <div className="border-t border-[color:var(--app-border)] p-3 sm:p-4">
                <SearchCategoryRail
                  locale={locale}
                  activeCategory={activeCategory}
                  activeSubcategory={state.subcategory}
                  onSelectCategory={selectCategory}
                  onSelectSubcategory={selectSubcategory}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {hasResultContext ? (
          <SearchFilters
            key={searchParams.toString()}
            locale={locale}
            tab={effectiveTab}
            values={filterValues}
            mobileOpen={filterOpen}
            onMobileClose={() => setFilterOpen(false)}
            onApply={applyFilters}
          />
        ) : null}

        {!hasResultContext ? (
          <section className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-[color:var(--app-text)] sm:text-base">
                {isId ? 'Mulai dari contoh ini' : 'Start with these examples'}
              </h2>
              <Link
                href="/explore"
                className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--app-accent)]"
              >
                {isId ? 'Lihat kategori' : 'View categories'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-3">
              <div className="mt-2 flex flex-wrap gap-2">
                {(recent.length > 0
                  ? recent
                  : effectiveSearchSide === 'supply' && trending.length > 0
                    ? trending
                    : SEARCH_EXAMPLES[locale][effectiveSearchSide]
                )
                  .slice(0, 8)
                  .map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setQueryInput(item);
                        submitQuery(item);
                      }}
                      className="min-h-9 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-xs font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)]"
                    >
                      {item}
                    </button>
                  ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="py-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-[color:var(--app-text)]">
                  {resultTitle}
                </h1>
                <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                  {loading
                    ? isId
                      ? 'Mencari di seluruh Lajukan...'
                      : 'Searching across Lajukan...'
                    : `${displayedTotal} ${isId ? 'hasil' : 'results'}`}
                </p>
                {searchSummaryBadges.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {searchSummaryBadges.map(({ icon: Icon, label }) => (
                      <span
                        key={label}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[11px] font-semibold text-[color:var(--app-text)]"
                      >
                        <Icon className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {loading ? (
              <div className="mt-5">
                <SearchLoading />
              </div>
            ) : null}
            {criticalError && !loading ? (
              <div className="mt-5 rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5">
                <p className="text-sm font-bold text-[color:var(--app-text)]">
                  {isId
                    ? 'Pencarian belum dapat dimuat.'
                    : 'Search could not be loaded.'}
                </p>
                <button
                  type="button"
                  onClick={() => setRetryKey(value => value + 1)}
                  className="mt-3 min-h-10 rounded-[8px] bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white"
                >
                  {isId ? 'Coba lagi' : 'Retry'}
                </button>
              </div>
            ) : null}

            {!loading && !criticalError && effectiveTab === 'all'
              ? visibleGroupOrder.map(groupKey => (
                <SearchResultGroup
                  key={groupKey}
                  groupKey={groupKey}
                  group={payload.groups[groupKey]}
                  locale={locale}
                  compact
                  query={state.query}
                  onSelectTab={selectTab}
                />
              ))
              : null}
            {!loading &&
              !criticalError &&
              effectiveTab !== 'all' &&
              activeGroup ? (
              <SearchResultGroup
                groupKey={effectiveTab}
                group={activeGroup}
                locale={locale}
                compact={false}
                query={state.query}
                onSelectTab={selectTab}
              />
            ) : null}

            {!loading &&
              !criticalError &&
              !hasUnavailableGroups &&
              displayedTotal === 0 ? (
              <div className="mt-6 rounded-[8px] border border-dashed border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-6 text-center">
                <p className="text-sm font-bold text-[color:var(--app-text)]">
                  {state.query
                    ? effectiveSearchSide === 'demand'
                      ? isId
                        ? `Belum ada kebutuhan pembeli untuk "${state.query}".`
                        : `No buyer needs for "${state.query}" yet.`
                      : isId
                        ? `Belum ada hasil untuk "${state.query}".`
                        : `No results for "${state.query}" yet.`
                    : effectiveSearchSide === 'demand'
                      ? isId
                        ? `Belum ada kebutuhan pembeli di ${resultContextLabel}.`
                        : `No buyer needs in ${resultContextLabel} yet.`
                      : isId
                        ? `Belum ada hasil di ${resultContextLabel}.`
                        : `No results in ${resultContextLabel} yet.`}
                </p>
                <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-[color:var(--app-text-soft)]">
                  {effectiveSearchSide === 'demand'
                    ? isId
                      ? 'Coba kata yang lebih umum, ubah lokasi, atau pasang penawaran agar pembeli yang cocok bisa menemukanmu.'
                      : 'Try a broader term, adjust location, or post an offer so matching buyers can find you.'
                    : isId
                      ? 'Coba kata yang lebih umum, ubah lokasi, atau buat kebutuhan agar penyedia dapat menghubungimu.'
                      : 'Try a broader term, adjust location, or post a need so providers can contact you.'}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateParams({
                        location: null,
                        category: null,
                        subcategory: null,
                      })
                    }
                    className="min-h-10 rounded-[8px] border border-[color:var(--app-border)] px-4 text-xs font-bold"
                  >
                    {isId ? 'Perluas pencarian' : 'Broaden search'}
                  </button>
                  <Link
                    href={emptyActionHref}
                    className="inline-flex min-h-10 items-center rounded-[8px] bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white"
                  >
                    {emptyActionLabel}
                  </Link>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}