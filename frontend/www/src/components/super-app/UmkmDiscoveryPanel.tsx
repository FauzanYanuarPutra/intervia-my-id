'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bike,
  BusFront,
  Car,
  ChevronDown,
  ChevronUp,
  Clock3,
  Footprints,
  MapPin,
  MapPinned,
  MessageCircle,
  Navigation,
  Phone,
  Search,
  Store,
  X,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buildUmkmStorefrontPath } from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';
import {
  MapQuickControls,
  PlaceThumb,
  RatingStars,
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
  selectedStoreIdInitial?: string;
  openMapSignal?: number;
  variant?: 'section' | 'immersive';
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

const DISCOVERY_REFRESH_INTERVAL_MS = 25000;
const LIST_PAGE_SIZE = 4;

function shouldUseDesktopMapPanel() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(min-width: 1024px)').matches
  );
}

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
  selectedStoreIdInitial,
  openMapSignal = 0,
  variant = 'section',
}: UmkmDiscoveryPanelProps) {
  const [stores, setStores] = useState<DiscoveryStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
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
  const [mapInteractive, setMapInteractive] = useState(
    () => variant === 'immersive',
  );
  const [mapTheme, setMapTheme] = useState<UmkmMapTheme>('default');
  const [showRoute, setShowRoute] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [routeSummary, setRouteSummary] = useState<UmkmMapRouteSummary | null>(
    null,
  );
  const [mapFocusMode, setMapFocusMode] = useState<
    'stores' | 'viewer' | 'route' | 'selected'
  >('stores');
  const [mapFocusNonce, setMapFocusNonce] = useState(0);
  const [sheetExpanded, setSheetExpanded] = useState(false);

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
          if (selectedSlug) {
            const matchedBySlug = items.find(item => item.slug === selectedSlug);
            if (matchedBySlug) return matchedBySlug.id;
          }
          if (selectedStoreIdInitial) {
            const matchedById = items.find(item => item.id === selectedStoreIdInitial);
            if (matchedById) return matchedById.id;
          }
          return null;
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
  }, [city, isId, limit, query, selectedSlug, selectedStoreIdInitial]);

  const preparedStores = useMemo(
    () =>
      stores.map(store => ({
        store,
        ui: buildUmkmPlacePresentation(store, isId, null),
      })),
    [isId, stores],
  );

  const visibleStores = preparedStores;

  useEffect(() => {
    if (!visibleStores.length || !selectedStoreId) {
      setSelectedStoreId(null);
      return;
    }
    if (visibleStores.some(item => item.store.id === selectedStoreId)) return;
    setSelectedStoreId(null);
  }, [selectedStoreId, visibleStores]);

  const selectedPlace =
    visibleStores.find(item => item.store.id === selectedStoreId) || null;
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
  const routeModeActions = selectedPlace
    ? [
      {
        id: 'driving',
        label: isId ? 'Mobil' : 'Car',
        icon: Car,
        href: selectedPlace.ui.googleMapsDirectionsByMode.driving,
      },
      {
        id: 'two-wheeler',
        label: isId ? 'Motor' : 'Bike',
        icon: Bike,
        href: selectedPlace.ui.googleMapsDirectionsByMode['two-wheeler'],
      },
      {
        id: 'train',
        label: isId ? 'Kereta' : 'Train',
        icon: BusFront,
        href: selectedPlace.ui.googleMapsDirectionsByMode.transit,
      },
      {
        id: 'transit',
        label: isId ? 'Umum' : 'Transit',
        icon: BusFront,
        href: selectedPlace.ui.googleMapsDirectionsByMode.transit,
      },
      {
        id: 'walking',
        label: isId ? 'Jalan' : 'Walk',
        icon: Footprints,
        href: selectedPlace.ui.googleMapsDirectionsByMode.walking,
      },
    ]
    : [];

  const listedPlaces = visibleStores.filter(
    item => item.store.id !== selectedPlace?.store.id,
  );
  const paginatedListedPlaces = listedPlaces.slice(0, listPage * LIST_PAGE_SIZE);
  const canLoadMoreList = paginatedListedPlaces.length < listedPlaces.length;
  useEffect(() => {
    const targetSlug = selectedSlug?.trim();
    const targetStoreId = selectedStoreIdInitial?.trim();
    if (!targetSlug && !targetStoreId) return;
    const matchedStore = visibleStores.find(
      item =>
        (targetSlug && item.store.slug === targetSlug) ||
        (targetStoreId && item.store.id === targetStoreId),
    );
    if (!matchedStore) return;
    setSelectedStoreId(matchedStore.store.id);
    setMapFocusMode('selected');
    setMapFocusNonce(current => current + 1);
  }, [selectedSlug, selectedStoreIdInitial, visibleStores]);

  useEffect(() => {
    setListPage(1);
    setSheetExpanded(
      variant === 'immersive' ? shouldUseDesktopMapPanel() : false,
    );
  }, [city, query, variant, visibleStores.length]);

  useEffect(() => {
    if (variant !== 'immersive' || typeof window === 'undefined') return;

    const desktopPanelQuery = window.matchMedia('(min-width: 1024px)');
    const syncSheetMode = () => {
      setSheetExpanded(desktopPanelQuery.matches);
    };

    syncSheetMode();
    desktopPanelQuery.addEventListener('change', syncSheetMode);
    return () => desktopPanelQuery.removeEventListener('change', syncSheetMode);
  }, [variant]);

  const handleSelectStore = useCallback(
    (storeId: string, options?: { scrollToPreview?: boolean }) => {
      pendingScrollStoreIdRef.current = options?.scrollToPreview
        ? storeId
        : null;
      if (variant === 'immersive') {
        setSheetExpanded(true);
      }
      setShowRoute(false);
      setRouteSummary(null);
      setMapFocusMode('selected');
      setMapFocusNonce(current => current + 1);
      if (selectedStoreId === storeId) return;
      setSelectedStoreId(storeId);
    },
    [selectedStoreId, variant],
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

  const handleOpenMapPreview = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (selectedStoreId) {
      setMapFocusMode('selected');
      setMapFocusNonce(current => current + 1);
    }
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
  }, [selectedStoreId]);

  useEffect(() => {
    if (variant === 'immersive') return;
    if (!openMapSignal) return;
    handleOpenMapPreview();
  }, [handleOpenMapPreview, openMapSignal, variant]);

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
  const mapResultLabel = `${visibleStores.length} ${isId ? 'usaha aktif' : 'active businesses'
    }`;
  const routeDistanceLabel = useMemo(() => {
    if (!routeSummary?.distance_m || routeSummary.used_fallback) return null;
    return formatUmkmPlaceDistance(routeSummary.distance_m / 1000, isId);
  }, [isId, routeSummary]);
  const bumpMapFocus = useCallback(
    (mode: 'stores' | 'viewer' | 'route' | 'selected') => {
      setMapFocusMode(mode);
      setMapFocusNonce(current => current + 1);
    },
    [],
  );
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
      const mapStores = visibleStores.map(item => item.store);
      const activeSelectedStoreId = selectedPlace?.store.id || null;

      return (
        <div
          className={`relative isolate overflow-hidden ${edgeToEdge ? 'h-full rounded-none' : 'rounded-[20px]'
            }`}
        >
          <UmkmStoreMap
            stores={mapStores}
            selectedStoreId={activeSelectedStoreId}
            viewerLocation={viewerLocation}
            isId={isId}
            interactive={mapInteractive}
            theme={mapTheme}
            routeToStoreId={activeSelectedStoreId}
            showRoute={showRoute}
            onRouteResolved={setRouteSummary}
            focusMode={mapFocusMode}
            focusNonce={mapFocusNonce}
            onSelectStore={storeId =>
              handleSelectStore(storeId, { scrollToPreview: !edgeToEdge })
            }
            className={className}
          />
          <div
            className={cn(
              'pointer-events-none absolute z-[1100]',
              edgeToEdge
                ? 'right-3 top-[calc(env(safe-area-inset-top)+8.35rem)] sm:top-[calc(env(safe-area-inset-top)+7.55rem)] lg:right-4 lg:top-[calc(env(safe-area-inset-top)+7.25rem)]'
                : 'bottom-3 left-3 sm:bottom-4',
            )}
          >
            <MapQuickControls
              isId={isId}
              interactive={mapInteractive}
              locating={locating}
              locationError={locationError}
              routeEnabled={showRoute}
              distanceLabel={routeDistanceLabel}
              themeLabel={getUmkmMapThemeLabel(mapTheme, isId)}
              onCycleTheme={cycleMapTheme}
              compact={edgeToEdge}
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
                  bumpMapFocus('selected');
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

  if (variant === 'immersive') {
    const sheetTitle =
      title || (isId ? 'Usaha sekitar kamu' : 'Businesses around you');
    const sheetSubtitle =
      description ||
      (city?.trim()
        ? isId
          ? `Area ${city.trim()}`
          : `${city.trim()} area`
        : isId
          ? 'Geser peta, pilih pin, lalu chat atau lihat rute.'
          : 'Move the map, pick a pin, then chat or open route.');

    return (
      <section className="relative h-full min-h-0 overflow-hidden bg-slate-100 text-[color:var(--app-text)] dark:bg-slate-950">
        <div className="absolute inset-0">
          {renderDiscoveryMap('h-full w-full', true)}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+7.15rem)] z-[1150] flex justify-center px-3 sm:top-[calc(env(safe-area-inset-top)+6.55rem)] lg:left-[510px] lg:right-4 lg:top-[calc(env(safe-area-inset-top)+6.35rem)] lg:px-0">
          <button
            type="button"
            onClick={() => {
              setListPage(1);
              bumpMapFocus('stores');
            }}
            className="pointer-events-auto inline-flex min-h-[38px] items-center gap-2 rounded-full border border-white/80 bg-white/94 px-4 text-[12px] font-black text-slate-800 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.34)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:text-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-100"
          >
            <Search className="h-4 w-4 text-[color:var(--app-accent)]" />
            {isId ? 'Cari area ini' : 'Search this area'}
          </button>
        </div>

        {error ? (
          <div className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+15.25rem)] z-[1160] mx-auto max-w-md rounded-[22px] border border-rose-200 bg-white/94 px-4 py-3 text-[12px] font-semibold text-rose-700 shadow-[0_18px_44px_-28px_rgba(244,63,94,0.36)] backdrop-blur-xl dark:border-rose-900/60 dark:bg-slate-950/88">
            {error}
          </div>
        ) : null}

        {loading && !selectedPlace && !error ? (
          <div className="absolute left-3 right-3 top-1/2 z-[1160] mx-auto max-w-sm -translate-y-1/2 rounded-[24px] border border-white/80 bg-white/94 px-5 py-4 text-center text-[13px] font-black text-slate-700 shadow-[0_22px_52px_-34px_rgba(15,23,42,0.36)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-100">
            {isId ? 'Lagi mencari usaha sekitar...' : 'Finding nearby businesses...'}
          </div>
        ) : null}

        {!error ? (
          <div
            className={cn(
              'absolute inset-x-2 bottom-[calc(0.30rem+env(safe-area-inset-bottom))] z-[1250] mx-auto flex max-w-[760px] flex-col overflow-hidden rounded-[26px] border border-white/86 bg-white/97 p-2 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.48)] backdrop-blur-2xl transition-all duration-300 dark:border-white/10 dark:bg-slate-950/94 sm:inset-x-4 lg:inset-x-auto lg:bottom-3 lg:left-3 lg:top-[calc(env(safe-area-inset-top)+6.85rem)] lg:mx-0 lg:w-[486px] lg:max-w-none lg:overflow-y-auto lg:rounded-[24px] lg:p-3',
              sheetExpanded
                ? 'max-h-[82dvh] lg:max-h-[calc(100dvh-1.5rem)]'
                : 'max-h-[246px] min-h-[214px] lg:max-h-[calc(100dvh-1.5rem)] lg:min-h-0',
            )}
          >
            <button
              type="button"
              onClick={() => setSheetExpanded(current => !current)}
              className="mx-auto mb-1 flex h-4 w-16 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100 lg:hidden"
              aria-expanded={sheetExpanded}
              aria-label={
                sheetExpanded
                  ? isId
                    ? 'Kecilkan daftar'
                    : 'Collapse list'
                  : isId
                    ? 'Perbesar daftar'
                    : 'Expand list'
              }
            >
              <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            </button>

            <div className="flex min-w-0 items-center justify-between gap-2 px-1 pb-1">
              <div className="min-w-0">
                <p className="line-clamp-1 text-[1rem] font-black leading-tight tracking-[-0.035em] text-[color:var(--app-text)]">
                  {sheetTitle}
                </p>
                <p className="mt-0.5 hidden line-clamp-1 text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)] sm:block">
                  {sheetSubtitle}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="inline-flex max-w-[92px] items-center justify-center truncate rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black leading-none text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200 sm:max-w-none">
                  {totalLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setSheetExpanded(current => !current)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] dark:bg-slate-800 dark:text-slate-100 lg:hidden"
                  aria-expanded={sheetExpanded}
                  aria-label={
                    sheetExpanded
                      ? isId
                        ? 'Kecilkan'
                        : 'Collapse'
                      : isId
                        ? 'Perbesar'
                        : 'Expand'
                  }
                >
                  {sheetExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {selectedPlace ? (
              <div className="contents">
                <article className="rounded-[22px] border border-emerald-900/10 bg-[linear-gradient(135deg,#ffffff,#f7fef9)] p-2.5 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.3)] ring-1 ring-white/76 dark:border-slate-800 dark:bg-[linear-gradient(135deg,#0f172a,#061b16)] dark:ring-white/10">
                  <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[78px_minmax(0,1fr)]">
                    <div className="relative">
                      <PlaceThumb
                        src={selectedPlace.ui.gallery[0] || selectedPlace.ui.coverImage}
                        alt={selectedPlace.store.name}
                        className="h-[72px] rounded-[18px] sm:h-[78px]"
                      />
                      <span
                        className={cn(
                          'absolute -bottom-1 left-1/2 inline-flex -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-black shadow-sm backdrop-blur-md',
                          selectedPlace.ui.openNow !== false
                            ? 'bg-emerald-500/94 text-white'
                            : 'bg-slate-900/76 text-white',
                        )}
                      >
                        {getOpenLabel(selectedPlace.ui.openNow !== false, isId)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-black text-[color:var(--app-text-soft)]">
                        <span className="truncate rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                          {selectedPlace.ui.kindLabel}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-[color:var(--app-accent)]" />
                          <span className="truncate">
                            {selectedPlace.store.city || selectedPlace.ui.addressLine}
                          </span>
                        </span>
                      </div>
                      <h3 className="mt-1 line-clamp-2 text-[1.02rem] font-black leading-tight tracking-[-0.035em] text-[color:var(--app-text)]">
                        {selectedPlace.store.name}
                      </h3>
                      {selectedPlace.ui.ratingNumber > 0 ? (
                        <RatingStars
                          rating={selectedPlace.ui.ratingNumber}
                          countLabel={selectedPlace.ui.reviewCountLabel}
                          isId={isId}
                          compact
                          showScore
                          className="mt-1"
                        />
                      ) : (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                          <Store className="h-3 w-3" />
                          {isId ? 'Baru di peta' : 'New on map'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-[1fr_1fr_40px] gap-1.5">
                    <Link
                      href={buildUmkmStorefrontPath(selectedPlace.store.slug)}
                      className="inline-flex min-h-[38px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-3 text-[11px] font-black text-white shadow-[0_12px_24px_-20px_color-mix(in_srgb,var(--app-accent)_42%,transparent)]"
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
                        rel={selectedContactIsExternal ? 'noreferrer' : undefined}
                        className="inline-flex min-h-[38px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-black text-[color:var(--app-accent)]"
                      >
                        <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{selectedContactLabel}</span>
                      </a>
                    ) : (
                      <Link
                        href={buildUmkmStorefrontPath(selectedPlace.store.slug)}
                        className="inline-flex min-h-[38px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-black text-[color:var(--app-accent)]"
                      >
                        <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Info</span>
                      </Link>
                    )}
                    <a
                      href={selectedPlace.ui.googleMapsDirectionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[38px] min-w-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] dark:bg-slate-800 dark:text-slate-100"
                      aria-label={isId ? 'Buka rute' : 'Open route'}
                    >
                      <Navigation className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>

                  {sheetExpanded ? (
                    <div className="mt-2.5 space-y-1.5 border-t border-slate-200/72 pt-2.5 dark:border-slate-800">
                      <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <span className="inline-flex min-h-[27px] shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                          <Store className="h-3.5 w-3.5" />
                          {isId ? 'Belanja di toko' : 'In-store'}
                        </span>
                        {selectedPlace.ui.serviceBadges.slice(0, 3).map(badge => (
                          <span
                            key={badge}
                            className="inline-flex min-h-[27px] shrink-0 items-center rounded-full bg-slate-100 px-2.5 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>

                      <div className="grid gap-1.5 text-[12px] font-semibold leading-5 text-[color:var(--app-text)]">
                        <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-[15px] bg-slate-50 px-2.5 py-2 dark:bg-slate-900/80">
                          <MapPin className="mt-0.5 h-4 w-4 text-[color:var(--app-accent)]" />
                          <span className="line-clamp-2">
                            {selectedPlace.ui.addressLine ||
                              selectedPlace.store.city ||
                              (isId ? 'Alamat belum lengkap' : 'Address not completed yet')}
                          </span>
                        </div>
                        <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-[15px] bg-slate-50 px-2.5 py-2 dark:bg-slate-900/80">
                          <Clock3 className="mt-0.5 h-4 w-4 text-[color:var(--app-accent)]" />
                          <span>
                            <span
                              className={
                                selectedPlace.ui.openNow !== false
                                  ? 'font-black text-emerald-700 dark:text-emerald-200'
                                  : 'font-black text-rose-600 dark:text-rose-300'
                              }
                            >
                              {getOpenLabel(selectedPlace.ui.openNow !== false, isId)}
                            </span>
                            <span className="text-[color:var(--app-text-soft)]">
                              {' '}
                              · {isId ? 'Chat dulu untuk memastikan jam layanan.' : 'Chat first to confirm service hours.'}
                            </span>
                          </span>
                        </div>
                        {selectedPlace.store.phone ? (
                          <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-[15px] bg-slate-50 px-2.5 py-2 dark:bg-slate-900/80">
                            <Phone className="mt-0.5 h-4 w-4 text-[color:var(--app-accent)]" />
                            <span className="truncate">{selectedPlace.store.phone}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>

                {sheetExpanded ? (
                  <div className="mt-2 flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <span className="shrink-0 pl-1 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
                      {isId ? 'Rute' : 'Route'}
                    </span>
                    {routeModeActions.map(action => {
                      const Icon = action.icon;
                      return (
                        <a
                          key={action.id}
                          href={action.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[30px] shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-[10.5px] font-black text-slate-700 transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] dark:bg-slate-800 dark:text-slate-100"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          {action.label}
                        </a>
                      );
                    })}
                  </div>
                ) : null}

              </div>
            ) : (
              <div className="min-h-0 space-y-2">
                <div className="rounded-[20px] border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff,#f8fafc)] px-3.5 py-3 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.2)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,#0f172a,#020617)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                        {isId ? 'Pilih dari daftar' : 'Pick from results'}
                      </p>
                      <p className="mt-1 text-[15px] font-black leading-tight text-[color:var(--app-text)]">
                        {sheetTitle}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                        {sheetSubtitle}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                      {totalLabel}
                    </span>
                  </div>
                </div>

                {loading ? (
                  <div className="rounded-[18px] border border-slate-200/80 bg-white px-4 py-6 text-center text-[12px] font-semibold text-[color:var(--app-text-soft)] dark:border-slate-800 dark:bg-slate-900/84">
                    {isId
                      ? 'Lagi memuat daftar usaha...'
                      : 'Loading business results...'}
                  </div>
                ) : paginatedListedPlaces.length > 0 ? (
                  <div className="grid min-w-0 gap-2 overflow-y-auto pr-0.5 lg:max-h-[calc(100dvh-15rem)]">
                    {paginatedListedPlaces.map(item => {
                      const isOpen = item.ui.openNow !== false;
                      return (
                        <button
                          key={item.store.id}
                          type="button"
                          onClick={() => handleSelectStore(item.store.id)}
                          className="group grid min-w-0 grid-cols-[74px_minmax(0,1fr)_auto] items-center gap-2 rounded-[18px] border border-slate-200/80 bg-white p-2 text-left shadow-[0_12px_26px_-24px_rgba(15,23,42,0.16)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_10%,white)] dark:border-slate-800 dark:bg-slate-900/82"
                        >
                          <PlaceThumb
                            src={item.ui.gallery[0] || item.ui.coverImage}
                            alt={item.store.name}
                            className="h-[74px] rounded-[14px]"
                          />
                          <span className="min-w-0">
                            <span className="line-clamp-2 text-[13px] font-black leading-tight text-[color:var(--app-text)]">
                              {item.store.name}
                            </span>
                            <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] font-semibold text-[color:var(--app-text-soft)]">
                              {item.ui.ratingNumber > 0 ? (
                                <RatingStars
                                  rating={item.ui.ratingNumber}
                                  countLabel={item.ui.reviewCountLabel}
                                  isId={isId}
                                  compact
                                />
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                                  {isId ? 'Baru' : 'New'}
                                </span>
                              )}
                              <span>{item.ui.kindLabel}</span>
                            </span>
                            <span
                              className={cn(
                                'mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold',
                                isOpen ? 'text-emerald-600' : 'text-slate-500',
                              )}
                            >
                              <span
                                className={cn(
                                  'h-2 w-2 rounded-full',
                                  isOpen ? 'bg-emerald-500' : 'bg-slate-300',
                                )}
                              />
                              {getOpenLabel(isOpen, isId)}
                            </span>
                            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-[color:var(--app-text-soft)]">
                              <MapPin className="h-3 w-3 shrink-0 text-[color:var(--app-accent)]" />
                              <span className="truncate">
                                {item.store.city || item.ui.addressLine || '-'}
                              </span>
                            </span>
                          </span>
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-hover:bg-[color:var(--app-accent)] group-hover:text-white dark:bg-slate-800 dark:text-slate-200">
                            <ChevronDown className="-rotate-90 h-4 w-4" />
                          </span>
                        </button>
                      );
                    })}

                    {canLoadMoreList ? (
                      <button
                        type="button"
                        onClick={() => setListPage(current => current + 1)}
                        className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {isId ? 'Muat lagi' : 'Load more'}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-slate-200/80 bg-white px-4 py-6 text-center text-[12px] font-semibold text-[color:var(--app-text-soft)] dark:border-slate-800 dark:bg-slate-900/84">
                    {isId
                      ? 'Belum ada usaha yang cocok. Coba ubah kata kunci atau area.'
                      : 'No matching businesses yet. Try another keyword or area.'}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}


      </section>
    );
  }

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
                (isId ? 'Pilih cepat, buka cepat.' : 'Pick fast, open fast.')}
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] shadow-[0_12px_26px_-22px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950">
            {totalLabel}
          </span>
        </div>

        <div className="flex min-w-0 justify-start lg:justify-end">
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
            <div className="grid min-w-0 gap-3 lg:grid-cols-1 lg:gap-4">
              <div className="min-w-0 space-y-3">
                <article
                  ref={selectedPreviewRef}
                  className="min-w-0 overflow-hidden rounded-[18px] border border-slate-200/80 bg-white p-2.5 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/82 sm:rounded-[22px] sm:p-3"
                >
                  <div className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-2.5 min-[420px]:grid-cols-[128px_minmax(0,1fr)] sm:grid-cols-[minmax(0,170px)_minmax(0,1fr)] sm:gap-3 lg:grid-cols-[minmax(0,190px)_minmax(0,1fr)]">
                    <PlaceThumb
                      src={
                        selectedPlace.ui.gallery[0] ||
                        selectedPlace.ui.coverImage
                      }
                      alt={selectedPlace.store.name}
                      className="h-[112px] rounded-[15px] min-[420px]:h-[124px] sm:h-[150px] sm:rounded-[18px]"
                    />

                    <div className="min-w-0 self-center">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold sm:text-[11px]">
                        <RatingStars
                          rating={selectedPlace.ui.ratingNumber}
                          countLabel={selectedPlace.ui.reviewCountLabel}
                          isId={isId}
                          compact
                        />
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
                        <Link
                          href={buildUmkmStorefrontPath(
                            selectedPlace.store.slug,
                          )}
                        >
                          {selectedPlace.store.name}
                        </Link>
                      </h3>

                      <p className="mt-1.5 inline-flex items-center gap-2 text-[12px] font-semibold text-emerald-600 sm:text-[13px]">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${selectedPlace.ui.openNow !== false
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
                        {selectedPlace.store.description ||
                          selectedPlace.ui.addressLine}
                      </p>

                      <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                        <Link
                          href={buildUmkmStorefrontPath(
                            selectedPlace.store.slug,
                          )}
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
                            target={
                              selectedContactIsExternal ? '_blank' : undefined
                            }
                            rel={
                              selectedContactIsExternal
                                ? 'noreferrer'
                                : undefined
                            }
                            className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2.5 text-[12px] font-semibold text-[color:var(--app-accent)] transition hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_72%,white)] sm:px-3"
                          >
                            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {selectedContactLabel}
                            </span>
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
                            {mapResultLabel}
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
                            href={buildUmkmStorefrontPath(
                              selectedPlace.store.slug,
                            )}
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
                              href={buildUmkmStorefrontPath(
                                selectedPlace.store.slug,
                              )}
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
                  ) : (
                    <div className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-white p-2 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/82">
                      <div className="flex min-w-0 items-center justify-between gap-3 px-2 pb-2 pt-1">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-[color:var(--app-text)]">
                            Lajukan Maps
                          </p>
                          <p className="truncate text-[11px] text-[color:var(--app-text-soft)]">
                            {mapResultLabel}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMobileMapOpen(true)}
                          className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--app-accent)] px-3 text-[11px] font-black text-white"
                        >
                          <MapPinned className="h-3.5 w-3.5" />
                          {isId ? 'Penuh' : 'Full'}
                        </button>
                      </div>
                      {renderDiscoveryMap('h-[320px] w-full sm:h-[360px]')}
                    </div>
                  )}
                </div>

                {paginatedListedPlaces.length > 0 ? (
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
                          className="w-full min-w-0 rounded-[16px] border border-slate-200/80 bg-white p-2 text-left shadow-[0_12px_26px_-24px_rgba(15,23,42,0.1)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_4%,white)] sm:rounded-[18px]"
                        >
                          <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2 sm:grid-cols-[82px_minmax(0,1fr)] xl:grid-cols-[88px_minmax(0,1fr)]">
                            <PlaceThumb
                              src={item.ui.gallery[0] || item.ui.coverImage}
                              alt={item.store.name}
                              className="h-[72px] rounded-[14px] sm:h-[82px] xl:h-[88px]"
                            />

                            <div className="min-w-0 self-center">
                              <h4 className="line-clamp-2 text-[13px] font-black leading-tight text-[color:var(--app-text)] sm:text-[14px]">
                                {item.store.name}
                              </h4>

                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] font-semibold">
                                <RatingStars
                                  rating={item.ui.ratingNumber}
                                  countLabel={item.ui.reviewCountLabel}
                                  isId={isId}
                                  compact
                                />
                                <span className="text-[color:var(--app-text-soft)]">
                                  {item.ui.kindLabel}
                                </span>
                              </div>

                              <p
                                className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold ${isOpen ? 'text-emerald-600' : 'text-slate-500'
                                  }`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-slate-300'
                                    }`}
                                />
                                {getOpenLabel(isOpen, isId)}
                              </p>

                              <p className="mt-0.5 truncate text-[11px] text-[color:var(--app-text-soft)]">
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
                      className="inline-flex min-h-[34px] items-center rounded-full border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
                    >
                      {isId ? 'Muat lagi' : 'Load more'}
                    </button>
                  </div>
                ) : null}
              </div>

              <aside
                ref={desktopMapRef}
                className="hidden lg:order-first lg:block"
              >
                <div className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-2 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/82">
                  <div className="flex items-center justify-between px-3 pb-2 pt-1">
                    <div>
                      <p className="text-[13px] font-black text-[color:var(--app-text)]">
                        {isId ? 'Peta usaha' : 'Business map'}
                      </p>
                      <p className="text-[11px] text-[color:var(--app-text-soft)]">
                        {mapResultLabel}
                      </p>
                    </div>
                  </div>

                  {renderDiscoveryMap(
                    'h-[min(560px,calc(100svh-180px))] min-h-[430px] w-full',
                  )}
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
