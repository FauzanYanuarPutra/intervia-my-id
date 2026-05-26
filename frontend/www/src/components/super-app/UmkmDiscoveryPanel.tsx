'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPinned, MessageCircle, Navigation, Star, Store, X } from 'lucide-react';
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
  openMapSignal?: number;
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
  openMapSignal = 0,
}: UmkmDiscoveryPanelProps) {
  const [stores, setStores] = useState<DiscoveryStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [filterKey, setFilterKey] = useState<FilterKey>('all');
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
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
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
  const selectedPlaceId = selectedPlace?.store.id || null;
  const selectedContactHref =
    selectedPlace?.ui.whatsappHref || selectedPlace?.ui.telHref || null;
  const selectedContactLabel = selectedPlace?.ui.whatsappHref
    ? 'Chat'
    : selectedPlace?.ui.telHref
      ? isId
        ? 'Telepon'
        : 'Call'
      : 'Chat';
  const selectedContactIsExternal =
    selectedContactHref?.startsWith('http') || false;

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
    if (window.innerWidth < 1024) {
      setMobileMapOpen(true);
    }
    const target =
      window.innerWidth >= 1024 ? desktopMapRef.current : mobileMapRef.current;
    window.requestAnimationFrame(() => {
      target?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, []);

  useEffect(() => {
    if (!openMapSignal) return;
    handleOpenMapPreview();
  }, [handleOpenMapPreview, openMapSignal]);

  useEffect(() => {
    if (!mobileMapOpen || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMapOpen]);

  const totalLabel =
    loading && totalCount === null
      ? isId
        ? 'Memuat'
        : 'Loading'
      : `${totalCount ?? stores.length} ${isId ? 'usaha' : 'businesses'}`;
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
    if (!selectedPlaceId) return;
    setRouteSummary(null);
  }, [selectedPlaceId]);

  useEffect(() => {
    if (showRoute && viewerLocation && selectedPlace) {
      bumpMapFocus('route');
    }
  }, [bumpMapFocus, selectedPlace, showRoute, viewerLocation]);

  const renderDiscoveryMap = useCallback(
    (className: string, edgeToEdge = false) => {
      if (!selectedPlace) return null;

      return (
        <div
          className={`relative isolate overflow-hidden ${
            edgeToEdge ? 'h-full rounded-none' : 'rounded-[20px]'
          }`}
        >
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
    <section className="min-w-0 overflow-hidden bg-transparent pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-3">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[1.08rem] font-black tracking-[-0.035em] text-[color:var(--app-text)] sm:text-[1.35rem]">
              {title || (isId ? 'Usaha di sekitarmu' : 'Businesses near you')}
            </h2>
            <p className="mt-0.5 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
              {description ||
                (isId
                  ? 'Pilih cepat, buka cepat.'
                  : 'Pick fast, open fast.')}
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] shadow-[0_12px_26px_-22px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950">
            {totalLabel}
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
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
            className="inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-[color:var(--app-accent)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_10%,white)] sm:w-fit dark:border-slate-800 dark:bg-slate-950"
          >
            <MapPinned className="h-4 w-4" />
            {isId ? 'Buka Lajukan Maps' : 'Open Lajukan Maps'}
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

            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 space-y-3">
                <article
                  ref={selectedPreviewRef}
                  className="min-w-0 overflow-hidden rounded-[18px] border border-slate-200/80 bg-white p-2.5 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/82 sm:rounded-[22px] sm:p-3"
                >
                  <div className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-2.5 min-[420px]:grid-cols-[128px_minmax(0,1fr)] sm:grid-cols-[minmax(0,170px)_minmax(0,1fr)] sm:gap-3 lg:grid-cols-[minmax(0,190px)_minmax(0,1fr)]">
                    <PlaceThumb
                      src={selectedPlace.ui.gallery[0] || selectedPlace.ui.coverImage}
                      alt={selectedPlace.store.name}
                      className="h-[112px] rounded-[15px] min-[420px]:h-[124px] sm:h-[150px] sm:rounded-[18px]"
                    />

                    <div className="min-w-0 self-center">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold sm:text-[11px]">
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

                      <h3 className="mt-1.5 line-clamp-2 text-[1.02rem] font-black leading-tight text-[color:var(--app-text)] sm:text-[1.35rem]">
                        <Link href={buildUmkmStorefrontPath(selectedPlace.store.slug)}>
                          {selectedPlace.store.name}
                        </Link>
                      </h3>

                      <p className="mt-1.5 inline-flex items-center gap-2 text-[12px] font-semibold text-emerald-600 sm:text-[13px]">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            selectedPlace.ui.openNow !== false
                              ? 'bg-emerald-500'
                              : 'bg-slate-300'
                          }`}
                        />
                        {getOpenLabel(selectedPlace.ui.openNow !== false, isId)}
                      </p>

                      <p className="mt-0.5 truncate text-[12px] text-[color:var(--app-text-soft)] sm:text-[13px]">
                        {selectedPlace.store.city}
                      </p>

                      <p className="mt-2 hidden text-[12px] leading-5 text-[color:var(--app-text-soft)] min-[420px]:line-clamp-2 min-[420px]:block">
                        {selectedPlace.store.description || selectedPlace.ui.addressLine}
                      </p>

                      <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                        <Link
                          href={buildUmkmStorefrontPath(selectedPlace.store.slug)}
                          className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-2.5 text-[12px] font-semibold text-white shadow-[0_16px_28px_-24px_color-mix(in_srgb,var(--app-accent)_40%,transparent)] transition hover:brightness-105 sm:px-3"
                        >
                          <Store className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {isId ? 'Profil' : 'Profile'}
                          </span>
                        </Link>
                        {selectedContactHref ? (
                          <a
                            href={selectedContactHref}
                            target={selectedContactIsExternal ? '_blank' : undefined}
                            rel={
                              selectedContactIsExternal
                                ? 'noreferrer'
                                : undefined
                            }
                            className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2.5 text-[12px] font-semibold text-[color:var(--app-accent)] transition hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_72%,white)] sm:px-3"
                          >
                            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{selectedContactLabel}</span>
                          </a>
                        ) : null}
                        <a
                          href={selectedPlace.ui.googleMapsDirectionsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 sm:px-3"
                        >
                          <Navigation className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {isId ? 'Rute' : 'Route'}
                          </span>
                        </a>
                      </div>
                    </div>
                  </div>
                </article>

                <div ref={mobileMapRef} className="lg:hidden">
                  {mobileMapOpen ? (
                    <div className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col bg-[color:var(--app-surface-strong)] dark:bg-slate-950">
                      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)] dark:border-slate-800">
                        <div>
                          <p className="text-[15px] font-black tracking-[-0.03em] text-[color:var(--app-text)]">
                            Lajukan Maps
                          </p>
                          <p className="text-[11px] text-[color:var(--app-text-soft)]">
                            {activeFilter.label} | {visibleStores.length}{' '}
                            {isId ? 'usaha aktif' : 'active businesses'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMobileMapOpen(false)}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]"
                          aria-label={isId ? 'Tutup peta' : 'Close map'}
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="min-h-0 flex-1">
                        {renderDiscoveryMap('h-full w-full', true)}
                      </div>

                      <div className="shrink-0 space-y-2 border-t border-slate-200 bg-[color:var(--app-surface-strong)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <PlaceThumb
                            src={
                              selectedPlace.ui.gallery[0] ||
                              selectedPlace.ui.coverImage
                            }
                            alt={selectedPlace.store.name}
                            className="h-12 w-12 rounded-[14px]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-black text-[color:var(--app-text)]">
                              {selectedPlace.store.name}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                              {selectedPlace.store.city ||
                                selectedPlace.ui.addressLine}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          <Link
                            href={buildUmkmStorefrontPath(selectedPlace.store.slug)}
                            className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent)] px-2 text-[11px] font-black text-white"
                          >
                            <Store className="h-3.5 w-3.5" />
                            <span className="truncate">
                              {isId ? 'Profil' : 'Profile'}
                            </span>
                          </Link>
                          {selectedContactHref ? (
                            <a
                              href={selectedContactHref}
                              target={
                                selectedContactIsExternal ? '_blank' : undefined
                              }
                              rel={
                                selectedContactIsExternal
                                  ? 'noreferrer'
                                  : undefined
                              }
                              className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-2 text-[11px] font-black text-[color:var(--app-accent)]"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span className="truncate">
                                {selectedContactLabel}
                              </span>
                            </a>
                          ) : (
                            <Link
                              href={buildUmkmStorefrontPath(selectedPlace.store.slug)}
                              className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-2 text-[11px] font-black text-[color:var(--app-accent)]"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span className="truncate">Info</span>
                            </Link>
                          )}
                          <a
                            href={selectedPlace.ui.googleMapsDirectionsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-surface-muted)] px-2 text-[11px] font-black text-[color:var(--app-text)]"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span className="truncate">
                              {isId ? 'Rute' : 'Route'}
                            </span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : null}
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
                          className="w-full min-w-0 rounded-[18px] border border-slate-200/80 bg-white p-2.5 text-left shadow-[0_14px_30px_-24px_rgba(15,23,42,0.1)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_4%,white)] sm:rounded-[24px] sm:p-4"
                        >
                          <div className="grid min-w-0 grid-cols-[92px_minmax(0,1fr)] gap-2.5 min-[380px]:grid-cols-[108px_minmax(0,1fr)] sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-4">
                            <PlaceThumb
                              src={item.ui.gallery[0] || item.ui.coverImage}
                              alt={item.store.name}
                              className="h-[92px] rounded-[16px] min-[380px]:h-[104px] sm:h-[116px] sm:rounded-[18px]"
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
                <div className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-2 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/82">
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

                  {renderDiscoveryMap('h-[440px] w-full xl:h-[500px]')}
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
