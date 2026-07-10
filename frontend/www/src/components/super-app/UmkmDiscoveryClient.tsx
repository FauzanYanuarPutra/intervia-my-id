'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Mic,
  Navigation,
  Search,
  ShoppingBag,
  Store,
  Utensils,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAppBack } from '@/lib/navigation/useAppBack';
import { buildUsahaPath } from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';
import { UmkmDiscoveryPanel } from './UmkmDiscoveryPanel';

type UmkmDiscoveryClientProps = {
  locale: string;
  isId: boolean;
  initialQuery?: string;
  initialCity?: string;
  initialCategory?: string;
  initialStoreSlug?: string;
  initialStoreId?: string;
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
    helperId: 'Semua kategori',
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
    helperId: 'Retail & grosir',
    helperEn: 'Retail & wholesale',
    keywords: 'toko retail grosir',
    icon: ShoppingBag,
  },
  {
    id: 'service',
    labelId: 'Jasa',
    labelEn: 'Services',
    helperId: 'Jasa usaha',
    helperEn: 'Business services',
    keywords: 'jasa usaha operasional',
    icon: BriefcaseBusiness,
  },
  {
    id: 'property',
    labelId: 'Tempat',
    labelEn: 'Places',
    helperId: 'Ruko & kios',
    helperEn: 'Shophouses & kiosks',
    keywords: 'ruko kios lokasi usaha',
    icon: Building2,
  },
  {
    id: 'workshop',
    labelId: 'Bengkel',
    labelEn: 'Workshop',
    helperId: 'Servis & repair',
    helperEn: 'Service & repair',
    keywords: 'bengkel workshop servis',
    icon: Wrench,
  },
];

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
  const discoveryQuery = [cleanedQuery, activeLaneConfig.keywords]
    .map(item => item.trim())
    .filter(Boolean)
    .join(' ');
  const manageBusinessHref = isAuthenticated
    ? buildUsahaPath('home')
    : '/login';
  const requestHref = isAuthenticated ? '/create/butuh' : '/login';

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
    submitSearch(cleanedQuery, cleanedCity, lane.id);
  };

  const handleUseCurrentLocation = () => {
    setCity('');
    submitSearch(cleanedQuery, '', activeLane);
  };

  return (
    <main className="relative h-[var(--app-viewport-height)] min-h-[var(--app-viewport-height)] w-full overflow-hidden bg-slate-100 text-[color:var(--app-text)] dark:bg-slate-950">
      <UmkmDiscoveryPanel
        isId={isId}
        query={discoveryQuery}
        city={cleanedCity}
        limit={240}
        title={
          activeLane === 'all'
            ? isId
              ? 'Usaha sekitar'
              : 'Local vibe'
            : isId
              ? activeCategoryLabel
              : activeCategoryLabel
        }
        description={
          isId
            ? 'Pilih pin, chat, atau buka rute.'
            : 'Pick a pin, scan the summary, then chat or open route.'
        }
        selectedSlug={initialStoreSlug}
        selectedStoreIdInitial={initialStoreId}
        openMapSignal={mapOpenSignal}
        variant="immersive"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1400] px-3 pt-[calc(env(safe-area-inset-top)+0.65rem)] sm:px-4 lg:inset-x-auto lg:left-3 lg:w-[486px] lg:px-0 lg:pt-[calc(env(safe-area-inset-top)+0.9rem)]">
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-1.5 lg:mx-0 lg:max-w-none">
          <form
            onSubmit={handleSearch}
            className="pointer-events-auto overflow-hidden rounded-full bg-white/96 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.36)] ring-1 ring-slate-900/5  dark:bg-slate-950/92 dark:ring-white/10"
          >
            <div
              className="flex min-h-[44px] items-center gap-1.5 px-2 !border-0 !outline-none !ring-0 !shadow-none focus:!border-0 focus:!outline-none focus:!ring-0 focus:!shadow-none sm:min-h-[48px] sm:gap-2 sm:px-3"
              style={{
                borderColor: 'transparent',
                boxShadow: 'none',
              }}
            >
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 lg:hidden"
                aria-label={isId ? 'Kembali' : 'Back'}
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] text-white shadow-[0_14px_28px_-22px_color-mix(in_srgb,var(--app-accent)_46%,transparent)] sm:inline-flex">
                <MapPin className="h-5 w-5" />
              </span>
              <Search className="h-4.5 w-4.5 shrink-0 text-[color:var(--app-text-soft)]" />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={
                  isId
                    ? 'Search here: usaha, produk, jasa...'
                    : 'Search here: business, product, service...'
                }
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)] sm:text-[15px]"
              />
              <button
                type="button"
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-slate-100 hover:text-[color:var(--app-accent)] sm:inline-flex dark:hover:bg-slate-800"
                aria-label={isId ? 'Input suara' : 'Voice input'}
              >
                <Mic className="h-4.5 w-4.5" />
              </button>
              <button
                type="submit"
                className="inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-3 text-[11px] font-bold text-white shadow-[0_14px_28px_-22px_color-mix(in_srgb,var(--app-accent)_46%,transparent)] transition hover:brightness-105 sm:min-h-[36px] sm:px-3.5"
              >
                {isId ? 'Cari' : 'Search'}
              </button>
            </div>
          </form>

          <div
            className="pointer-events-auto flex min-w-0 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={
              isId ? 'Filter kategori usaha' : 'Business category filter'
            }
          >
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className={cn(
                'inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)]  transition hover:-translate-y-0.5 sm:min-h-[34px]',
                cleanedCity
                  ? 'border-white/80 bg-white/92 text-slate-700 hover:text-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/86 dark:text-slate-100'
                  : 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
              )}
            >
              <Navigation className="h-3.5 w-3.5" />
              {isId ? 'Lokasi saya' : 'My location'}
            </button>
            {cleanedCity ? (
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] px-2.5 text-[11px] font-bold text-white shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)]  transition hover:-translate-y-0.5 sm:min-h-[34px]"
              >
                <MapPin className="h-3.5 w-3.5" />
                {cleanedCity}
              </button>
            ) : null}
            {MAP_LANES.map(lane => {
              const Icon = lane.icon;
              const active = activeLane === lane.id;
              return (
                <button
                  key={lane.id}
                  type="button"
                  onClick={() => handleLanePick(lane)}
                  className={cn(
                    'inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)]  transition hover:-translate-y-0.5 sm:min-h-[34px] sm:px-3',
                    active
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] text-white'
                      : 'border-white/80 bg-white/92 text-slate-700 hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/86 dark:text-slate-100',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{isId ? lane.labelId : lane.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-[calc(12.5rem+env(safe-area-inset-bottom))] right-3 z-[1240] hidden flex-col gap-2 lg:flex">
        <Link
          href={manageBusinessHref}
          className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/80 bg-white/94 px-4 text-[12px] font-bold text-slate-800 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.34)]  transition hover:-translate-y-0.5 hover:text-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-100"
        >
          <Store className="h-4 w-4 text-[color:var(--app-accent)]" />
          {isId ? 'Daftarkan usaha' : 'List business'}
        </Link>
        <Link
          href={requestHref}
          className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/80 bg-white/94 px-4 text-[12px] font-bold text-slate-800 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.34)]  transition hover:-translate-y-0.5 hover:text-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-100"
        >
          <MessageCircle className="h-4 w-4 text-[color:var(--app-accent)]" />
          {isId ? 'Buat permintaan' : 'Create request'}
        </Link>
      </div>
    </main>
  );
}
