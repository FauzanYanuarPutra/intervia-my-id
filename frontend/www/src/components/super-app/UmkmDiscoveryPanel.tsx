'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPinned, Star } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buildUmkmStorefrontPath } from '@/lib/umkmSurface';
import {
  FilterChip,
  MapQuickControls,
  PlaceThumb,
} from '@/components/super-app/UmkmPlacesChromePrimitives';
import {
  buildUmkmPlacePresentation,
  formatUmkmPlaceDistance,
} from '@/lib/super-app/umkm-place-ui';
import {
  getNextUmkmMapTheme,
  getUmkmMapThemeLabel,
  UmkmStoreMap,
  type UmkmMapRouteSummary,
  type UmkmMapStore,
  type UmkmMapTheme,
} from './UmkmStoreMap';
import { useViewerLocation } from './useViewerLocation';

type UmkmDiscoveryPanelProps = {
  isId: boolean;
  query?: string;
  city?: string;
  limit?: number;
  title?: string;
  description?: string;
  selectedSlug?: string;
};

type DiscoveryStore = UmkmMapStore & {
  description: string | null;
  phone: string | null;
  offline_order_enabled?: boolean;
  online_order_enabled?: boolean;
  table_count?: number;
  available_table_count?: number;
  max_table_capacity?: number;
  reservation_enabled?: boolean;
  metadata?: Record<string, unknown>;
};

type StoresResponse = {
  data?: {
    items: DiscoveryStore[];
    count: number;
  };
  error?: string;
};

type FilterKey =
  | 'all'
  | 'open'
  | 'food'
  | 'retail'
  | 'service'
  | 'workshop';

const DISCOVERY_REFRESH_INTERVAL_MS = 25000;
const LIST_PAGE_SIZE = 4;

function getOpenLabel(isOpen: boolean, isId: boolean) {
  if (isOpen) return isId ? 'Buka sekarang' : 'Open now';
  return isId ? 'Tutup' : 'Closed';
}

