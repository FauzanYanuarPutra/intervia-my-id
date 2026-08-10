'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  MapPinned,
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

type ExploreSearchMode = 'supply' | 'demand' | 'references';

const SEARCH_RESPONSE_CACHE = new Map<string, GlobalSearchResponse>();
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

function rememberSearchResponse(key: string, payload: GlobalSearchResponse) {
  SEARCH_RESPONSE_CACHE.delete(key);
  SEARCH_RESPONSE_CACHE.set(key, payload);
  while (SEARCH_RESPONSE_CACHE.size > MAX_SEARCH_CACHE_ENTRIES) {
    const oldestKey = SEARCH_RESPONSE_CACHE.keys().next().value;
    if (!oldestKey) break;
    SEARCH_RESPONSE_CACHE.delete(oldestKey);
  }
}

function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function ExploreAllSearchClient({ locale }: { locale: LajukanLocale }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const state = useMemo(
    () => parseGlobalSearchState(new URLSearchParams(searchKey)),
    [searchKey],
  );
  const isId = locale === 'id';
  const referenceMode = state.tab === 'references';
  const searchSide: Exclude<GlobalSearchSide, 'all'> =
    state.side === 'demand' ? 'demand' : 'supply';
  const searchMode: ExploreSearchMode = referenceMode
    ? 'references'
    : searchSide;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    let changed = false;
    const rawQuery = params.get('q') || '';
    const cleanQuery = normalizeQuery(rawQuery);

    if (rawQuery !== cleanQuery || cleanQuery.length === 1) {
      if (cleanQuery.length >= 2) params.set('q', cleanQuery);
      else params.delete('q');
      changed = true;
    }
    if (referenceMode && params.has('side')) {
      params.delete('side');
      changed = true;
    } else if (!referenceMode && state.side === 'all') {
      params.set('side', 'supply');
      changed = true;
    }
    if (!referenceMode && params.get('tab') === 'references') {
      params.delete('tab');
      changed = true;
    }
    for (const key of ['type', 'category', 'subcategory']) {
      if (!params.has(key)) continue;
      params.delete(key);
      changed = true;
    }
    if (!referenceMode && params.has('cursor')) {
      params.delete('cursor');
      changed = true;
    }
    if (changed) {
      router.replace(appendSearchParams(`/${locale}/explore`, params), {
        scroll: false,
      });
    }
  }, [locale, referenceMode, router, searchKey, state.side]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(searchKey);
    params.delete('category');
    params.delete('subcategory');
    params.delete('type');
    if (referenceMode) {
      params.delete('side');
      params.set('tab', 'references');
    } else {
      params.set('side', searchSide);
      if (searchSide === 'demand') params.set('tab', 'needs');
      else if (params.get('tab') === 'needs') params.delete('tab');
      params.delete('cursor');
    }

    const requestKey = params.toString();
    const cachedPayload = SEARCH_RESPONSE_CACHE.get(requestKey);

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (cachedPayload) setPayload(cachedPayload);
      else setPayload(emptyGlobalSearchResponse(state.query));
      setLoading(true);
      setError(false);
    });
    void fetch(`/api/search?${requestKey}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error('search_failed');
        return (await response.json()) as GlobalSearchResponse;
      })
      .then(nextPayload => {
        if (controller.signal.aborted) return;
        rememberSearchResponse(requestKey, nextPayload);
        setPayload(nextPayload);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [referenceMode, retryKey, searchKey, searchSide, state.query]);

  const updateParams = (
    changes: Record<string, string | null>,
    mode: 'push' | 'replace' = 'push',
  ) => {
    const params = new URLSearchParams(searchKey);
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
    const clean = normalizeQuery(nextQuery);
    if (clean.length === 1 || (clean.length < 2 && !referenceMode)) return;
    if (clean.length >= 2) {
      void trackLajukanEvent('navbar_search_submit', {
        properties: {
          locale,
          source: 'explore_all',
          route: '/explore',
          query: clean,
          side: referenceMode ? 'reference' : searchSide,
        },
      });
    }
    updateParams({
      q: clean || null,
      side: referenceMode ? null : searchSide,
      tab: referenceMode
        ? 'references'
        : searchSide === 'demand'
          ? 'needs'
          : null,
    });
  };

  const selectMode = (mode: ExploreSearchMode) => {
    updateParams(
      {
        side: mode === 'references' ? null : mode,
        tab:
          mode === 'references'
            ? 'references'
            : mode === 'demand'
              ? 'needs'
              : null,
        subcategory: null,
      },
      'replace',
    );
  };

  const selectTab = (tab: GlobalSearchTab) => {
    if (tab === 'references') {
      selectMode('references');
      return;
    }
    updateParams({ tab: tab === 'all' ? null : tab });
  };

  const loadNextReferenceBatch = (cursor: string) => {
    const cleanCursor = cursor.trim();
    if (
      !referenceMode ||
      !cleanCursor ||
      cleanCursor.length > 96 ||
      !/^\d{1,19}:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        cleanCursor,
      )
    ) {
      return;
    }

    const params = new URLSearchParams(searchKey);
    params.set('tab', 'references');
    params.set('cursor', cleanCursor);
    params.delete('side');
    params.delete('category');
    params.delete('subcategory');
    params.delete('type');
    router.push(appendSearchParams(`/${locale}/explore`, params), {
      scroll: false,
    });
  };

  const normalizedQueryLength = queryInput.trim().length;
  const canSubmit = referenceMode
    ? normalizedQueryLength === 0 || normalizedQueryLength >= 2
    : normalizedQueryLength >= 2;
  const advancedFilterCount = EXPLORE_ADVANCED_FILTER_KEYS.filter(key => {
    const value = new URLSearchParams(searchKey).get(key);
    return Boolean(value && value.trim());
  }).length;
  const clearAdvancedFilters = () => {
    updateParams(
      Object.fromEntries(
        EXPLORE_ADVANCED_FILTER_KEYS.map(key => [key, null]),
      ),
      'replace',
    );
  };

  return (
    <div className="min-h-[100svh] overflow-x-clip bg-[color:var(--app-surface-muted)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10">
      <div className="lg:hidden">
        <Header />
        <div className="h-[calc(52px+env(safe-area-inset-top))]" />
      </div>

      <main className="mx-auto w-full min-w-0 max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
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
            {referenceMode
              ? isId
                ? 'Referensi tempat'
                : 'Place references'
              : searchSide === 'demand'
                ? isId
                  ? 'Permintaan pembeli'
                  : 'Buyer requests'
                : isId
                  ? 'Hasil pencarian'
                  : 'Search results'}
          </span>
        </nav>

        <section className="mt-4 grid min-w-0 gap-5 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.5)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-10">
          <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight text-[color:var(--app-text)] sm:text-3xl">
                {referenceMode
                  ? isId
                    ? 'Referensi tempat usaha'
                    : 'Business place references'
                  : searchSide === 'demand'
                    ? isId
                      ? 'Permintaan dari calon pembeli'
                      : 'Requests from potential buyers'
                    : isId
                      ? 'Hasil pencarian'
                      : 'Search results'}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                {referenceMode
                  ? isId
                    ? 'Data lokasi untuk acuan. Ini bukan daftar toko atau penawaran aktif.'
                    : 'Location data for reference. These are not active stores or offers.'
                  : searchSide === 'demand'
                  ? isId
                    ? 'Cari orang yang sedang membutuhkan produk atau jasa seperti milikmu.'
                    : 'Find people looking for products or services like yours.'
                  : isId
                    ? 'Cari produk, jasa, supplier, dan usaha dari semua kategori.'
                    : 'Find products, services, suppliers, and businesses across all categories.'}
              </p>
          </div>

          <div className="min-w-0">
            {referenceMode ? (
              <button
                type="button"
                onClick={() => selectMode('supply')}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--app-border)] px-3 text-xs font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
              >
                <Store className="h-4 w-4" />
                {isId ? 'Kembali ke produk & jasa' : 'Back to products & services'}
              </button>
            ) : (
              <>
                <div
                  className="grid grid-cols-[repeat(2,minmax(0,1fr))] rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1"
                  aria-label={isId ? 'Pilih tujuan pencarian' : 'Choose a search goal'}
                  role="group"
                >
                  {[
                    {
                      value: 'supply' as const,
                      label: isId ? 'Produk & jasa' : 'Products & services',
                      icon: Store,
                    },
                    {
                      value: 'demand' as const,
                      label: isId ? 'Permintaan pembeli' : 'Buyer requests',
                      icon: ClipboardList,
                    },
                  ].map(option => {
                    const Icon = option.icon;
                    const active = searchMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => selectMode(option.value)}
                        aria-pressed={active}
                        className={cn(
                          'inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-md px-2 text-center text-xs font-bold leading-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] sm:text-sm',
                          active
                            ? 'cursor-default bg-[color:var(--app-accent)] text-white shadow-sm'
                            : 'cursor-pointer text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-text)]',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => selectMode('references')}
                  className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[color:var(--app-text-soft)] transition hover:bg-amber-50 hover:text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                >
                  <MapPinned className="h-4 w-4" />
                  {isId ? 'Cari referensi tempat usaha' : 'Find business place references'}
                </button>
              </>
            )}

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
              <label htmlFor="explore-results-search" className="sr-only">
                {isId ? 'Cari di Lajukan' : 'Search Lajukan'}
              </label>
              <div className="flex min-h-[52px] min-w-0 items-center gap-2 rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] px-3 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.45)] focus-within:border-[color:var(--app-accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--app-accent)_12%,transparent)]">
                <Search className="h-5 w-5 shrink-0 text-[color:var(--app-text-soft)]" />
                <input
                  type="search"
                  id="explore-results-search"
                  name="q"
                  value={queryInput}
                  onChange={event => setQueryInput(event.target.value)}
                  placeholder={
                    referenceMode
                      ? isId
                        ? 'Contoh: warung makan Bandung'
                        : 'Example: restaurants in Bandung'
                      : searchSide === 'demand'
                      ? isId
                        ? 'Contoh: pembeli butuh kemasan'
                        : 'Example: buyers need packaging'
                      : isId
                        ? 'Contoh: kemasan standing pouch'
                        : 'Example: standing pouch packaging'
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                  aria-label={isId ? 'Cari di seluruh Lajukan' : 'Search all of Lajukan'}
                />
                {referenceMode ? (
                  <input type="hidden" name="tab" value="references" />
                ) : (
                  <input type="hidden" name="side" value={searchSide} />
                )}
                {!referenceMode && searchSide === 'demand' ? (
                  <input type="hidden" name="tab" value="needs" />
                ) : null}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[color:var(--app-accent)] px-3 text-xs font-bold text-white transition hover:bg-[color:var(--app-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 disabled:pointer-events-none',
                    !canSubmit && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <span>
                    {referenceMode && !queryInput.trim()
                      ? isId
                        ? 'Muat'
                        : 'Load'
                      : isId
                        ? 'Cari'
                        : 'Search'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </section>

        {referenceMode ? (
          <section className="my-5 rounded-lg border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-800">
                  <MapPinned className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-amber-950">
                    {isId
                      ? 'Data lokasi untuk acuan, bukan toko aktif'
                      : 'Location data for reference, not active stores'}
                  </h2>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-950/80">
                    {isId
                      ? 'Gunakan untuk menemukan nama dan lokasi tempat usaha. Data ini tidak menunjukkan stok, harga, kontak, atau status verifikasi.'
                      : 'Use this to find business names and locations. It does not show stock, prices, contact details, or verification status.'}
                  </p>
                </div>
              </div>
              <Link
                href="/umkm?scope=references"
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-xs font-black text-amber-950 transition hover:border-amber-400 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
              >
                <MapPinned className="h-4 w-4" aria-hidden="true" />
                {isId ? 'Lihat di peta UMKM' : 'View on the MSME map'}
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-amber-200 pt-4 text-[11px] font-bold">
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 text-amber-950 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
              >
                {isId ? 'Sumber: OpenStreetMap' : 'Source: OpenStreetMap'}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <a
                href="https://opendatacommons.org/licenses/odbl/1-0/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 text-amber-950 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
              >
                {isId ? 'Lisensi data: ODbL 1.0' : 'Data license: ODbL 1.0'}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </section>
        ) : (
          <section className="my-4 min-w-0" aria-labelledby="explore-result-category-title">
            <div className="flex min-h-9 items-center justify-between gap-3">
              <h2
                id="explore-result-category-title"
                className="text-sm font-bold text-[color:var(--app-text)]"
              >
                {isId ? 'Pilih kategori' : 'Choose a category'}
              </h2>
              {advancedFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearAdvancedFilters}
                  className="min-h-11 rounded-lg px-2 text-xs font-bold text-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
                >
                  {isId
                    ? `Hapus ${advancedFilterCount} filter tambahan`
                    : `Clear ${advancedFilterCount} extra filters`}
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex min-w-0 gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span
              aria-current="page"
              className="inline-flex min-h-11 shrink-0 cursor-default items-center rounded-full border border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] px-4 text-xs font-bold text-[color:var(--app-accent)]"
            >
              {isId ? 'Semua' : 'All'}
            </span>
            {MARKETPLACE_EXPLORE_CATEGORIES.map(category => (
              <Link
                key={category.id}
                href={buildCategorySearchHref({
                  category,
                  query: state.query,
                  side: searchSide,
                })}
                className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-xs font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
              >
                {isId ? category.shortLabelId : category.shortLabelEn}
              </Link>
            ))}
            </div>
          </section>
        )}

        <ExploreSearchResults
          payload={payload}
          loading={loading}
          error={error}
          locale={locale}
          activeTab={state.tab}
          onSelectTab={selectTab}
          onNextCursor={loadNextReferenceBatch}
          onRetry={() => setRetryKey(value => value + 1)}
        />
      </main>
    </div>
  );
}
