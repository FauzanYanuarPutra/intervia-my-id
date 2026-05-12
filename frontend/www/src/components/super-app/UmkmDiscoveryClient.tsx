'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  Filter,
  LayoutGrid,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
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
      icon:
        'bg-rose-100 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900',
      chip:
        'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
    };
  }
  if (tone === 'blue') {
    return {
      surface:
        'from-sky-50 via-cyan-50 to-white dark:from-sky-950/32 dark:via-cyan-950/18 dark:to-slate-950',
      icon:
        'bg-sky-100 text-sky-600 ring-1 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900',
      chip:
        'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200',
    };
  }
  if (tone === 'violet') {
    return {
      surface:
        'from-violet-50 via-fuchsia-50 to-white dark:from-violet-950/32 dark:via-fuchsia-950/18 dark:to-slate-950',
      icon:
        'bg-violet-100 text-violet-600 ring-1 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900',
      chip:
        'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200',
    };
  }
  if (tone === 'amber') {
    return {
      surface:
        'from-amber-50 via-orange-50 to-white dark:from-amber-950/32 dark:via-orange-950/18 dark:to-slate-950',
      icon:
        'bg-amber-100 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900',
      chip:
        'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200',
    };
  }
  return {
    surface:
      'from-emerald-50 via-lime-50 to-white dark:from-emerald-950/34 dark:via-lime-950/18 dark:to-slate-950',
    icon:
      'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900',
    chip:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200',
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

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      try {
        const response = await fetch('/api/lajukan/summary', {
          cache: 'no-store',
          credentials: 'include',
        });
        const payload = (await response.json().catch(() => ({}))) as LajukanSummaryResponse;
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
  const manageBusinessHref = isAuthenticated ? buildUsahaPath('home') : '/login';
  const requestHref = isAuthenticated ? '/my-projects' : '/register';
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

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (cleanedQuery) params.set('q', cleanedQuery);
    if (cleanedCity) params.set('city', cleanedCity);
    router.push(params.toString() ? `/umkm?${params.toString()}` : '/umkm');
    scrollToResults();
  };

  const handleCategoryPick = (categoryId: LajukanCategoryId, searchText: string) => {
    setActiveCategory(categoryId);
    setQuery(searchText);
    const params = new URLSearchParams();
    if (searchText.trim()) params.set('q', searchText.trim());
    if (cleanedCity) params.set('city', cleanedCity);
    router.push(params.toString() ? `/umkm?${params.toString()}` : '/umkm');
  };

  return (
    <main className="page-shell overflow-x-hidden py-3 pb-8 sm:py-5">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-2 sm:px-3">
        <section className="rounded-[30px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[var(--app-shadow)] sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] xl:items-start">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                <LayoutGrid className="h-3.5 w-3.5" />
                {isId ? 'Kategori & kebutuhan' : 'Categories'}
              </span>
              <h1 className="mt-4 text-[2.35rem] font-black leading-[0.94] tracking-[-0.08em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[3rem]">
                {isId ? 'Kategori' : 'Categories'}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Temukan supplier, lokasi usaha, jasa, produk, dan talent lewat jalur yang lebih rapi. Cari cepat di atas, lalu pindah ke kategori yang paling cocok.'
                  : 'Find suppliers, business locations, services, products, and talent from one cleaner surface.'}
              </p>

              <form
                onSubmit={handleSearch}
                className="mt-5 grid gap-3 rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_10%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_94%,transparent))] p-3 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.12)] sm:grid-cols-[minmax(0,1fr)_220px_auto]"
              >
                <label className="flex items-center gap-3 rounded-[18px] bg-white/80 px-4 py-3 dark:bg-slate-950/70">
                  <Search className="h-4.5 w-4.5 text-[color:var(--app-text-soft)]" />
                  <input
                    type="search"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={
                      isId
                        ? 'Cari supplier, jasa, lokasi, dll'
                        : 'Search suppliers, services, locations...'
                    }
                    className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                  />
                </label>
                <label className="flex items-center gap-3 rounded-[18px] bg-white/80 px-4 py-3 dark:bg-slate-950/70">
                  <MapPin className="h-4.5 w-4.5 text-[color:var(--app-text-soft)]" />
                  <input
                    value={city}
                    onChange={event => setCity(event.target.value)}
                    placeholder={isId ? 'Kota / area' : 'City / area'}
                    className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-5 text-sm font-semibold text-[color:var(--app-text-inverse)] shadow-[0_16px_30px_-22px_color-mix(in_srgb,var(--app-accent)_44%,transparent)]"
                >
                  {isId ? 'Cari' : 'Search'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>

            <aside className="grid gap-3">
              <Link
                href={manageBusinessHref}
                className="rounded-[24px] border border-[color:var(--app-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,253,245,0.96),rgba(236,253,245,0.88))] px-4 py-4 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.12)] dark:bg-[linear-gradient(140deg,rgba(6,17,27,0.98),rgba(8,37,28,0.94),rgba(6,17,27,0.98))]"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                  {isId ? 'Kelola usaha' : 'Business hub'}
                </p>
                <p className="mt-3 text-lg font-black tracking-[-0.04em] text-[color:var(--app-text)]">
                  {isId
                    ? 'Buka dashboard usaha, katalog, tim, dan operasional.'
                    : 'Open business dashboard, catalog, team, and operations.'}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--app-accent)]">
                  {isId ? 'Kelola sekarang' : 'Open now'}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <Link
                href={requestHref}
                className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-4"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                  {isId ? 'Kalau belum ketemu' : 'If nothing fits'}
                </p>
                <p className="mt-3 text-base font-bold text-[color:var(--app-text)]">
                  {isId
                    ? 'Buat permintaan dan tunggu penawaran masuk.'
                    : 'Post a request and wait for responses.'}
                </p>
              </Link>
            </aside>
          </div>
        </section>

        <section className="rounded-[30px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[var(--app-shadow)] sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {categoryCards.map(item => {
              const Icon = item.icon;
              const selected = activeCategory === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleCategoryPick(item.id, item.query)}
                  className={cn(
                    'overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-gradient-to-br p-4 text-left shadow-[0_14px_24px_-22px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5',
                    item.tone.surface,
                    selected &&
                      'ring-2 ring-[color:var(--app-accent-border)] shadow-[0_22px_36px_-24px_color-mix(in_srgb,var(--app-accent)_22%,transparent)]',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-12 w-12 items-center justify-center rounded-[18px]',
                      item.tone.icon,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-base font-black tracking-[-0.04em] text-[color:var(--app-text)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                    {item.sublabel}
                  </p>
                  <span
                    className={cn(
                      'mt-4 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      item.tone.chip,
                    )}
                  >
                    {item.countLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[30px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[var(--app-shadow)] sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {quickFilters.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleCategoryPick(item.id, item.query)}
                className={cn(
                  'inline-flex min-h-[42px] items-center rounded-full border px-4 text-sm font-semibold transition',
                  activeCategory === item.id
                    ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                    : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]',
                )}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-sm font-semibold text-[color:var(--app-text)]"
            >
              <Filter className="h-4 w-4" />
              {isId ? 'Filter' : 'Filter'}
            </button>
          </div>
        </section>

        <section className="rounded-[30px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[var(--app-shadow)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[1.5rem] font-black tracking-[-0.04em] text-[color:var(--app-text)]">
                {isId ? 'Kategori Populer' : 'Popular categories'}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Mulai dari kategori yang paling sering dicari pelaku usaha.'
                  : 'Start from the categories businesses browse most often.'}
              </p>
            </div>
            <span className="text-sm font-semibold text-[color:var(--app-accent)]">
              {isId ? 'Lihat semua' : 'View all'}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {popularPanels.map(panel => {
              const tone = toneClasses(CATEGORY_TONE_MAP[panel.category]);
              const Icon = CATEGORY_ICON_MAP[panel.category];
              return (
                <Link
                  key={panel.id}
                  href={`/search?q=${encodeURIComponent(panel.query)}`}
                  className={cn(
                    'overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-gradient-to-br p-4 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5',
                    tone.surface,
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        'inline-flex h-11 w-11 items-center justify-center rounded-[16px]',
                        tone.icon,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-[color:var(--app-accent)]" />
                  </div>
                  <h3 className="mt-4 text-lg font-black tracking-[-0.04em] text-[color:var(--app-text)]">
                    {panel.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                    {panel.description}
                  </p>
                  <span
                    className={cn(
                      'mt-4 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      tone.chip,
                    )}
                  >
                    {panel.countLabel}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-[30px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[var(--app-shadow)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[1.5rem] font-black tracking-[-0.04em] text-[color:var(--app-text)]">
                {isId
                  ? 'Telusuri Berdasarkan Kebutuhan'
                  : 'Browse by needs'}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Pilih jalur yang paling dekat dengan bottleneck usahamu.'
                  : 'Choose the lane closest to your current bottleneck.'}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {LAJUKAN_NEED_TRACKS.map(track => (
              <Link
                key={track.id}
                href={`/search?q=${encodeURIComponent(track.query)}`}
                className="flex items-center justify-between rounded-[24px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_94%,transparent))] px-4 py-4 transition hover:border-[color:var(--app-accent-border)]"
              >
                <span className="min-w-0">
                  <span className="block text-base font-black tracking-[-0.03em] text-[color:var(--app-text)]">
                    {track.title}
                  </span>
                  <span className="mt-1 block text-sm text-[color:var(--app-text-soft)]">
                    {track.description}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
              </Link>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-[color:var(--app-border)] bg-[linear-gradient(135deg,rgba(239,253,245,0.95),rgba(255,255,255,0.98)_48%,rgba(240,249,255,0.94))] p-4 shadow-[var(--app-shadow)] dark:bg-[linear-gradient(140deg,rgba(8,37,28,0.92),rgba(6,17,27,0.98)_52%,rgba(10,25,43,0.92))] sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                {isId ? 'Belum cocok?' : 'Still not enough?'}
              </p>
              <h2 className="mt-3 text-[2rem] font-black tracking-[-0.06em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {isId
                  ? 'Buat permintaan kebutuhanmu'
                  : 'Create a business request'}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Kalau kategori belum cukup spesifik, tulis kebutuhanmu dan biarkan supplier, jasa, atau partner usaha mengirim penawaran yang relevan.'
                  : 'If categories are still too broad, write the need and wait for relevant offers.'}
              </p>
            </div>
            <Link
              href={requestHref}
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[20px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-5 text-sm font-semibold text-[color:var(--app-text-inverse)] shadow-[0_16px_30px_-22px_color-mix(in_srgb,var(--app-accent)_44%,transparent)]"
            >
              {isId ? 'Buat Permintaan' : 'Create request'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section
          ref={resultsRef}
          id="umkm-results"
          className="rounded-[30px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[var(--app-shadow)] sm:p-5"
        >
          <UmkmDiscoveryPanel
            isId={isId}
            query={cleanedQuery}
            city={cleanedCity}
            limit={240}
            title={isId ? 'Daftar usaha pilihan' : 'Suggested businesses'}
            description={
              isId
                ? 'Hasil real dari discovery tetap tampil di bawah agar kamu bisa langsung lanjut pilih.'
                : 'Live discovery results stay below so you can continue immediately.'
            }
            selectedSlug={initialStoreSlug}
          />
        </section>
      </div>
    </main>
  );
}
