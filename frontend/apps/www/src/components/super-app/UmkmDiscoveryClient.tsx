'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  LayoutGrid,
  MapPin,
  Plus,
  Search,
  ShoppingBag,
  Utensils,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { AppViewportShell } from '@/components/common/AppViewportShell';
import { useAppBack } from '@/lib/navigation/useAppBack';
import { cn } from '@/lib/utils';
import { UmkmDiscoveryPanel } from './UmkmDiscoveryPanel';
import type { DiscoveryStore } from './UmkmDiscoveryPanel';

type UmkmDiscoveryClientProps = {
  locale: string;
  isId: boolean;
  initialQuery?: string;
  initialCity?: string;
  initialCategory?: string;
  initialStoreSlug?: string;
  initialStoreId?: string;
  initialMapOnly?: boolean;
  initialStores?: DiscoveryStore[];
  initialCount?: number;
};

type MapLaneId =
  | 'all'
  | 'food'
  | 'retail'
  | 'service'
  | 'property'
  | 'workshop';

type MapLane = {
  id: MapLaneId;
  labelId: string;
  labelEn: string;
  helperId: string;
  helperEn: string;
  keywords: string;
  icon: LucideIcon;
};

const MAP_LANES: MapLane[] = [
  {
    id: 'all',
    labelId: 'Semua',
    labelEn: 'All',
    helperId: 'Semua usaha',
    helperEn: 'All categories',
    keywords: '',
    icon: LayoutGrid,
  },
  {
    id: 'food',
    labelId: 'Kuliner',
    labelEn: 'Food',
    helperId: 'Makan & minum',
    helperEn: 'Food & drinks',
    keywords: 'makan minum kuliner',
    icon: Utensils,
  },
  {
    id: 'retail',
    labelId: 'Toko',
    labelEn: 'Shops',
    helperId: 'Belanja & grosir',
    helperEn: 'Retail & wholesale',
    keywords: 'toko retail grosir',
    icon: ShoppingBag,
  },
  {
    id: 'service',
    labelId: 'Jasa',
    labelEn: 'Services',
    helperId: 'Jasa harian',
    helperEn: 'Business services',
    keywords: 'jasa usaha operasional',
    icon: BriefcaseBusiness,
  },
  {
    id: 'property',
    labelId: 'Tempat',
    labelEn: 'Places',
    helperId: 'Ruko, kios, booth',
    helperEn: 'Shophouses & kiosks',
    keywords: 'ruko kios lokasi usaha',
    icon: Building2,
  },
  {
    id: 'workshop',
    labelId: 'Bengkel',
    labelEn: 'Workshop',
    helperId: 'Servis & perbaikan',
    helperEn: 'Service & repair',
    keywords: 'bengkel workshop servis',
    icon: Wrench,
  },
];
const DISCOVERY_STORE_LIMIT = 10;

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getLaneById(id: string | undefined): MapLane {
  return MAP_LANES.find(lane => lane.id === id) || MAP_LANES[0]!;
}

function getLaneFromTechnicalQuery(query: string): MapLane | null {
  const normalized = normalizeText(query);
  if (!normalized) return null;
  return (
    MAP_LANES.find(
      lane => lane.keywords && normalizeText(lane.keywords) === normalized,
    ) || null
  );
}

function normalizeLaneId(value: string | undefined): MapLaneId {
  const normalized = normalizeText(value || '');
  return MAP_LANES.some(lane => lane.id === normalized)
    ? (normalized as MapLaneId)
    : 'all';
}

function buildUmkmPath(query: string, city: string, category: MapLaneId) {
  const params = new URLSearchParams();
  const cleanQuery = query.trim();
  const cleanCity = city.trim();
  if (cleanQuery) params.set('q', cleanQuery);
  if (cleanCity) params.set('city', cleanCity);
  if (category !== 'all') params.set('category', category);
  return params.toString() ? `/umkm?${params.toString()}` : '/umkm';
}

