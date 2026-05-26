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
  Bell,
  BriefcaseBusiness,
  Filter,
  LayoutGrid,
  MapPinned,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import LajuloLogo from '@/components/logo/LajuloLogo';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/layout/Header';
import {
  LAJUKAN_CATEGORY_CARDS,
  LAJUKAN_NEED_TRACKS,
  LAJUKAN_POPULAR_PANELS,
  type LajukanCategoryId,
} from '@/data/lajukanMobileReference';
import {
  formatLajukanCountLabel,
  formatLajukanCountWithSuffix,
  type LajukanSummary,
} from '@/lib/lajukan-marketplace';
import { AccountDropdown } from '@/components/layout/AccountDropdown';
import { buildUsahaPath } from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';
import { UmkmDiscoveryPanel } from './UmkmDiscoveryPanel';

type UmkmDiscoveryClientProps = {
  locale: string;
  isId: boolean;
  initialQuery?: string;
  initialCity?: string;
  initialStoreSlug?: string;
};

type LajukanSummaryResponse = {
  data?: LajukanSummary;
  error?: string;
};

type CategoryTone = 'emerald' | 'rose' | 'blue' | 'violet' | 'amber';

const CATEGORY_ICON_MAP: Record<LajukanCategoryId, LucideIcon> = {
  all: LayoutGrid,
  supplier: ShoppingBag,
  location: MapPin,
  service: BriefcaseBusiness,
  product: Package,
  talent: UserRound,
};

const CATEGORY_TONE_MAP: Record<LajukanCategoryId, CategoryTone> = {
  all: 'emerald',
  supplier: 'emerald',
  location: 'rose',
  service: 'blue',
  product: 'violet',
  talent: 'amber',
};

function toneClasses(tone: CategoryTone) {
  if (tone === 'rose') {
    return {
      surface:
        'from-rose-50 via-orange-50 to-white dark:from-rose-950/32 dark:via-orange-950/18 dark:to-slate-950',
      icon: 'bg-rose-100 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900',
      chip: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
    };
  }
  if (tone === 'blue') {
    return {
      surface:
        'from-teal-50 via-emerald-50 to-white dark:from-teal-950/32 dark:via-emerald-950/18 dark:to-slate-950',
      icon: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-900',
      chip: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-200',
    };
  }
  if (tone === 'violet') {
    return {
      surface:
        'from-lime-50 via-emerald-50 to-white dark:from-lime-950/32 dark:via-emerald-950/18 dark:to-slate-950',
      icon: 'bg-lime-100 text-lime-800 ring-1 ring-lime-200 dark:bg-lime-950/50 dark:text-lime-200 dark:ring-lime-900',
      chip: 'bg-lime-100 text-lime-800 dark:bg-lime-950/50 dark:text-lime-200',
    };
  }
  if (tone === 'amber') {
    return {
      surface:
        'from-amber-50 via-orange-50 to-white dark:from-amber-950/32 dark:via-orange-950/18 dark:to-slate-950',
      icon: 'bg-amber-100 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900',
      chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200',
    };
  }
  return {
    surface:
      'from-emerald-50 via-lime-50 to-white dark:from-emerald-950/34 dark:via-lime-950/18 dark:to-slate-950',
    icon: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200',
  };
}

