'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CircleAlert,
  Layers3,
  Plus,
  Search,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ExploreBusinessCard } from '@/components/explore/cards/ExploreBusinessCard';
import { ExploreCommunityCard } from '@/components/explore/cards/ExploreCommunityCard';
import { ExploreListingCard } from '@/components/explore/cards/ExploreListingCard';
import { ExploreVideoCard } from '@/components/explore/cards/ExploreVideoCard';
import { ExploreSearchResults } from '@/components/explore/ExploreSearchResults';
import { Header } from '@/components/layout/Header';
import { CompactSeeAllLink } from '@/components/common/CompactSectionAction';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import {
  LAJUKAN_EXPLORE_CATEGORIES,
  MARKETPLACE_EXPLORE_CATEGORIES,
  buildCategorySearchHref,
  buildExploreCategoryHref,
  categoryLabel,
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
import { cn } from '@/lib/utils';

function appendSearchParams(path: string, params: URLSearchParams) {
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

function SectionSkeleton() {
  return (
    <section
      className="border-t border-[color:var(--app-border)] py-6"
      aria-hidden="true"
    >
      <div className="h-5 w-48 animate-pulse rounded bg-[color:var(--app-border)]" />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-48 animate-pulse rounded-lg bg-[color:var(--app-border)]"
          />
        ))}
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
        ? `/create?side=supply&category=${encodeURIComponent(category.slug)}`
        : buildCategorySearchHref({
            category,
            side: 'supply',
          });
  return (
    <div className="flex flex-col items-start gap-4 rounded-[8px] border border-dashed border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold text-[color:var(--app-text)]">
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
        <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
          {isId
            ? isVideo
              ? 'Buka Video untuk melihat unggahan terbaru.'
              : isCommunity
                ? 'Buka Komunitas untuk melihat diskusi terbaru.'
                : mode === 'demand'
                  ? 'Pasang penawaran agar pembeli yang cocok bisa menemukanmu.'
                  : 'Coba kategori atau kata kunci penawaran lain.'
            : isVideo
              ? 'Open Videos to see the latest uploads.'
              : isCommunity
                ? 'Open Community to see the latest discussions.'
                : mode === 'demand'
                  ? 'Post an offer so matching buyers can find you.'
                  : 'Try another offer keyword or category.'}
        </p>
      </div>
      <Link
        href={actionHref}
        className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-[8px] bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white transition hover:bg-[color:var(--app-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2"
      >
        {isCommunity || isVideo || mode === 'supply' ? (
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
                : 'Cari penawaran'
          : isVideo
            ? 'Open Videos'
            : isCommunity
              ? 'Open Community'
              : mode === 'demand'
                ? 'Post an offer'
                : 'Find offers'}
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
  kind: 'listing' | 'business' | 'community' | 'video';
}) {
  const isId = locale === 'id';
  if (items.length === 0) return null;
  const isNeedSection = config.key === 'latest-needs';
  const previewItems = items.slice(
    0,
    kind === 'video'
      ? 8
      : isNeedSection || kind === 'business' || kind === 'community'
        ? 6
        : 8,
  );
  const seeAllHref = (() => {
    if (kind === 'community') return '/community';
    if (kind === 'video') return '/reels';
    const params = new URLSearchParams();
    params.set('category', category.slug);
    if (config.key === 'latest-needs') {
      params.set('side', 'demand');
      params.set('tab', 'needs');
      params.set('sort', 'latest');
    } else {
      params.set('side', 'supply');
    }
    return `/explore?${params.toString()}`;
  })();

  return (
    <section className="border-t border-[color:var(--app-border)] py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[color:var(--app-text)]">
            {isId ? config.titleId : config.titleEn}
          </h2>
          <p className="mt-0.5 line-clamp-1 text-xs text-[color:var(--app-text-soft)]">
            {isId ? config.descriptionId : config.descriptionEn}
          </p>
        </div>
        <CompactSeeAllLink
          href={seeAllHref}
          isId={isId}
          onClick={() => {
            void trackLajukanEvent('explore_see_all_click', {
              properties: {
                locale,
                source: 'explore_category',
                route: buildExploreCategoryHref(category),
                category: category.slug,
                contentType: kind,
              },
            });
          }}
          ariaLabel={
            isId
              ? `Lihat semua ${config.titleId}`
              : `View all ${config.titleEn}`
          }
        />
      </div>

      <div
        className={cn(
          'mt-4 grid gap-3',
          kind === 'video'
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
            : isNeedSection
              ? 'sm:grid-cols-2 xl:grid-cols-3'
              : kind === 'business' || kind === 'community'
                ? 'sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4',
        )}
        aria-label={isId ? config.titleId : config.titleEn}
      >
        {previewItems.map(item => {
          if (kind === 'business')
            return (
              <ExploreBusinessCard key={item.id} item={item} locale={locale} />
            );
          if (kind === 'community')
            return (
              <ExploreCommunityCard key={item.id} item={item} locale={locale} />
            );
          if (kind === 'video')
            return <ExploreVideoCard key={item.id} item={item} />;
          return (
            <ExploreListingCard key={item.id} item={item} locale={locale} />
          );
        })}
      </div>
    </section>
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
  return (
    <section className="py-4">
      <h3 className="text-base font-bold text-[color:var(--app-text)]">
        {isId ? config.titleId : config.titleEn}
      </h3>
      <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
        {isId ? config.descriptionId : config.descriptionEn}
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex min-h-[116px] cursor-pointer flex-col rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2"
          >
            <h3 className="text-sm font-bold text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)]">
              {isId ? item.titleId : item.titleEn}
            </h3>
            <p className="mt-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
              {isId ? item.summaryId : item.summaryEn}
            </p>
            <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-bold text-[color:var(--app-accent)]">
              {isId ? 'Baca panduan' : 'Read guide'}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
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
    <section className="py-4">
      <h3 className="text-base font-bold text-[color:var(--app-text)]">
        {isId ? config.titleId : config.titleEn}
      </h3>
      <div className="mt-3 divide-y divide-[color:var(--app-border)] border-y border-[color:var(--app-border)]">
        {items.map(item => (
          <details key={item.questionId} className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-[color:var(--app-text)]">
              {isId ? item.questionId : item.questionEn}
              <Plus className="h-4 w-4 shrink-0 transition group-open:rotate-45" />
            </summary>
            <p className="max-w-3xl pb-1 pt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
              {isId ? item.answerId : item.answerEn}
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
  const searchState = useMemo(
    () => parseGlobalSearchState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const requestedSide =
    searchParams.get('side') === 'demand' ? 'demand' : 'supply';
  const [queryDraft, setQueryDraft] = useState({
    source: searchState.query,
    value: searchState.query,
  });
  const queryInput =
    queryDraft.source === searchState.query
      ? queryDraft.value
      : searchState.query;
  const setQueryInput = (value: string) => {
    setQueryDraft({ source: searchState.query, value });
  };
  const [searchSide, setSearchSide] = useState<'supply' | 'demand'>(
    requestedSide,
  );
  const [payload, setPayload] = useState<ExploreCategoryResponse | null>(null);
  const [searchPayload, setSearchPayload] = useState<GlobalSearchResponse>(() =>
    emptyGlobalSearchResponse(searchState.query),
  );
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [searchRetryKey, setSearchRetryKey] = useState(0);
  const isId = locale === 'id';
  const isFilteredSearchMode =
    searchState.query.length >= 2 || Boolean(searchState.subcategory);

  useEffect(() => {
    setSearchSide(requestedSide);
  }, [requestedSide]);

  const selectSearchSide = (side: 'supply' | 'demand') => {
    setSearchSide(side);
    if (category.id === 'community' || category.id === 'video') return;
    const params = new URLSearchParams(searchParams.toString());
    if (side === 'demand') {
      params.set('side', 'demand');
    } else {
      params.delete('side');
    }
    params.delete('q');
    params.delete('tab');
    router.replace(
      appendSearchParams(
        `/${locale}${buildExploreCategoryHref(category)}`,
        params,
      ),
      { scroll: false },
    );
  };

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(
          `/api/explore/${encodeURIComponent(category.slug)}`,
          {
            cache: 'no-store',
            signal,
          },
        );
        if (!response.ok) throw new Error('explore_failed');
        setPayload((await response.json()) as ExploreCategoryResponse);
      } catch {
        if (!signal.aborted) setError(true);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [category.slug],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, retryKey]);

  useEffect(() => {
    if (!isFilteredSearchMode) return;
    const controller = new AbortController();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('type');
    params.set('category', category.slug);
    params.set('side', searchSide);
    if (searchSide === 'demand') params.set('tab', 'needs');
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setSearchLoading(true);
      setSearchError(false);
    });
    void fetch(`/api/search?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error('search_failed');
        return (await response.json()) as GlobalSearchResponse;
      })
      .then(setSearchPayload)
      .catch(() => {
        if (!controller.signal.aborted) {
          setSearchPayload(emptyGlobalSearchResponse(searchState.query));
          setSearchError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false);
      });
    return () => controller.abort();
  }, [
    category.slug,
    isFilteredSearchMode,
    searchParams,
    searchRetryKey,
    searchSide,
    searchState.query,
  ]);

  useEffect(() => {
    void trackLajukanEvent('explore_section_view', {
      properties: {
        locale,
        source: 'explore_category',
        route: buildExploreCategoryHref(category),
        category: category.slug,
      },
    });
  }, [category, locale]);

  const groups = payload?.groups;
  const listings = useMemo(
    () => [
      ...(groups?.products.items || []),
      ...(groups?.services.items || []),
    ],
    [groups],
  );
  const communityGroups = useMemo(
    () =>
      (groups?.communities.items || []).filter(
        item => item.metadata.entityType === 'group',
      ),
    [groups],
  );
  const communityDiscussions = useMemo(
    () =>
      (groups?.communities.items || []).filter(
        item => item.metadata.entityType === 'discussion',
      ),
    [groups],
  );
  const marketplaceDemandTotal = groups?.needs.total || 0;
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
  const dataSections = category.sections.filter(section => {
    if (category.id === 'community' || category.id === 'video') {
      return ['communities', 'videos', 'latest-listings'].includes(section.key);
    }
    if (searchSide === 'demand') return section.key === 'latest-needs';
    return [
      'featured-providers',
      'latest-listings',
      'nearby-businesses',
    ].includes(section.key);
  });

  const submitSearch = (nextQuery = queryInput) => {
    const clean = nextQuery.replace(/\s+/g, ' ').trim();
    if (clean.length < 2) return;
    if (category.id === 'community' || category.id === 'video') {
      const target = category.id === 'community' ? 'community' : 'reels';
      router.push(`/${locale}/${target}?q=${encodeURIComponent(clean)}`);
      return;
    }
    const params = new URLSearchParams({
      q: clean,
      side: searchSide,
    });
    if (searchSide === 'demand') params.set('tab', 'needs');
    router.push(
      appendSearchParams(`/${locale}${buildExploreCategoryHref(category)}`, params),
    );
  };

  const selectSearchTab = (tab: GlobalSearchTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'all') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    params.delete('cursor');
    router.push(
      appendSearchParams(
        `/${locale}${buildExploreCategoryHref(category)}`,
        params,
      ),
      { scroll: false },
    );
  };

  const isSocialCategory =
    category.id === 'community' || category.id === 'video';
  const categoryRailItems = isSocialCategory
    ? LAJUKAN_EXPLORE_CATEGORIES
    : MARKETPLACE_EXPLORE_CATEGORIES;
  const searchAction = isSocialCategory
    ? `/${locale}/${category.id === 'community' ? 'community' : 'reels'}`
    : `/${locale}${buildExploreCategoryHref(category)}`;
  const guidesConfig = category.sections.find(
    section => section.key === 'guides',
  );
  const faqConfig = category.sections.find(section => section.key === 'faq');
  const showHelpSection =
    !payload?.degraded &&
    primaryResultTotal > 0 &&
    Boolean(
      (guidesConfig && payload?.guides.length) ||
      (faqConfig && payload?.faq.length),
    );

  return (
    <div className="min-h-[100svh] bg-[color:var(--app-surface-muted)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10">
      <div className="lg:hidden">
        <Header />
        <div className="h-[calc(52px+env(safe-area-inset-top))]" />
      </div>

      <main className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <nav
          aria-label={isId ? 'Breadcrumb' : 'Breadcrumb'}
          className="flex items-center gap-1.5 text-xs text-[color:var(--app-text-soft)]"
        >
          <span>
            <Link
              href="/explore"
              className="cursor-pointer hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
            >
              {isId ? 'Jelajahi' : 'Explore'}
            </Link>
          </span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span
            aria-current="page"
            className="truncate font-semibold text-[color:var(--app-text)]"
          >
            {categoryLabel(category, locale)}
          </span>
        </nav>

        <section className="mt-4 grid gap-6 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.5)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-10">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] sm:h-14 sm:w-14">
              <Image
                src={category.image}
                alt=""
                fill
                priority
                sizes="64px"
                className="object-contain p-1"
              />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight text-[color:var(--app-text)] sm:text-3xl">
                {categoryLabel(category, locale)}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                {category.id === 'community'
                  ? isId
                    ? 'Temukan diskusi dan jawaban dari pelaku usaha.'
                    : 'Find discussions and answers from business owners.'
                  : category.id === 'video'
                    ? isId
                      ? 'Tonton video usaha dan inspirasi terbaru.'
                      : 'Watch the latest business videos and ideas.'
                    : searchSide === 'demand'
                      ? isId
                        ? 'Lihat kebutuhan pembeli terbaru dalam kategori ini, lalu pilih brief yang cocok untuk ditanggapi.'
                        : 'See the latest buyer requests in this category.'
                      : isId
                        ? 'Bandingkan penawaran, penyedia, dan usaha yang relevan dalam kategori ini.'
                        : 'Find products and providers in this category.'}
              </p>
            </div>
          </div>

          <div className="min-w-0">
            {!isSocialCategory ? (
              <div
                className="grid grid-cols-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-1"
                aria-label={isId ? 'Pilih tujuan' : 'Choose a goal'}
                role="tablist"
              >
                {[
                  {
                    value: 'supply' as const,
                    label: isId ? 'Cari yang menawarkan' : 'Find Providers',
                    shortLabel: isId ? 'Penyedia' : 'Providers',
                    icon: Search,
                  },
                  {
                    value: 'demand' as const,
                    label: isId ? 'Lihat kebutuhan pembeli' : 'Find Buyers',
                    shortLabel: isId ? 'Pembeli' : 'Buyers',
                    icon: ClipboardList,
                  },
                ].map(option => {
                  const Icon = option.icon;
                  const active = searchSide === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectSearchSide(option.value)}
                      role="tab"
                      aria-selected={active}
                      className={cn(
                        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] sm:text-sm',
                        active
                          ? 'cursor-default bg-[color:var(--app-accent)] text-white shadow-sm'
                          : 'cursor-pointer text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="sm:hidden">{option.shortLabel}</span>
                      <span className="hidden sm:inline">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <form
              action={searchAction}
              method="get"
              onSubmit={event => {
                event.preventDefault();
                const submitted = new FormData(event.currentTarget).get('q');
                submitSearch(
                  typeof submitted === 'string' ? submitted : queryInput,
                );
              }}
              className={cn(!isSocialCategory && 'mt-2.5')}
              role="search"
            >
              <label className="flex min-h-[52px] items-center gap-2 rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] px-3 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.45)] focus-within:border-[color:var(--app-accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--app-accent)_12%,transparent)]">
                <Search className="h-5 w-5 shrink-0 text-[color:var(--app-text-soft)]" />
                <input
                  type="search"
                  name="q"
                  value={queryInput}
                  onChange={event => setQueryInput(event.target.value)}
                  placeholder={
                    searchSide === 'demand' && !isSocialCategory
                      ? isId
                        ? `Cari pembeli ${category.shortLabelId.toLowerCase()}`
                        : `Search ${category.shortLabelEn.toLowerCase()} buyers`
                      : isId
                        ? `Cari di ${category.labelId}`
                        : `Search ${category.labelEn}`
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                />
                <button
                  type="submit"
                  disabled={queryInput.trim().length < 2}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[color:var(--app-accent)] px-3 text-xs font-bold text-white transition hover:bg-[color:var(--app-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 disabled:pointer-events-none',
                    queryInput.trim().length < 2 &&
                      'cursor-not-allowed opacity-40',
                  )}
                >
                  <span className="hidden sm:inline">
                    {isId ? 'Cari' : 'Search'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </label>
              {!isSocialCategory ? (
                <>
                  {searchSide === 'demand' ? (
                    <>
                      <input type="hidden" name="side" value="demand" />
                      <input type="hidden" name="tab" value="needs" />
                    </>
                  ) : null}
                </>
              ) : null}
            </form>
          </div>
        </section>

        <details className="group my-5 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 sm:p-5">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 rounded-md text-sm font-bold text-[color:var(--app-text)] marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]">
            <span>
              {isId
                ? 'Ganti kategori atau pilih detail'
                : 'Switch category or choose detail'}
            </span>
            <ChevronDown className="h-4 w-4 text-[color:var(--app-text-soft)] transition group-open:rotate-180" />
          </summary>
          <div
            className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
            aria-label={isId ? 'Kategori Jelajahi' : 'Explore categories'}
          >
            {!isSocialCategory ? (
              <Link
                href={buildCategorySearchHref({
                  query: searchParams.get('q') || undefined,
                  side: searchSide,
                })}
                className="inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] py-1.5 pl-2.5 pr-2.5 text-xs font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
              >
                <Layers3 className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {isId ? 'Semua' : 'All'}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-text-soft)]" />
              </Link>
            ) : null}
            {categoryRailItems.map(item => {
              const active = item.id === category.id;
              const href =
                !isSocialCategory && searchSide === 'demand'
                  ? buildCategorySearchHref({
                      category: item,
                      side: 'demand',
                    })
                  : buildExploreCategoryHref(item);
              const content = (
                <>
                  <span className="relative h-7 w-7 overflow-hidden rounded-full bg-white">
                    <Image
                      src={item.image}
                      alt=""
                      fill
                      sizes="28px"
                      className="object-contain"
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {locale === 'id' ? item.shortLabelId : item.shortLabelEn}
                  </span>
                </>
              );
              if (active) {
                return (
                  <span
                    key={item.id}
                    aria-current="page"
                    className="inline-flex min-h-11 min-w-0 cursor-default items-center gap-2 rounded-lg border border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] py-1.5 pl-1.5 pr-2.5 text-xs font-bold text-[color:var(--app-accent)]"
                  >
                    {content}
                    <span className="hidden shrink-0 items-center gap-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] font-bold sm:inline-flex">
                      <CheckCircle2 className="h-3 w-3" />
                      {isId ? 'Terpilih' : 'Active'}
                    </span>
                  </span>
                );
              }
              return (
                <Link
                  key={item.id}
                  href={href}
                  className={cn(
                    'inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] py-1.5 pl-1.5 pr-2.5 text-xs font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]',
                  )}
                >
                  {content}
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-text-soft)]" />
                </Link>
              );
            })}
          </div>
          <div
            className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--app-border)] pt-4"
            aria-label={isId ? 'Pilih subkategori' : 'Choose subcategory'}
          >
            {category.subcategories.map((subcategory, index) => (
              <Link
                key={subcategory.slug}
                href={buildCategorySearchHref({
                  category,
                  side: isSocialCategory ? undefined : searchSide,
                  subcategory: subcategory.slug,
                })}
                onClick={() => {
                  void trackLajukanEvent('explore_subcategory_click', {
                    properties: {
                      locale,
                      source: 'explore_category',
                      route: buildExploreCategoryHref(category),
                      category: category.slug,
                      subcategory: subcategory.slug,
                      position: index,
                    },
                  });
                }}
                className="inline-flex min-h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 text-xs font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
              >
                <span className="truncate">
                  {isId ? subcategory.labelId : subcategory.labelEn}
                </span>
                <ChevronRight className="h-3 w-3 shrink-0 text-[color:var(--app-text-soft)]" />
              </Link>
            ))}
          </div>
        </details>

        {isFilteredSearchMode ? (
          <ExploreSearchResults
            payload={searchPayload}
            loading={searchLoading}
            error={searchError}
            locale={locale}
            activeTab={searchState.tab}
            onSelectTab={selectSearchTab}
            onRetry={() => setSearchRetryKey(value => value + 1)}
          />
        ) : null}

        {!isFilteredSearchMode && loading ? <SectionSkeleton /> : null}
        {!isFilteredSearchMode && error ? (
          <section className="border-t border-[color:var(--app-border)] py-8">
            <div className="flex flex-col items-start gap-4 rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
                  <CircleAlert className="h-4 w-4 text-amber-600" />
                  {isId
                    ? 'Data belum bisa dimuat.'
                    : 'Data could not be loaded.'}
                </p>
                <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Kategori tetap bisa dipakai. Coba lagi.'
                    : 'Categories are still available. Retry.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRetryKey(value => value + 1)}
                className="min-h-10 cursor-pointer rounded-[8px] border border-[color:var(--app-border)] px-4 text-xs font-bold transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
              >
                {isId ? 'Coba lagi' : 'Retry'}
              </button>
            </div>
          </section>
        ) : null}

        {!isFilteredSearchMode && !loading && !error && payload ? (
          <>
            {!payload.degraded
              ? dataSections.map(section => {
                  if (section.key === 'latest-needs')
                    return (
                      <DataSection
                        key={section.key}
                        config={section}
                        items={groups?.needs.items || []}
                        locale={locale}
                        category={category}
                        kind="listing"
                      />
                    );
                  if (
                    section.key === 'featured-providers' ||
                    section.key === 'nearby-businesses'
                  )
                    return (
                      <DataSection
                        key={section.key}
                        config={section}
                        items={groups?.businesses.items || []}
                        locale={locale}
                        category={category}
                        kind="business"
                      />
                    );
                  if (section.key === 'latest-listings')
                    return (
                      <DataSection
                        key={section.key}
                        config={section}
                        items={
                          category.id === 'community'
                            ? communityDiscussions
                            : category.id === 'video'
                              ? groups?.videos.items || []
                              : listings
                        }
                        locale={locale}
                        category={category}
                        kind={
                          category.id === 'community'
                            ? 'community'
                            : category.id === 'video'
                              ? 'video'
                              : 'listing'
                        }
                      />
                    );
                  if (section.key === 'communities')
                    return (
                      <DataSection
                        key={section.key}
                        config={section}
                        items={communityGroups}
                        locale={locale}
                        category={category}
                        kind="community"
                      />
                    );
                  if (section.key === 'videos')
                    return (
                      <DataSection
                        key={section.key}
                        config={section}
                        items={groups?.videos.items || []}
                        locale={locale}
                        category={category}
                        kind="video"
                      />
                    );
                  return null;
                })
              : null}
            {payload.degraded ? (
              <section className="border-t border-[color:var(--app-border)] py-8">
                <div className="flex flex-col items-start gap-4 rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
                      <CircleAlert className="h-4 w-4 text-amber-600" />
                      {isId
                        ? 'Data sedang tidak tersedia.'
                        : 'Data is temporarily unavailable.'}
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                      {isId ? 'Coba muat ulang.' : 'Please retry.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRetryKey(value => value + 1)}
                    className="min-h-10 cursor-pointer rounded-[8px] border border-[color:var(--app-border)] px-4 text-xs font-bold transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
                  >
                    {isId ? 'Coba lagi' : 'Retry'}
                  </button>
                </div>
              </section>
            ) : null}
            {!payload.degraded && primaryResultTotal === 0 ? (
              <EmptyPrimarySection
                locale={locale}
                category={category}
                mode={searchSide}
              />
            ) : null}
            {showHelpSection ? (
              <details className="group border-t border-[color:var(--app-border)] py-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-md text-left marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]">
                  <span>
                    <span className="block text-sm font-bold text-[color:var(--app-text)]">
                      {isId ? 'Butuh panduan singkat?' : 'Need a quick guide?'}
                    </span>
                    <span className="mt-0.5 block text-xs text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Buka hanya kalau kamu ingin membaca tips tambahan.'
                        : 'Open only if you want extra tips.'}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-open:rotate-180" />
                </summary>
                <div className="mt-3">
                  {guidesConfig && payload.guides.length ? (
                    <GuidesSection
                      config={guidesConfig}
                      items={payload.guides}
                      locale={locale}
                    />
                  ) : null}
                  {faqConfig && payload.faq.length ? (
                    <FaqSection
                      config={faqConfig}
                      items={payload.faq}
                      locale={locale}
                    />
                  ) : null}
                </div>
              </details>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