export function UmkmDiscoveryPanel({
  isId,
  query,
  city,
  limit = 240,
  title,
  description,
  selectedSlug,
}: UmkmDiscoveryPanelProps) {
  const [stores, setStores] = useState<DiscoveryStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [filterKey, setFilterKey] = useState<FilterKey>('open');
  const [listPage, setListPage] = useState(1);
  const selectedPreviewRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollStoreIdRef = useRef<string | null>(null);
  const mobileMapRef = useRef<HTMLDivElement | null>(null);
  const desktopMapRef = useRef<HTMLDivElement | null>(null);
  const { viewerLocation, locating, locationError, requestViewerLocation } =
    useViewerLocation({
      isId,
      autoRequest: false,
    });
  const [mapInteractive, setMapInteractive] = useState(false);
  const [mapTheme, setMapTheme] = useState<UmkmMapTheme>('default');
  const [showRoute, setShowRoute] = useState(false);
  const [routeSummary, setRouteSummary] = useState<UmkmMapRouteSummary | null>(
    null,
  );
  const [mapFocusMode, setMapFocusMode] = useState<
    'stores' | 'viewer' | 'route'
  >('stores');
  const [mapFocusNonce, setMapFocusNonce] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (query?.trim()) params.set('q', query.trim());
        if (city?.trim()) params.set('city', city.trim());
        params.set('limit', String(limit));

        const res = await fetch(
          `/api/super-app/umkm/stores?${params.toString()}`,
          {
            cache: 'no-store',
            credentials: 'include',
          },
        );
        const payload = (await res.json().catch(() => ({}))) as StoresResponse;
        if (!res.ok || !payload.data) {
          throw new Error(payload.error || 'Failed to load business discovery');
        }
        if (!active) return;
        const items = payload.data.items || [];
        setStores(items);
        setTotalCount(payload.data.count ?? items.length);
        setSelectedStoreId(current => {
          if (current && items.some(item => item.id === current)) {
            return current;
          }
          return items[0]?.id || null;
        });
      } catch (err: unknown) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : isId
              ? 'Gagal memuat daftar usaha.'
              : 'Failed to load business discovery.',
        );
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, DISCOVERY_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [city, isId, limit, query]);

  const preparedStores = useMemo(
    () =>
      stores.map(store => ({
        store,
        ui: buildUmkmPlacePresentation(store, isId, null),
      })),
    [isId, stores],
  );

  const filteredStores = useMemo(() => {
    let next = [...preparedStores];
    if (filterKey === 'open') {
      next = next.filter(item => item.ui.openNow !== false);
    }
    if (filterKey === 'food') {
      next = next.filter(item => item.ui.isFood);
    }
    if (
      filterKey === 'retail' ||
      filterKey === 'service' ||
      filterKey === 'workshop'
    ) {
      next = next.filter(item => item.ui.kind === filterKey);
    }
    return next;
  }, [filterKey, preparedStores]);

  const usingFallbackResults =
    preparedStores.length > 0 && filteredStores.length === 0;
  const visibleStores = usingFallbackResults ? preparedStores : filteredStores;

  useEffect(() => {
    if (!visibleStores.length) {
      setSelectedStoreId(null);
      return;
    }
    if (visibleStores.some(item => item.store.id === selectedStoreId)) return;
    setSelectedStoreId(visibleStores[0]?.store.id || null);
  }, [selectedStoreId, visibleStores]);

  const selectedPlace =
    visibleStores.find(item => item.store.id === selectedStoreId) ||
    visibleStores[0] ||
    preparedStores[0] ||
    null;

  const listedPlaces = visibleStores.filter(
    item => item.store.id !== selectedPlace?.store.id,
  );
  const paginatedListedPlaces = listedPlaces.slice(
    0,
    listPage * LIST_PAGE_SIZE,
  );
  const canLoadMoreList = paginatedListedPlaces.length < listedPlaces.length;

  useEffect(() => {
    if (!selectedSlug) return;
    const matchedStore = visibleStores.find(
      item => item.store.slug === selectedSlug,
    );
    if (!matchedStore) return;
    setSelectedStoreId(matchedStore.store.id);
  }, [selectedSlug, visibleStores]);

  useEffect(() => {
    setListPage(1);
  }, [city, filterKey, query, visibleStores.length]);

  const handleSelectStore = useCallback(
    (storeId: string, options?: { scrollToPreview?: boolean }) => {
      if (selectedStoreId === storeId) return;
      pendingScrollStoreIdRef.current = options?.scrollToPreview
        ? storeId
        : null;
      setSelectedStoreId(storeId);
    },
    [selectedStoreId],
  );

  useEffect(() => {
    if (!selectedPlace) return;
    if (pendingScrollStoreIdRef.current !== selectedPlace.store.id) return;

    pendingScrollStoreIdRef.current = null;

    const scrollToPreview = () => {
      const target = selectedPreviewRef.current;
      if (!target || typeof window === 'undefined') return;
      const top = target.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: 'smooth',
      });
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToPreview);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedPlace]);

  const filters = [
    { key: 'open' as const, label: isId ? 'Buka sekarang' : 'Open now' },
    { key: 'food' as const, label: isId ? 'Makanan' : 'Food' },
    { key: 'service' as const, label: isId ? 'Jasa' : 'Service' },
    { key: 'retail' as const, label: isId ? 'Toko' : 'Shop' },
    { key: 'all' as const, label: isId ? 'Semua' : 'All' },
  ];

  const activeFilter =
    filters.find(filter => filter.key === filterKey) || filters[0];

  const handleOpenMapPreview = useCallback(() => {
    if (typeof window === 'undefined') return;
    const target =
      window.innerWidth >= 1024 ? desktopMapRef.current : mobileMapRef.current;
    target?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  const totalLabel = `${totalCount ?? stores.length} ${isId ? 'usaha' : 'businesses'}`;
  const routeDistanceLabel = useMemo(() => {
    if (!routeSummary?.distance_m || routeSummary.used_fallback) return null;
    return formatUmkmPlaceDistance(routeSummary.distance_m / 1000, isId);
  }, [isId, routeSummary]);
  const bumpMapFocus = useCallback((mode: 'stores' | 'viewer' | 'route') => {
    setMapFocusMode(mode);
    setMapFocusNonce(current => current + 1);
  }, []);
  const cycleMapTheme = useCallback(() => {
    setMapTheme(current => getNextUmkmMapTheme(current));
  }, []);

  useEffect(() => {
    if (!selectedPlace) return;
    setRouteSummary(null);
  }, [selectedPlace?.store.id]);

  useEffect(() => {
    if (showRoute && viewerLocation && selectedPlace) {
      bumpMapFocus('route');
    }
  }, [bumpMapFocus, selectedPlace, showRoute, viewerLocation]);

  const renderDiscoveryMap = useCallback(
    (className: string) => {
      if (!selectedPlace) return null;

      return (
        <div className="relative isolate overflow-hidden rounded-[20px]">
          <UmkmStoreMap
            stores={visibleStores.map(item => item.store)}
            selectedStoreId={selectedPlace.store.id}
            viewerLocation={viewerLocation}
            interactive={mapInteractive}
            theme={mapTheme}
            routeToStoreId={selectedPlace.store.id}
            showRoute={showRoute}
            onRouteResolved={setRouteSummary}
            focusMode={mapFocusMode}
            focusNonce={mapFocusNonce}
            onSelectStore={storeId =>
              handleSelectStore(storeId, { scrollToPreview: true })
            }
            className={className}
          />
          <div className="pointer-events-none absolute bottom-3 left-3 z-[1100] sm:bottom-4">
            <MapQuickControls
              isId={isId}
              interactive={mapInteractive}
              locating={locating}
              locationError={locationError}
              routeEnabled={showRoute}
              distanceLabel={routeDistanceLabel}
              themeLabel={getUmkmMapThemeLabel(mapTheme, isId)}
              onCycleTheme={cycleMapTheme}
              onToggleInteractive={() => setMapInteractive(current => !current)}
              onFocusViewer={async () => {
                const nextLocation =
                  viewerLocation || (await requestViewerLocation());
                if (!nextLocation) return;
                bumpMapFocus('viewer');
              }}
              onToggleRoute={async () => {
                if (showRoute) {
                  setShowRoute(false);
                  bumpMapFocus('stores');
                  return;
                }

                const nextLocation =
                  viewerLocation || (await requestViewerLocation());
                if (!nextLocation) return;
                setShowRoute(true);
                bumpMapFocus('route');
              }}
            />
          </div>
        </div>
      );
    },
    [
      bumpMapFocus,
      cycleMapTheme,
      handleSelectStore,
      isId,
      locating,
      locationError,
      mapFocusMode,
      mapFocusNonce,
      mapInteractive,
      mapTheme,
      requestViewerLocation,
      routeDistanceLabel,
      selectedPlace,
      showRoute,
      viewerLocation,
      visibleStores,
    ],
  );

  return (
    <section className="overflow-hidden bg-transparent pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-3">
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[1.8rem] font-black tracking-[-0.04em] text-[color:var(--app-text)] sm:text-[2rem]">
              {title || (isId ? 'Usaha di sekitarmu' : 'Businesses near you')}
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-[color:var(--app-text-soft)] sm:text-[14px]">
              {description ||
                (isId
                  ? 'Pilih kategori yang kamu butuhin, lalu buka usaha yang cocok.'
                  : 'Pick a category, then open the business that fits.')}
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-[color:var(--app-text-soft)] shadow-[0_12px_26px_-22px_rgba(15,23,42,0.12)]">
            {totalLabel}
          </span>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {filters.map(filter => (
              <FilterChip
                key={filter.key}
                active={filterKey === filter.key}
                onClick={() => setFilterKey(filter.key)}
              >
                {filter.label}
              </FilterChip>
            ))}
          </div>

          <button
            type="button"
            onClick={handleOpenMapPreview}
            className="inline-flex min-h-[42px] w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[color:var(--app-accent)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_10%,white)]"
          >
            <MapPinned className="h-4 w-4" />
            {isId ? 'Buka peta' : 'Open map'}
          </button>
        </div>

        {error ? (
          <div className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-8 text-center text-sm text-[color:var(--app-text-soft)] shadow-[0_18px_34px_-28px_rgba(15,23,42,0.14)]">
            {error}
          </div>
        ) : loading && !selectedPlace ? (
          <div className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-8 text-center text-sm font-semibold text-[color:var(--app-text-soft)] shadow-[0_18px_34px_-28px_rgba(15,23,42,0.14)]">
            {isId ? 'Lagi muat daftar usaha...' : 'Loading business results...'}
          </div>
        ) : selectedPlace ? (
          <>
            {usingFallbackResults ? (
              <p className="text-[12px] text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Belum ada hasil yang pas buat kategori ini. Semua usaha tetap ditampilin dulu ya.'
                  : 'No direct match for this category yet, so all businesses are shown first.'}
              </p>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="min-w-0 space-y-3 sm:space-y-4">
                <article
                  ref={selectedPreviewRef}
                  className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-3 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.12)] sm:rounded-[28px] sm:p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-[240px_minmax(0,1fr)] sm:gap-4">
                    <PlaceThumb
                      src={selectedPlace.ui.gallery[0] || selectedPlace.ui.coverImage}
                      alt={selectedPlace.store.name}
                      className="h-[180px] rounded-[20px] sm:h-[210px]"
                    />

                    <div className="min-w-0 self-center">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {selectedPlace.ui.ratingLabel}
                        </span>
                        <span className="text-[color:var(--app-text-soft)]">
                          {selectedPlace.ui.kindLabel}
                        </span>
                        {selectedPlace.ui.serviceBadges[0] ? (
                          <span className="text-[color:var(--app-text-soft)]">
                            {selectedPlace.ui.serviceBadges[0]}
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-2 text-[1.45rem] font-black leading-tight text-[color:var(--app-text)] sm:text-[1.7rem]">
                        <Link href={buildUmkmStorefrontPath(selectedPlace.store.slug)}>
                          {selectedPlace.store.name}
                        </Link>
                      </h3>

                      <p className="mt-2 inline-flex items-center gap-2 text-[14px] font-semibold text-emerald-600">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            selectedPlace.ui.openNow !== false
                              ? 'bg-emerald-500'
                              : 'bg-slate-300'
                          }`}
                        />
                        {getOpenLabel(selectedPlace.ui.openNow !== false, isId)}
                      </p>

                      <p className="mt-1 text-[14px] text-[color:var(--app-text-soft)]">
                        {selectedPlace.store.city}
                      </p>

                      <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-[color:var(--app-text-soft)]">
                        {selectedPlace.store.description || selectedPlace.ui.addressLine}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={buildUmkmStorefrontPath(selectedPlace.store.slug)}
                          className="inline-flex min-h-[40px] items-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-[12px] font-semibold text-white shadow-[0_16px_28px_-24px_color-mix(in_srgb,var(--app-accent)_40%,transparent)] transition hover:brightness-105"
                        >
                          {isId ? 'Lihat detail' : 'View details'}
                        </Link>
                        {selectedPlace.ui.whatsappHref ? (
                          <a
                            href={selectedPlace.ui.whatsappHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
                          >
                            WhatsApp
                          </a>
                        ) : (
                          <a
                            href={selectedPlace.ui.googleMapsDirectionsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
                          >
                            {isId ? 'Rute' : 'Directions'}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>

                <div
                  ref={mobileMapRef}
                  className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-2 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.12)] lg:hidden"
                >
                  <div className="flex items-center justify-between px-2 pb-2 pt-1">
                    <div>
                      <p className="text-[13px] font-semibold text-[color:var(--app-text)]">
                        {isId ? 'Peta usaha' : 'Business map'}
                      </p>
                      <p className="text-[11px] text-[color:var(--app-text-soft)]">
                        {activeFilter.label} | {visibleStores.length}
                      </p>
                    </div>
                  </div>

                  {renderDiscoveryMap('h-[280px] w-full')}
                </div>

                {paginatedListedPlaces.length > 0 ? (
                  <div className="space-y-3">
                    {paginatedListedPlaces.map(item => {
                      const isOpen = item.ui.openNow !== false;
                      return (
                        <button
                          key={item.store.id}
                          type="button"
                          onClick={() =>
                            handleSelectStore(item.store.id, {
                              scrollToPreview: true,
                            })
                          }
                          className="w-full rounded-[22px] border border-slate-200/80 bg-white p-3 text-left shadow-[0_14px_30px_-24px_rgba(15,23,42,0.1)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_4%,white)] sm:rounded-[24px] sm:p-4"
                        >
                          <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-4">
                            <PlaceThumb
                              src={item.ui.gallery[0] || item.ui.coverImage}
                              alt={item.store.name}
                              className="h-[104px] rounded-[18px] sm:h-[116px]"
                            />

                            <div className="min-w-0 self-center">
                              <h4 className="line-clamp-2 text-[1rem] font-black leading-tight text-[color:var(--app-text)] sm:text-[1.08rem]">
                                {item.store.name}
                              </h4>

                              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
                                <span className="inline-flex items-center gap-1 text-amber-600">
                                  <Star className="h-3.5 w-3.5 fill-current" />
                                  {item.ui.ratingLabel}
                                </span>
                                <span className="text-[color:var(--app-text-soft)]">
                                  {item.ui.kindLabel}
                                </span>
                              </div>

                              <p
                                className={`mt-2 inline-flex items-center gap-2 text-[12px] font-semibold ${
                                  isOpen ? 'text-emerald-600' : 'text-slate-500'
                                }`}
                              >
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${
                                    isOpen ? 'bg-emerald-500' : 'bg-slate-300'
                                  }`}
                                />
                                {getOpenLabel(isOpen, isId)}
                              </p>

                              <p className="mt-1 text-[12px] text-[color:var(--app-text-soft)]">
                                {item.store.city}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-6 text-center text-[12px] text-[color:var(--app-text-soft)] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.1)]">
                    {isId
                      ? 'Semua hasil yang ada sudah dipakai di kartu utama.'
                      : 'All available results are already used in the featured card.'}
                  </div>
                )}

                {canLoadMoreList ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setListPage(current => current + 1)}
                      className="inline-flex min-h-[42px] items-center rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
                    >
                      {isId ? 'Lihat lagi' : 'Show more'}
                    </button>
                  </div>
                ) : null}
              </div>

              <aside
                ref={desktopMapRef}
                className="hidden lg:block lg:sticky lg:top-24 lg:self-start"
              >
                <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-2 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.12)]">
                  <div className="flex items-center justify-between px-2 pb-2 pt-1">
                    <div>
                      <p className="text-[13px] font-semibold text-[color:var(--app-text)]">
                        {isId ? 'Peta usaha' : 'Business map'}
                      </p>
                      <p className="text-[11px] text-[color:var(--app-text-soft)]">
                        {activeFilter.label} | {visibleStores.length}
                      </p>
                    </div>
                  </div>

                  {renderDiscoveryMap('h-[560px] w-full')}
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