export function UmkmDiscoveryClient(props: UmkmDiscoveryClientProps) {
  const {
    isId,
    initialQuery = '',
    initialCity = '',
    initialCategory = '',
    initialStoreSlug,
    initialStoreId,
    initialMapOnly = false,
    initialStores,
    initialCount,
  } = props;
  const router = useRouter();
  const handleBack = useAppBack(router, '/home');
  const { isAuthenticated } = useAuth();
  const initialTechnicalLane = getLaneFromTechnicalQuery(initialQuery);
  const initialLane = normalizeLaneId(initialCategory);
  const [query, setQuery] = useState(initialTechnicalLane ? '' : initialQuery);
  const [city, setCity] = useState(initialCity);
  const [activeLane, setActiveLane] = useState<MapLaneId>(
    initialLane !== 'all' ? initialLane : initialTechnicalLane?.id || 'all',
  );
  const [showAllLanes, setShowAllLanes] = useState(false);
  const [mapOpenSignal, setMapOpenSignal] = useState(0);

  useEffect(() => {
    const laneFromQuery = getLaneFromTechnicalQuery(initialQuery);
    setQuery(laneFromQuery ? '' : initialQuery);
    const laneFromCategory = normalizeLaneId(initialCategory);
    setActiveLane(
      laneFromCategory !== 'all'
        ? laneFromCategory
        : laneFromQuery?.id || 'all',
    );
  }, [initialCategory, initialQuery]);

  useEffect(() => {
    const laneFromQuery = getLaneFromTechnicalQuery(initialQuery);
    if (!laneFromQuery || normalizeLaneId(initialCategory) !== 'all') return;
    router.replace(buildUmkmPath('', initialCity, laneFromQuery.id));
  }, [initialCategory, initialCity, initialQuery, router]);

  useEffect(() => {
    setCity(initialCity);
  }, [initialCity]);

  const cleanedQuery = query.trim();
  const cleanedCity = city.trim();
  const activeLaneConfig = getLaneById(activeLane);
  const activeCategoryLabel = isId
    ? activeLaneConfig.labelId
    : activeLaneConfig.labelEn;
  const discoveryQuery = cleanedQuery;
  const createHref = isAuthenticated ? '/create' : '/register';
  const visibleLanes = showAllLanes
    ? MAP_LANES
    : MAP_LANES.filter(
        lane =>
          ['all', 'food', 'retail', 'service'].includes(lane.id) ||
          lane.id === activeLane,
      );
  const hiddenLaneCount = MAP_LANES.length - visibleLanes.length;

  useBodyScrollLock(true, { resetScroll: true });

  const submitSearch = useCallback(
    (nextQuery: string, nextCity: string, nextLane: MapLaneId = activeLane) => {
      router.push(buildUmkmPath(nextQuery, nextCity, nextLane));
      setMapOpenSignal(current => current + 1);
    },
    [activeLane, router],
  );

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch(cleanedQuery, cleanedCity);
  };

  const handleLanePick = (lane: MapLane) => {
    setActiveLane(lane.id);
    setShowAllLanes(false);
    submitSearch(cleanedQuery, cleanedCity, lane.id);
  };

  const handleClearCityFilter = () => {
    setCity('');
    submitSearch(cleanedQuery, '', activeLane);
  };

  return (
    <AppViewportShell
      as="main"
      className="relative w-full bg-slate-100 text-[color:var(--app-text)] dark:bg-slate-950"
      data-testid="umkm-discovery-page"
    >
      <UmkmDiscoveryPanel
        isId={isId}
        query={discoveryQuery}
        city={cleanedCity}
        category={activeLane}
        limit={DISCOVERY_STORE_LIMIT}
        title={
          activeLane === 'all'
            ? isId
              ? 'Usaha & referensi publik'
              : 'Businesses & public references'
            : isId
              ? `${activeCategoryLabel} & referensi publik`
              : `${activeCategoryLabel} & public references`
        }
        description={
          isId
            ? 'Toko terdaftar dan titik referensi dari sumber terbuka ditampilkan terpisah; referensi publik tidak memiliki klaim stok, harga, atau verifikasi.'
            : 'Registered stores and open-source reference points are kept distinct; public references do not imply stock, prices, or verification.'
        }
        selectedSlug={initialStoreSlug}
        selectedStoreIdInitial={initialStoreId}
        initialMapOnly={initialMapOnly}
        initialStores={initialStores}
        initialCount={initialCount}
        openMapSignal={mapOpenSignal}
        variant="immersive"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1400] px-3 pt-[calc(env(safe-area-inset-top)+0.65rem)] sm:px-2 lg:inset-x-auto lg:left-3 lg:w-[486px] lg:px-0 lg:pt-[calc(env(safe-area-inset-top)+0.9rem)]">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-1.5 lg:mx-0 lg:max-w-none">
          <form
            onSubmit={handleSearch}
            className="pointer-events-auto overflow-hidden rounded-full border-0 bg-white/96 outline-none ring-0 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.36)] focus-within:ring-2 focus-within:ring-[color:var(--app-accent)] dark:bg-slate-950/92"
            role="search"
            aria-label={isId ? 'Cari usaha' : 'Search businesses'}
            data-testid="umkm-discovery-search-form"
          >
            <div className="flex min-h-[44px] items-center gap-1.5 px-2 sm:min-h-[48px] sm:px-3">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 lg:hidden"
                aria-label={isId ? 'Kembali' : 'Back'}
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>

              <Search className="h-4.5 w-4.5 shrink-0 text-[color:var(--app-text-soft)]" />

              <label htmlFor="umkm-discovery-search" className="sr-only">
                {isId
                  ? 'Nama usaha, kategori, atau kota'
                  : 'Business name, category, or city'}
              </label>
              <input
                id="umkm-discovery-search"
                name="q"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={
                  isId
                    ? 'Cari usaha, produk, jasa...'
                    : 'Search food, shops, services...'
                }
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-[color:var(--app-text)] outline-none ring-0 placeholder:text-[color:var(--app-text-soft)] focus:border-0 focus:outline-none focus:ring-0"
              />

              <button
                type="submit"
                className="inline-flex min-h-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-[color:var(--app-accent)] px-3 text-[11px] font-bold text-white shadow-[0_14px_28px_-22px_color-mix(in_srgb,var(--app-accent)_46%,transparent)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 sm:min-h-[36px] sm:px-3.5"
              >
                {isId ? 'Cari' : 'Search'}
              </button>
            </div>
          </form>

          <div
            className="pointer-events-auto flex min-w-0 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={isId ? 'Pilih jenis usaha' : 'Business category filter'}
            data-testid="umkm-category-filters"
          >
            <button
              type="button"
              onClick={handleClearCityFilter}
              aria-pressed={!cleanedCity}
              className={cn(
                'inline-flex min-h-[32px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] sm:min-h-[34px]',
                cleanedCity
                  ? 'border-white/80 bg-white/92 text-slate-700 hover:text-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/86 dark:text-slate-100'
                  : 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
              )}
            >
              <MapPin className="h-3.5 w-3.5" />
              {isId ? 'Semua lokasi' : 'All locations'}
            </button>
            {cleanedCity ? (
              <button
                type="button"
                onClick={handleClearCityFilter}
                aria-label={
                  isId
                    ? `Hapus filter kota ${cleanedCity}`
                    : `Clear city filter ${cleanedCity}`
                }
                className="inline-flex min-h-[32px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] px-2.5 text-[11px] font-bold text-white shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:min-h-[34px]"
              >
                <MapPin className="h-3.5 w-3.5" />
                {cleanedCity}
                <X className="h-3 w-3" />
              </button>
            ) : null}
            {visibleLanes.map(lane => {
              const Icon = lane.icon;
              const active = activeLane === lane.id;
              return (
                <button
                  key={lane.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleLanePick(lane)}
                  className={cn(
                    'inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] sm:min-h-[34px] sm:px-3',
                    active
                      ? 'cursor-default border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] text-white'
                      : 'cursor-pointer border-white/80 bg-white/92 text-slate-700 hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/86 dark:text-slate-100',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{isId ? lane.labelId : lane.labelEn}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowAllLanes(current => !current)}
              aria-expanded={showAllLanes}
              className="inline-flex min-h-[32px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/80 bg-white/92 px-2.5 text-[11px] font-bold text-slate-700 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/86 dark:text-slate-100 sm:min-h-[34px] sm:px-3"
            >
              {showAllLanes
                ? isId
                  ? 'Ringkas'
                  : 'Less'
                : hiddenLaneCount > 0
                  ? isId
                    ? `Lainnya (${hiddenLaneCount})`
                    : `More (${hiddenLaneCount})`
                  : isId
                    ? 'Lainnya'
                    : 'More'}
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform',
                  showAllLanes && 'rotate-180',
                )}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-[calc(12.5rem+env(safe-area-inset-bottom))] right-3 z-[1240] hidden flex-col gap-2 lg:flex">
        <Link
          href={createHref}
          className="pointer-events-auto inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-[12px] font-bold text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.34)] transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          {isId ? 'Buat posting' : 'Create post'}
        </Link>
      </div>
    </AppViewportShell>
  );
}