export function UmkmDiscoveryClient(props: UmkmDiscoveryClientProps) {
  const { isId, initialQuery = '', initialCity = '', initialStoreSlug } = props;
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const resultsRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState(initialCity);
  const [activeCategory, setActiveCategory] =
    useState<LajukanCategoryId>('all');
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
        if (!response.ok || !payload.data) {
          return;
        }
        if (!active) return;
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
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setCity(initialCity);
  }, [initialCity]);

  const cleanedQuery = query.trim();
  const cleanedCity = city.trim();
  const manageBusinessHref = isAuthenticated
    ? buildUsahaPath('home')
    : '/login';
  const requestHref = isAuthenticated ? '/my-projects' : '/register';
  const chatHref = isAuthenticated ? '/chat' : '/login';
  const notificationHref = isAuthenticated ? '/notifications' : '/login';
  const accountHref = isAuthenticated ? '/profile' : '/login';
  const resolveCategoryCount = useCallback(
    (categoryId: LajukanCategoryId) => {
      if (!summary) return null;
      return summary.categories[categoryId];
    },
    [summary],
  );

  const categoryCards = useMemo(
    () =>
      LAJUKAN_CATEGORY_CARDS.map(item => ({
        ...item,
        countLabel: formatLajukanCountLabel(resolveCategoryCount(item.id)),
        icon: CATEGORY_ICON_MAP[item.id],
        tone: toneClasses(CATEGORY_TONE_MAP[item.id]),
        href: item.query
          ? `/search?q=${encodeURIComponent(item.query)}`
          : '/umkm',
      })),
    [resolveCategoryCount],
  );

  const popularPanels = useMemo(
    () =>
      LAJUKAN_POPULAR_PANELS.map(panel => {
        const total = resolveCategoryCount(panel.category);
        const suffix =
          panel.category === 'location'
            ? 'lokasi'
            : panel.category === 'service'
              ? 'jasa'
              : panel.category === 'product'
                ? 'produk'
                : 'supplier';
        return {
          ...panel,
          countLabel: formatLajukanCountWithSuffix(total, suffix),
        };
      }),
    [resolveCategoryCount],
  );

  const quickFilters = categoryCards.filter(item => item.id !== 'all');
  const sidebarLinks = [
    {
      id: 'categories',
      label: isId ? 'Kategori' : 'Categories',
      href: '#umkm-categories',
      icon: LayoutGrid,
    },
    {
      id: 'quick',
      label: isId ? 'Jalur cepat' : 'Quick lanes',
      href: '#umkm-quick',
      icon: ShoppingBag,
    },
    {
      id: 'maps',
      label: 'Lajukan Maps',
      href: '#umkm-results',
      icon: MapPinned,
    },
  ];
  const compactNeedTracks = LAJUKAN_NEED_TRACKS.slice(0, 6);

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const openLajukanMaps = () => {
    setMapOpenSignal(current => current + 1);
    scrollToResults();
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (cleanedQuery) params.set('q', cleanedQuery);
    if (cleanedCity) params.set('city', cleanedCity);
    router.push(params.toString() ? `/umkm?${params.toString()}` : '/umkm');
    scrollToResults();
  };

  const handleCategoryPick = (
    categoryId: LajukanCategoryId,
    searchText: string,
  ) => {
    setActiveCategory(categoryId);
    setQuery(searchText);
    const params = new URLSearchParams();
    if (searchText.trim()) params.set('q', searchText.trim());
    if (cleanedCity) params.set('city', cleanedCity);
    router.push(params.toString() ? `/umkm?${params.toString()}` : '/umkm');
  };
  const heroMetrics = [
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
      label: isId ? 'Kota aktif' : 'Active cities',
      value: formatLajukanCountLabel(summary?.stores.cities),
      icon: TrendingUp,
    },
  ];

  return (
    <div className="lajukan-home-compact min-h-[100dvh] overflow-x-hidden overflow-y-visible bg-[color:var(--app-surface-muted)] px-2 pb-6 pt-0 sm:px-4 lg:h-[100svh] lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0 dark:bg-[color:var(--app-surface-strong)]">
      <div className="lajukan-home-shell mx-auto flex min-h-[100dvh] w-full min-w-0 flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
        <UmkmMobileTopBar
          isId={isId}
          chatHref={chatHref}
          notificationHref={notificationHref}
          accountHref={accountHref}
          isAuthenticated={isAuthenticated}
        />
        <UmkmDesktopTopBar />
        <div
          aria-hidden="true"
          className="h-[calc(3.5rem+env(safe-area-inset-top))] lg:hidden"
        />
        <div
          aria-hidden="true"
          className="hidden h-[4.625rem] shrink-0 lg:block"
        />

        <div className="lajukan-home-desktop-grid relative z-0 mx-auto mt-3 grid min-h-0 w-full max-w-[1700px] gap-3 lg:mt-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[260px_minmax(0,1fr)_260px] 2xl:grid-cols-[280px_minmax(0,1fr)_280px]">
          <aside className="hidden min-h-0 lg:block lg:h-full lg:overflow-hidden">
            <div
              className="flex h-full max-h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-6 pr-1"
              data-auto-scrollbar
            >
              <nav className="shrink-0 rounded-[24px] p-3">
                <div className="px-2 pb-1 pt-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                    {isId ? 'UMKM' : 'SME'}
                  </p>
                </div>
                <div className="space-y-1">
                  {sidebarLinks.map(item => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.id}
                        href={item.href}
                        className="flex min-h-[42px] items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-xs font-semibold text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]"
                      >
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-slate-50 text-[color:var(--app-text-soft)] dark:bg-slate-900">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        {item.label}
                      </a>
                    );
                  })}
                </div>
                <div className="my-2 h-px bg-[color:var(--app-border)]" />
                <div className="space-y-1">
                  {quickFilters.slice(0, 5).map(item => {
                    const Icon = item.icon;
                    const active = activeCategory === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleCategoryPick(item.id, item.query)}
                        className={cn(
                          'flex min-h-[42px] w-full items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-left text-xs font-semibold transition',
                          active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/42 dark:text-emerald-200'
                            : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
                        )}
                      >
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-white text-[color:var(--app-text-soft)] dark:bg-slate-900">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{item.label}</span>
                          <span className="mt-0.5 block truncate text-[10px] font-medium text-[color:var(--app-text-soft)]">
                            {item.countLabel}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </nav>

              <Link
                href={manageBusinessHref}
                className="mx-3 rounded-[18px] px-3 py-3 transition hover:bg-[color:var(--app-surface-muted)]"
              >
                <p className="text-[0.92rem] font-black tracking-[-0.03em] text-[color:var(--app-text)]">
                  {isId ? 'Kelola usaha' : 'Manage business'}
                </p>
                <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--app-accent)]">
                  {isId ? 'Buka usaha' : 'Open hub'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
          </aside>

          <main
            className="min-w-0 overflow-x-hidden overflow-y-visible pt-2 overscroll-contain lg:min-h-0 lg:overflow-y-auto lg:pr-1"
            data-auto-scrollbar
          >
            <div className="flex flex-col gap-3 pb-6 sm:gap-4">
              <section className="min-w-0 overflow-hidden rounded-[22px] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] ring-1 ring-black/5 sm:rounded-[26px] sm:p-4 dark:bg-slate-950/86 dark:ring-white/10">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px] xl:grid-cols-1 xl:items-start">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                      <MapPinned className="h-3.5 w-3.5" />
                      Lajukan Maps
                    </span>
                    <h1 className="mt-2 max-w-[18ch] text-[1.48rem] font-black leading-[1.02] tracking-[-0.05em] text-[color:var(--app-text)] sm:text-[2rem]">
                      {isId
                        ? 'Cari usaha sekitar. Buka profil. Langsung chat.'
                        : 'Find nearby businesses. Open profiles. Chat fast.'}
                    </h1>
                    <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[color:var(--app-text-soft)] sm:text-[13px]">
                      {isId
                        ? 'Pilih lewat peta, cek foto/katalog, lalu Chat atau Rute.'
                        : 'Pick from the map, check photos/catalog, then chat or route.'}
                    </p>

                    <div className="mt-3 grid gap-2 min-[420px]:grid-cols-3">
                      {[
                        {
                          id: 'map',
                          icon: MapPinned,
                          label: isId ? 'Lihat lokasi' : 'See locations',
                          note: isId
                            ? 'Usaha aktif di peta'
                            : 'Active stores on map',
                        },
                        {
                          id: 'profile',
                          icon: Store,
                          label: isId ? 'Cek profil' : 'Check profiles',
                          note: isId
                            ? 'Foto, katalog, rating'
                            : 'Photos, catalog, rating',
                        },
                        {
                          id: 'deal',
                          icon: MessageCircle,
                          label: isId ? 'Langsung aksi' : 'Take action',
                          note: isId
                            ? 'Chat, order, rute'
                            : 'Chat, order, route',
                        },
                      ].map(item => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.id}
                            className="flex min-w-0 items-center gap-2 rounded-[16px] bg-[color:var(--app-surface-muted)] px-2.5 py-2"
                          >
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200">
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-black text-[color:var(--app-text)]">
                                {item.label}
                              </span>
                              <span className="block truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                                {item.note}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {heroMetrics.map(metric => {
                        const Icon = metric.icon;
                        return (
                          <div
                            key={metric.id}
                            className="inline-flex min-h-[42px] min-w-[128px] shrink-0 items-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-white/82 px-2.5 py-2 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.14)] dark:bg-slate-950/66"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="block min-w-0">
                              <span className="block truncate text-[0.86rem] font-black tracking-[-0.035em] text-[color:var(--app-text)]">
                                {metric.value}
                              </span>
                              <span className="block truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                                {metric.label}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <form
                      onSubmit={handleSearch}
                      className="mt-3 grid min-w-0 gap-2 rounded-[18px] border border-slate-200/85 bg-white/78 p-2 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-950/72 sm:grid-cols-[minmax(0,1fr)_190px_auto]"
                    >
                      <label className="flex min-h-[46px] items-center gap-2.5 rounded-[14px] border-2 border-slate-300 bg-white px-3 py-2 transition focus-within:border-[color:var(--app-accent)] focus-within:ring-4 focus-within:ring-[color:color-mix(in_srgb,var(--app-accent)_16%,transparent)] dark:border-slate-700 dark:bg-slate-950/84 dark:focus-within:border-emerald-400">
                        <Search className="h-4.5 w-4.5 text-[color:var(--app-text-soft)]" />
                        <input
                          type="search"
                          value={query}
                          onChange={event => setQuery(event.target.value)}
                          placeholder={
                            isId
                              ? 'Cari supplier, jasa, lokasi...'
                              : 'Search suppliers, services, locations...'
                          }
                          className="w-full min-w-0 border-0 bg-transparent p-0 text-[14px] font-semibold text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                        />
                      </label>
                      <label className="flex min-h-[46px] items-center gap-2.5 rounded-[14px] border-2 border-slate-300 bg-white px-3 py-2 transition focus-within:border-[color:var(--app-accent)] focus-within:ring-4 focus-within:ring-[color:color-mix(in_srgb,var(--app-accent)_16%,transparent)] dark:border-slate-700 dark:bg-slate-950/84 dark:focus-within:border-emerald-400">
                        <MapPin className="h-4.5 w-4.5 text-[color:var(--app-text-soft)]" />
                        <input
                          value={city}
                          onChange={event => setCity(event.target.value)}
                          placeholder={isId ? 'Kota / area' : 'City / area'}
                          className="w-full min-w-0 border-0 bg-transparent p-0 text-[14px] font-semibold text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                        />
                      </label>
                      <button
                        type="submit"
                        className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-[13px] font-black text-[color:var(--app-text-inverse)] shadow-[0_16px_30px_-22px_color-mix(in_srgb,var(--app-accent)_44%,transparent)]"
                      >
                        {isId ? 'Cari' : 'Search'}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </form>

                    <div className="mt-2.5 grid gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto]">
                      <button
                        type="button"
                        onClick={openLajukanMaps}
                        className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[15px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-[12px] font-black text-white shadow-[0_16px_30px_-22px_color-mix(in_srgb,var(--app-accent)_44%,transparent)]"
                      >
                        <MapPinned className="h-4 w-4" />
                        {isId ? 'Cari sekitar' : 'Find nearby'}
                      </button>
                      <Link
                        href={manageBusinessHref}
                        className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[15px] border border-[color:var(--app-border)] bg-white px-4 text-[12px] font-bold text-[color:var(--app-text)] dark:bg-slate-950/70"
                      >
                        <Store className="h-4 w-4" />
                        {isId ? 'Daftarkan usaha' : 'List my business'}
                      </Link>
                    </div>

                    <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {quickFilters.slice(0, 5).map(item => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              handleCategoryPick(item.id, item.query)
                            }
                            className={cn(
                              'inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition',
                              activeCategory === item.id
                                ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                                : 'border-[color:var(--app-border)] bg-white/86 text-[color:var(--app-text)] dark:bg-slate-950/70',
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <aside className="hidden gap-2.5 lg:grid xl:hidden">
                    <Link
                      href={manageBusinessHref}
                      className="rounded-[18px] bg-[color:var(--app-surface-muted)] px-3 py-3 transition hover:bg-[color:var(--app-accent-soft)]"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                        {isId ? 'Kelola usaha' : 'Business hub'}
                      </p>
                      <p className="mt-2 text-[0.92rem] font-black tracking-[-0.03em] text-[color:var(--app-text)]">
                        {isId
                          ? 'Buka dashboard usaha, katalog, tim, dan operasional.'
                          : 'Open business dashboard, catalog, team, and operations.'}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--app-accent)]">
                        {isId ? 'Kelola sekarang' : 'Open now'}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                    <Link
                      href={requestHref}
                      className="rounded-[18px] bg-[color:var(--app-surface-muted)] px-3 py-3 transition hover:bg-[color:var(--app-accent-soft)]"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
                        {isId ? 'Kalau belum ketemu' : 'If nothing fits'}
                      </p>
                      <p className="mt-2 text-[0.9rem] font-bold text-[color:var(--app-text)]">
                        {isId
                          ? 'Buat permintaan. Tunggu penawaran.'
                          : 'Post a request and wait for responses.'}
                      </p>
                    </Link>
                  </aside>
                </div>
              </section>

              <section
                id="umkm-categories"
                className="hidden min-w-0 rounded-[20px] bg-[color:var(--app-surface-strong)] p-2.5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)] ring-1 ring-black/5 dark:bg-slate-950/86 dark:ring-white/10 sm:block"
              >
                <div className="flex items-center justify-between gap-2 px-1 pb-2">
                  <h2 className="text-sm font-black tracking-[-0.03em] text-[color:var(--app-text)]">
                    {isId ? 'Pilih cepat' : 'Quick pick'}
                  </h2>
                  <button
                    type="button"
                    onClick={scrollToResults}
                    aria-controls="umkm-results"
                    className="inline-flex min-h-[30px] shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--app-surface-muted)] px-3 text-[11px] font-semibold text-[color:var(--app-text)]"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {isId ? 'Ke hasil' : 'Results'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {categoryCards.map(item => {
                    const Icon = item.icon;
                    const selected = activeCategory === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleCategoryPick(item.id, item.query)}
                        className={cn(
                          'min-w-0 rounded-[15px] border px-2 py-2 text-center transition',
                          selected
                            ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                            : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]',
                        )}
                      >
                        <Icon className="mx-auto h-4.5 w-4.5" />
                        <span className="mt-1 block truncate text-[11px] font-black">
                          {item.label.replace('Semua Kategori', 'Semua')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section
                id="umkm-quick"
                className="hidden min-w-0 rounded-[20px] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)] ring-1 ring-black/5 dark:bg-slate-950/86 dark:ring-white/10 sm:block"
              >
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {popularPanels.slice(0, 3).map(panel => {
                    const Icon = CATEGORY_ICON_MAP[panel.category];
                    return (
                      <Link
                        key={panel.id}
                        href={`/search?q=${encodeURIComponent(panel.query)}`}
                        className="flex min-h-[50px] min-w-0 items-center gap-2.5 rounded-[15px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 transition hover:border-[color:var(--app-accent-border)]"
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-black text-[color:var(--app-text)]">
                            {panel.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-[color:var(--app-text-soft)]">
                            {panel.countLabel}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                      </Link>
                    );
                  })}
                  {compactNeedTracks.map(track => (
                    <Link
                      key={track.id}
                      href={`/search?q=${encodeURIComponent(track.query)}`}
                      className="flex min-h-[42px] min-w-0 items-center justify-between rounded-[14px] border border-[color:var(--app-border)] bg-white/70 px-3 py-2 transition hover:border-[color:var(--app-accent-border)] dark:bg-slate-950/50"
                    >
                      <span className="truncate text-xs font-semibold text-[color:var(--app-text)]">
                        {track.title}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-accent)]" />
                    </Link>
                  ))}
                </div>
              </section>

              <section
                ref={resultsRef}
                id="umkm-results"
                className="min-w-0 rounded-[20px] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)] ring-1 ring-black/5 sm:rounded-[22px] dark:bg-slate-950/86 dark:ring-white/10"
              >
                <UmkmDiscoveryPanel
                  isId={isId}
                  query={cleanedQuery}
                  city={cleanedCity}
                  limit={240}
                  title={
                    isId ? 'Usaha yang bisa dipilih' : 'Businesses to pick'
                  }
                  description={
                    isId
                      ? 'Pilih usaha, lalu Profil, Chat, atau Rute.'
                      : 'Pick a business, then profile, chat, or route.'
                  }
                  selectedSlug={initialStoreSlug}
                  openMapSignal={mapOpenSignal}
                />
              </section>
            </div>
          </main>

          <aside className="hidden min-h-0 xl:block xl:h-full xl:overflow-hidden xl:pt-2">
            <div
              className="flex h-full max-h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-6 pl-1"
              data-auto-scrollbar
            >
              <Link
                href={manageBusinessHref}
                className="rounded-[24px] p-3.5 transition hover:bg-[color:var(--app-surface-muted)]"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                  {isId ? 'Workspace usaha' : 'Business workspace'}
                </p>
                <h2 className="mt-2 text-[1.05rem] font-black leading-tight tracking-[-0.04em] text-[color:var(--app-text)]">
                  {isId
                    ? 'Kelola katalog, order, QR, dan tim.'
                    : 'Manage catalog, orders, QR, and team.'}
                </h2>
                <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--app-accent)]">
                  {isId ? 'Buka dashboard' : 'Open dashboard'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>

              <div className="rounded-[24px] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[0.95rem] font-black tracking-[-0.035em] text-[color:var(--app-text)]">
                    {isId ? 'Jalur cepat' : 'Quick lanes'}
                  </h2>
                  <Link
                    href="/kategori"
                    className="text-[11px] font-semibold text-[color:var(--app-accent)]"
                  >
                    {isId ? 'Semua' : 'All'}
                  </Link>
                </div>
                <div className="mt-3 space-y-2">
                  {popularPanels.slice(0, 4).map(panel => {
                    const Icon = CATEGORY_ICON_MAP[panel.category];
                    return (
                      <Link
                        key={panel.id}
                        href={`/search?q=${encodeURIComponent(panel.query)}`}
                        className="flex items-center gap-2.5 rounded-[15px] px-2.5 py-2 transition hover:bg-[color:var(--app-surface-muted)]"
                      >
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-white text-[color:var(--app-accent)] dark:bg-slate-900">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-[color:var(--app-text)]">
                            {panel.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-[color:var(--app-text-soft)]">
                            {panel.countLabel}
                          </span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-[color:var(--app-text-soft)]" />
                      </Link>
                    );
                  })}
                </div>
              </div>

              <Link
                href={requestHref}
                className="rounded-[24px] p-3.5 transition hover:bg-[color:var(--app-surface-muted)]"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                  {isId ? 'Butuh spesifik?' : 'Need something specific?'}
                </p>
                <p className="mt-2 text-sm font-bold leading-5 text-[color:var(--app-text)]">
                  {isId
                    ? 'Buat permintaan. Supplier bisa nawar.'
                    : 'Create a request so suppliers or partners can respond.'}
                </p>
                <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--app-accent)]">
                  {isId ? 'Buat permintaan' : 'Create request'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function UmkmMobileTopBar({
  isId,
  chatHref,
  notificationHref,
  accountHref,
  isAuthenticated,
}: {
  isId: boolean;
  chatHref: string;
  notificationHref: string;
  accountHref: string;
  isAuthenticated: boolean;
}) {
  return (
    <header className="ui-layer-local-topbar fixed inset-x-0 top-0 flex items-center gap-2 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] px-2 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.35rem)] shadow-[0_12px_26px_-24px_rgba(15,23,42,0.26)] backdrop-blur-xl sm:px-3 lg:hidden">
      <Link
        href="/umkm"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.16)]"
        aria-label={isId ? 'Buka menu UMKM' : 'Open SME menu'}
      >
        <Menu className="h-4.5 w-4.5" />
      </Link>
      <Link
        href="/home"
        className="inline-flex min-w-0 flex-1 items-center justify-center"
        aria-label={isId ? 'Beranda Lajukan' : 'Lajukan home'}
      >
        <LajuloLogo
          compact
          className="gap-2"
          textClassName="hidden min-[420px]:inline"
        />
      </Link>
      <div className="flex items-center gap-1.5">
        <Link
          href={chatHref}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.16)]"
          aria-label="Chat"
        >
          <MessageCircle className="h-4 w-4" />
        </Link>
        <Link
          href={notificationHref}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.16)]"
          aria-label={isId ? 'Notifikasi' : 'Notifications'}
        >
          <Bell className="h-4 w-4" />
        </Link>
        {isAuthenticated ? (
          <AccountDropdown isId={isId} variant="icon" />
        ) : (
          <Link
            href={accountHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.16)]"
            aria-label={isId ? 'Akun' : 'Account'}
          >
            <UserRound className="h-4 w-4" />
          </Link>
        )}
      </div>
    </header>
  );
}

function UmkmDesktopTopBar() {
  return (
    <div className="hidden lg:block">
      <Header />
    </div>
  );
}
