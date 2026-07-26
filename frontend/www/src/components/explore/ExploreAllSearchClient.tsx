'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Layers3,
  Search,
  Store,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ExploreSearchResults } from '@/components/explore/ExploreSearchResults';
import { Header } from '@/components/layout/Header';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import {
  MARKETPLACE_EXPLORE_CATEGORIES,
  buildCategorySearchHref,
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

function appendSearchParams(path: string, params: URLSearchParams) {
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function ExploreAllSearchClient({ locale }: { locale: LajukanLocale }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useMemo(
    () => parseGlobalSearchState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const isId = locale === 'id';
  const searchSide: Exclude<GlobalSearchSide, 'all'> =
    state.side === 'demand' ? 'demand' : 'supply';
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
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;
    if (state.side === 'all') {
      params.set('side', 'supply');
      changed = true;
    }
    if (params.has('type')) {
      params.delete('type');
      changed = true;
    }
    if (changed) {
      router.replace(appendSearchParams(`/${locale}/explore`, params), {
        scroll: false,
      });
    }
  }, [locale, router, searchParams, state.side]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('category');
    params.delete('type');
    params.set('side', searchSide);
    if (searchSide === 'demand') params.set('tab', 'needs');

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(false);
    });
    void fetch(`/api/search?${params.toString()}`, {
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
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [searchParams, searchSide, retryKey, state.query]);

  const updateParams = (
    changes: Record<string, string | null>,
    mode: 'push' | 'replace' = 'push',
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (!value || value === 'all' || value === 'relevance') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    params.delete('category');
    params.delete('cursor');
    params.delete('type');
    router[mode](appendSearchParams(`/${locale}/explore`, params), {
      scroll: false,
    });
  };

  const submitSearch = (nextQuery = queryInput) => {
    const clean = nextQuery.replace(/\s+/g, ' ').trim();
    if (clean.length < 2) return;
    void trackLajukanEvent('navbar_search_submit', {
      properties: {
        locale,
        source: 'explore_all',
        route: '/explore',
        query: clean,
        side: searchSide,
      },
    });
    updateParams({
      q: clean,
      side: searchSide,
      tab: searchSide === 'demand' ? 'needs' : null,
    });
  };

  const selectSide = (side: Exclude<GlobalSearchSide, 'all'>) => {
    updateParams(
      {
        side,
        tab: side === 'demand' ? 'needs' : null,
      },
      'replace',
    );
  };

  const selectTab = (tab: GlobalSearchTab) => {
    updateParams({ tab: tab === 'all' ? null : tab });
  };

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
          <Link
            href="/explore"
            className="cursor-pointer hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
          >
            {isId ? 'Jelajahi' : 'Explore'}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span
            aria-current="page"
            className="truncate font-semibold text-[color:var(--app-text)]"
          >
            {isId ? 'Semua' : 'All'}
          </span>
        </nav>

        <section className="mt-4 grid gap-6 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.5)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-10">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] sm:h-14 sm:w-14">
              <Layers3 className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight text-[color:var(--app-text)] sm:text-3xl">
                {isId ? 'Semua kategori' : 'All categories'}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                {searchSide === 'demand'
                  ? isId
                    ? 'Lihat kebutuhan pembeli dari semua kategori, lalu persempit ke kategori atau subkategori yang paling cocok.'
                    : 'Browse buyer needs across every category, then narrow to the best category or subcategory.'
                  : isId
                    ? 'Cari penyedia dari semua kategori, lalu pilih kategori saat sudah tahu arah kebutuhanmu.'
                    : 'Search providers across every category, then choose a category when the need is clearer.'}
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <div
              className="grid grid-cols-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-1"
              aria-label={isId ? 'Pilih tujuan' : 'Choose a goal'}
              role="tablist"
            >
              {[
                {
                  value: 'supply' as const,
                  label: isId ? 'Cari yang menawarkan' : 'Find Providers',
                  short: isId ? 'Penyedia' : 'Providers',
                  icon: Store,
                },
                {
                  value: 'demand' as const,
                  label: isId ? 'Lihat kebutuhan pembeli' : 'Find Buyers',
                  short: isId ? 'Pembeli' : 'Buyers',
                  icon: ClipboardList,
                },
              ].map(option => {
                const Icon = option.icon;
                const active = searchSide === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectSide(option.value)}
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
                    <span className="sm:hidden">{option.short}</span>
                    <span className="hidden sm:inline">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <form
              action={`/${locale}/explore`}
              method="get"
              onSubmit={event => {
                event.preventDefault();
                const submitted = new FormData(event.currentTarget).get('q');
                submitSearch(typeof submitted === 'string' ? submitted : queryInput);
              }}
              className="mt-2.5"
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
                    searchSide === 'demand'
                      ? isId
                        ? 'Contoh: butuh supplier kemasan'
                        : 'Example: needs packaging supplier'
                      : isId
                        ? 'Contoh: supplier kemasan'
                        : 'Example: packaging supplier'
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                />
                <input type="hidden" name="side" value={searchSide} />
                {searchSide === 'demand' ? (
                  <input type="hidden" name="tab" value="needs" />
                ) : null}
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
            </form>
          </div>
        </section>

        <section className="my-5 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 sm:p-5">
          <div className="flex min-h-9 items-center justify-between gap-3 text-sm font-bold text-[color:var(--app-text)]">
            <span>{isId ? 'Pilih kategori' : 'Choose category'}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <span
              aria-current="page"
              className="inline-flex min-h-11 min-w-0 cursor-default items-center gap-2 rounded-lg border border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] py-1.5 pl-2.5 pr-2.5 text-xs font-bold text-[color:var(--app-accent)]"
            >
              <Layers3 className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {isId ? 'Semua' : 'All'}
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            </span>
            {MARKETPLACE_EXPLORE_CATEGORIES.map(category => (
              <Link
                key={category.id}
                href={buildCategorySearchHref({
                  category,
                  query: state.query,
                  side: searchSide,
                })}
                className="inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] py-1.5 pl-1.5 pr-2.5 text-xs font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
              >
                <span className="relative h-7 w-7 overflow-hidden rounded-full bg-white">
                  <Image
                    src={category.image}
                    alt=""
                    fill
                    sizes="28px"
                    className="object-contain"
                  />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {isId ? category.shortLabelId : category.shortLabelEn}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-text-soft)]" />
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--app-border)] pt-4">
            {MARKETPLACE_EXPLORE_CATEGORIES.flatMap(category =>
              category.subcategories.slice(0, 4).map(subcategory => (
                <Link
                  key={`${category.slug}-${subcategory.slug}`}
                  href={buildCategorySearchHref({
                    category,
                    query: state.query || subcategory.query,
                    side: searchSide,
                    subcategory: subcategory.slug,
                  })}
                  className="inline-flex min-h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 text-xs font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
                >
                  <span className="truncate">
                    {isId ? subcategory.labelId : subcategory.labelEn}
                  </span>
                  <ChevronRight className="h-3 w-3 shrink-0 text-[color:var(--app-text-soft)]" />
                </Link>
              )),
            )}
          </div>
        </section>

        <ExploreSearchResults
          payload={payload}
          loading={loading}
          error={error}
          locale={locale}
          activeTab={state.tab}
          onSelectTab={selectTab}
          onRetry={() => setRetryKey(value => value + 1)}
        />
      </main>
    </div>
  );
}
