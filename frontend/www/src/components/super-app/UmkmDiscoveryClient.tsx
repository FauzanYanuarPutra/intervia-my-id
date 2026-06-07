'use client';

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  LayoutGrid,
  MapPinned,
  MapPin,
  MessageCircle,
  Navigation,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  TrendingUp,
  Utensils,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  formatLajukanCountLabel,
  type LajukanSummary,
} from '@/lib/lajukan-marketplace';
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
};

type LajukanSummaryResponse = {
  data?: LajukanSummary;
  error?: string;
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

const AREA_CHIPS = ['Jakarta', 'Bandung', 'Surabaya', 'Makassar', 'Denpasar'];

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
  } = props;
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const resultsRef = useRef<HTMLElement | null>(null);
  const initialTechnicalLane = getLaneFromTechnicalQuery(initialQuery);
  const initialLane = normalizeLaneId(initialCategory);
  const [query, setQuery] = useState(initialTechnicalLane ? '' : initialQuery);
  const [city, setCity] = useState(initialCity);
  const [activeLane, setActiveLane] = useState<MapLaneId>(
    initialLane !== 'all' ? initialLane : initialTechnicalLane?.id || 'all',
  );
  const [summary, setSummary] = useState<LajukanSummary | null>(null);
  const [mapOpenSignal, setMapOpenSignal] = useState(0);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      try {
        const response = await fetch('/api/lajukan/summary', {
          cache: 'no-store',
          credentials: 'include',
        });
        const payload = (await response
          .json()
          .catch(() => ({}))) as LajukanSummaryResponse;

        if (!response.ok || !payload.data || !active) return;
        setSummary(payload.data);
      } catch {
        if (!active) return;
      }
    };

    void loadSummary();
    return () => {
      active = false;
    };
  }, []);

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

  const heroMetrics = useMemo(
    () => [
      {
        id: 'stores',
        label: isId ? 'Usaha aktif' : 'Active businesses',
        value: formatLajukanCountLabel(summary?.stores.total),
        icon: Store,
      },
      {
        id: 'verified',
        label: isId ? 'Terverifikasi' : 'Verified',
        value: formatLajukanCountLabel(summary?.stores.verified),
        icon: ShieldCheck,
      },
      {
        id: 'cities',
        label: isId ? 'Kota' : 'Cities',
        value: formatLajukanCountLabel(summary?.stores.cities),
        icon: TrendingUp,
      },
    ],
    [isId, summary],
  );

  const scrollToResults = useCallback(() => {
    resultsRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  const submitSearch = useCallback(
    (nextQuery: string, nextCity: string, nextLane: MapLaneId = activeLane) => {
      router.push(buildUmkmPath(nextQuery, nextCity, nextLane));
      window.requestAnimationFrame(scrollToResults);
    },
    [activeLane, router, scrollToResults],
  );

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch(cleanedQuery, cleanedCity);
  };

  const handleLanePick = (lane: MapLane) => {
    setActiveLane(lane.id);
    submitSearch(cleanedQuery, cleanedCity, lane.id);
  };

  const handleAreaPick = (area: string) => {
    setCity(area);
    submitSearch(cleanedQuery, area, activeLane);
  };

  const openLajukanMaps = () => {
    setMapOpenSignal(current => current + 1);
    scrollToResults();
  };

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[radial-gradient(circle_at_top,#eef9f1_0%,#f8fbff_34%,#f8fafc_100%)] text-[color:var(--app-text)] dark:bg-[radial-gradient(circle_at_top,#052e1d_0%,#07111d_38%,#020617_100%)]">
      <div className="lg:hidden">
        <Header />
      </div>
      <div
        aria-hidden="true"
        className="h-[calc(3.45rem+env(safe-area-inset-top))] sm:h-[calc(3.9rem+env(safe-area-inset-top))] lg:hidden"
      />

      <main className="mx-auto flex w-full max-w-[1760px] flex-col gap-3 px-1 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 lg:gap-4 lg:px-6 lg:pb-8">
        <section className="overflow-hidden rounded-[24px] border border-white/70 bg-[color:color-mix(in_srgb,var(--app-surface-strong)_92%,transparent)] shadow-[0_22px_58px_-42px_rgba(15,23,42,0.26)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/78">
          <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-stretch lg:p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-[30px] items-center gap-2 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-black text-[color:var(--app-accent)]">
                  <MapPinned className="h-4 w-4" />
                  Lajukan Maps
                </span>
                <span className="inline-flex min-h-[30px] items-center rounded-full border border-[color:var(--app-border)] bg-white/80 px-3 text-[11px] font-bold text-[color:var(--app-text-soft)] dark:bg-slate-950/72">
                  {isId ? 'Filter: ' : 'Filter: '}
                  <span className="ml-1 text-[color:var(--app-text)]">
                    {activeCategoryLabel}
                  </span>
                </span>
              </div>

              <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.54fr)] xl:items-end">
                <div className="min-w-0">
                  <h1 className="max-w-[19ch] text-[1.72rem] font-black leading-[1.02] tracking-[-0.055em] text-[color:var(--app-text)] sm:text-[2.35rem] lg:text-[2.6rem]">
                    {isId
                      ? 'Cari toko dan usaha sekitar lewat peta.'
                      : 'Find nearby stores and businesses on the map.'}
                  </h1>
                  <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[color:var(--app-text-soft)] sm:text-sm">
                    {isId
                      ? 'Pilih pin, cek rating, foto, jam buka, profil usaha, lalu langsung chat atau buka rute.'
                      : 'Pick a pin, check rating, photos, opening hours, profile, then chat or open route.'}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {heroMetrics.map(metric => {
                    const Icon = metric.icon;
                    return (
                      <div
                        key={metric.id}
                        className="min-w-0 rounded-[17px] border border-[color:var(--app-border)] bg-white/82 p-2.5 dark:bg-slate-950/72"
                      >
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[13px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <p className="mt-2 truncate text-[1rem] font-black tracking-[-0.04em] text-[color:var(--app-text)]">
                          {metric.value}
                        </p>
                        <p className="truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                          {metric.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <form
                onSubmit={handleSearch}
                className="mt-3 grid min-w-0 gap-1.5 rounded-[16px] border border-[color:var(--app-border)] bg-white/84 p-1.5 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.18)] dark:bg-slate-950/76 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
              >
                <label className="ui-field-shell flex min-h-[40px] items-center gap-2 rounded-[12px] border border-slate-300 bg-white px-2.5 py-1.5 transition focus-within:border-[color:var(--app-accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--app-accent)_14%,transparent)] dark:border-slate-700 dark:bg-slate-950">
                  <Search className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
                  <input
                    type="search"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={
                      isId
                        ? 'Cari nama usaha, produk, atau jasa...'
                        : 'Search business, product, or service...'
                    }
                    className="w-full min-w-0 border-0 bg-transparent p-0 text-[13px] font-semibold text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                  />
                </label>
                <label className="ui-field-shell flex min-h-[40px] items-center gap-2 rounded-[12px] border border-slate-300 bg-white px-2.5 py-1.5 transition focus-within:border-[color:var(--app-accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--app-accent)_14%,transparent)] dark:border-slate-700 dark:bg-slate-950">
                  <MapPin className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
                  <input
                    value={city}
                    onChange={event => setCity(event.target.value)}
                    placeholder={isId ? 'Kota / area' : 'City / area'}
                    className="w-full min-w-0 border-0 bg-transparent p-0 text-[13px] font-semibold text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-3 text-[12px] font-black text-white shadow-[0_14px_28px_-22px_color-mix(in_srgb,var(--app-accent)_46%,transparent)] transition hover:brightness-105"
                >
                  {isId ? 'Cari' : 'Search'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <div
                className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label={
                  isId ? 'Filter kategori usaha' : 'Business category filter'
                }
              >
                <span className="inline-flex min-h-[38px] shrink-0 items-center rounded-full px-1 text-[11px] font-black uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                  {isId ? 'Kategori' : 'Category'}
                </span>
                {MAP_LANES.map(lane => {
                  const Icon = lane.icon;
                  const active = activeLane === lane.id;
                  return (
                    <button
                      key={lane.id}
                      type="button"
                      onClick={() => handleLanePick(lane)}
                      className={cn(
                        'inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-full border px-3 text-[12px] font-black transition',
                        active
                          ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                          : 'border-[color:var(--app-border)] bg-white/84 text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)] dark:bg-slate-950/72',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {isId ? lane.labelId : lane.labelEn}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {isId ? 'Area cepat:' : 'Quick areas:'}
                </span>
                {AREA_CHIPS.map(area => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => handleAreaPick(area)}
                    className={cn(
                      'inline-flex min-h-[30px] items-center rounded-full px-2.5 text-[11px] font-bold transition',
                      normalizeText(cleanedCity) === normalizeText(area)
                        ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                        : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]',
                    )}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <aside className="grid gap-2.5 rounded-[22px] bg-[color:var(--app-surface-muted)] p-2.5 dark:bg-slate-900/70">
              <button
                type="button"
                onClick={openLajukanMaps}
                className="group min-w-0 rounded-[18px] border border-[color:var(--app-accent-border)] bg-white p-3 text-left shadow-[0_18px_38px_-30px_rgba(15,23,42,0.24)] transition hover:-translate-y-0.5 hover:bg-[color:var(--app-accent-soft)] dark:bg-slate-950/80"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[15px] bg-[color:var(--app-accent)] text-white">
                  <MapPinned className="h-5 w-5" />
                </span>
                <p className="mt-3 text-[1rem] font-black tracking-[-0.035em] text-[color:var(--app-text)]">
                  {isId ? 'Buka peta penuh' : 'Open full map'}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Cocok buat lihat usaha paling dekat dan bandingkan lokasi.'
                    : 'Useful for nearby discovery and location comparison.'}
                </p>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={manageBusinessHref}
                  className="min-w-0 rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 transition hover:border-[color:var(--app-accent-border)] dark:bg-slate-950/80"
                >
                  <Store className="h-5 w-5 text-[color:var(--app-accent)]" />
                  <p className="mt-2 line-clamp-2 text-[13px] font-black text-[color:var(--app-text)]">
                    {isId ? 'Daftarkan usaha' : 'List business'}
                  </p>
                </Link>
                <Link
                  href={requestHref}
                  className="min-w-0 rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 transition hover:border-[color:var(--app-accent-border)] dark:bg-slate-950/80"
                >
                  <MessageCircle className="h-5 w-5 text-[color:var(--app-accent)]" />
                  <p className="mt-2 line-clamp-2 text-[13px] font-black text-[color:var(--app-text)]">
                    {isId ? 'Buat permintaan' : 'Create request'}
                  </p>
                </Link>
              </div>

              <div className="rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 dark:bg-slate-950/80">
                <p className="text-[12px] font-black text-[color:var(--app-text)]">
                  {isId ? 'Alur paling cepat' : 'Fastest flow'}
                </p>
                <div className="mt-2 grid gap-2 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  <span className="inline-flex items-center gap-2">
                    <MapPinned className="h-4 w-4 text-[color:var(--app-accent)]" />
                    {isId ? 'Pilih pin di peta' : 'Pick a map pin'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Store className="h-4 w-4 text-[color:var(--app-accent)]" />
                    {isId ? 'Buka profil usaha' : 'Open business profile'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-[color:var(--app-accent)]" />
                    {isId ? 'Chat atau rute' : 'Chat or route'}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section
          ref={resultsRef}
          id="umkm-results"
          className="min-w-0 rounded-[24px] border border-white/70 bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] p-2.5 shadow-[0_22px_58px_-42px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 sm:p-3 lg:p-4"
        >
          <UmkmDiscoveryPanel
            isId={isId}
            query={discoveryQuery}
            city={cleanedCity}
            limit={240}
            title={
              activeLane === 'all'
                ? isId
                  ? 'Usaha di peta'
                  : 'Businesses on the map'
                : isId
                  ? `${activeCategoryLabel} di peta`
                  : `${activeCategoryLabel} on the map`
            }
            description={
              isId
                ? 'Kategori hanya jadi filter. Kolom cari tetap bersih untuk nama usaha, produk, atau jasa.'
                : 'Category stays as a filter. The search field stays clean for business, product, or service names.'
            }
            selectedSlug={initialStoreSlug}
            openMapSignal={mapOpenSignal}
          />
        </section>
      </main>
    </div>
  );
}
