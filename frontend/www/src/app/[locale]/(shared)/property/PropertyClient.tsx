'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { PropertyCard } from '@/components/ui-kit';
import { useAppBack } from '@/lib/navigation/useAppBack';
import {
  Search,
  RotateCcw,
  Loader2,
  X,
  Filter,
  ChevronLeft,
  Home as HomeIcon,
} from 'lucide-react';
import {
  formatPriceWithUnit,
  resolveContentPriceUnitLabel,
} from '@/lib/content/priceUnit';

interface Property {
  id: string;
  title: string;
  image: string;
  location: string;
  price: string;
  statusType: 'sale' | 'rent';
  bedrooms: number;
  bathrooms: number;
  area: number;
  href: string;
}

type Filters = {
  search: string;
  location: string;
  type: 'All' | 'sale' | 'rent';
};

type ContentItem = {
  id: string;
  slug?: string;
  title?: string;
  summary?: string;
  content_type?: string;
  category?: string;
  cover_image?: string;
  price_cents?: number | null;
  price_unit?: string | null;
  metadata?: Record<string, unknown>;
};

const PROPERTIES_PER_LOAD = 9;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function formatCurrencyIDRFromCents(cents: number | null | undefined): string {
  if (!Number.isFinite(cents as number)) return 'Hubungi agen';
  const amount = Math.max(0, Math.floor((cents as number) / 100));
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function resolveStatusType(item: ContentItem): 'sale' | 'rent' {
  const metadata = item.metadata ?? {};
  const raw = (
    asString(metadata.status_type) ||
    asString(metadata.listing_type) ||
    asString(metadata.transaction_type) ||
    asString(item.category) ||
    asString(item.content_type) ||
    ''
  ).toLowerCase();
  return raw.includes('rent') || raw.includes('sewa') ? 'rent' : 'sale';
}

function mapContentToProperty(
  item: ContentItem,
  locale: 'id' | 'en',
): Property {
  const metadata = item.metadata ?? {};
  const location =
    asString(metadata.location) ||
    asString(metadata.city) ||
    asString(metadata.region) ||
    asString(metadata.sector) ||
    'Indonesia';
  const statusType = resolveStatusType(item);
  const bedrooms = Number(metadata.bedrooms ?? metadata.kamar_tidur ?? 0) || 0;
  const bathrooms =
    Number(metadata.bathrooms ?? metadata.kamar_mandi ?? 0) || 0;
  const area =
    Number(metadata.area ?? metadata.luas ?? metadata.land_area ?? 0) || 0;
  const price = formatCurrencyIDRFromCents(item.price_cents);
  const priceUnitLabel = resolveContentPriceUnitLabel(item, locale);
  const fallbackPriceLabel = asString(metadata.price_label);

  return {
    id: item.id,
    title: item.title || item.summary || 'Property Listing',
    image: item.cover_image || asString(metadata.image) || '',
    location,
    price:
      price !== 'Hubungi agen'
        ? formatPriceWithUnit(price, priceUnitLabel)
        : fallbackPriceLabel
          ? formatPriceWithUnit(fallbackPriceLabel, priceUnitLabel)
          : price,
    statusType,
    bedrooms,
    bathrooms,
    area,
    href: item.slug ? `/property/${item.slug}` : `/property/${item.id}`,
  };
}

function extractContentItems(payload: unknown): ContentItem[] {
  if (Array.isArray(payload)) return payload as ContentItem[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as ContentItem[];
    if (Array.isArray(obj.data)) return obj.data as ContentItem[];
    if (Array.isArray(obj.results)) return obj.results as ContentItem[];
  }
  return [];
}

function matchesFilters(property: Property, filters: Filters): boolean {
  const q = filters.search.trim().toLowerCase();
  const matchSearch =
    q.length === 0 ||
    property.title.toLowerCase().includes(q) ||
    property.location.toLowerCase().includes(q);
  const locationFilter = filters.location.trim().toLowerCase();
  const matchLocation =
    locationFilter.length === 0 ||
    property.location.toLowerCase().includes(locationFilter);
  const matchType =
    filters.type === 'All' || property.statusType === filters.type;
  return matchSearch && matchLocation && matchType;
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1.5 rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-accent)]"
    >
      <span>{label}</span>
      <button
        title="Hapus"
        onClick={onClear}
        className="rounded-md p-0.5 text-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-soft)] transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

export default function PropertyClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = pathname.startsWith('/en') ? 'en' : 'id';
  const fallbackHomePath = pathname.startsWith('/en') ? '/en/home' : '/id/home';

  const initialSearch = searchParams.get('q') ?? '';
  const initialLocation = searchParams.get('location') ?? '';
  const initialType = (searchParams.get('status') as Filters['type']) || 'All';

  const [tempSearch, setTempSearch] = useState(initialSearch);
  const [tempLocation, setTempLocation] = useState(initialLocation);
  const [tempType, setTempType] = useState(initialType);

  const [appliedFilters, setAppliedFilters] = useState<Filters>({
    search: initialSearch,
    location: initialLocation,
    type: initialType,
  });

  const [items, setItems] = useState<Property[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const autoLoadTargetRef = useRef<HTMLDivElement>(null);
  const autoLoadLockRef = useRef(false);

  const handleBack = useAppBack(router, fallbackHomePath);

  // Keep URL query in sync with applied filters.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (appliedFilters.search.trim())
      params.set('q', appliedFilters.search.trim());
    else params.delete('q');
    if (appliedFilters.location.trim())
      params.set('location', appliedFilters.location.trim());
    else params.delete('location');
    if (appliedFilters.type !== 'All')
      params.set('status', appliedFilters.type);
    else params.delete('status');

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }
  }, [appliedFilters, pathname, router, searchParams]);

  const loadData = useCallback(
    async (reset = false) => {
      if (
        !reset &&
        (!hasMore || loadingMore || loadingInitial || autoLoadLockRef.current)
      )
        return;

      const currentPage = reset ? 1 : page;
      const offset = (currentPage - 1) * PROPERTIES_PER_LOAD;

      if (reset) {
        setLoadingInitial(true);
        setLoadError(null);
        setHasMore(true);
        autoLoadLockRef.current = false;
      } else {
        setLoadingMore(true);
        autoLoadLockRef.current = true;
      }

      try {
        const params = new URLSearchParams();
        params.set('type', 'property');
        params.set('limit', String(PROPERTIES_PER_LOAD));
        params.set('offset', String(offset));
        if (appliedFilters.search.trim()) {
          params.set('q', appliedFilters.search.trim());
        }
        if (appliedFilters.location.trim()) {
          params.set('location', appliedFilters.location.trim());
        }
        if (appliedFilters.type !== 'All') {
          params.set('status', appliedFilters.type);
        }

        const res = await fetch(`/api/content?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = await res.json().catch(() => []);

        if (!res.ok) {
          throw new Error(`Property API failed with status ${res.status}`);
        }

        const serverItems = extractContentItems(payload);
        const fromApi = serverItems
          .map(item => mapContentToProperty(item, locale))
          .filter(property => matchesFilters(property, appliedFilters));

        const batch = fromApi;
        const hasMoreNext = serverItems.length === PROPERTIES_PER_LOAD;
        setLoadError(null);

        setItems(prev => (reset ? batch : [...prev, ...batch]));
        setHasMore(hasMoreNext);
        setPage(reset ? 2 : currentPage + 1);
      } catch (err) {
        console.error('[property] failed to load data', err);
        setLoadError('Gagal memuat properti dari backend.');
        if (reset) setItems([]);
      } finally {
        autoLoadLockRef.current = false;
        setLoadingInitial(false);
        setLoadingMore(false);
      }
    },
    [appliedFilters, hasMore, loadingInitial, loadingMore, locale, page],
  );

  const executeSearch = useCallback(() => {
    const next: Filters = {
      search: tempSearch.trim(),
      location: tempLocation.trim(),
      type: tempType,
    };
    setAppliedFilters(prev =>
      prev.search === next.search &&
        prev.location === next.location &&
        prev.type === next.type
        ? prev
        : next,
    );
  }, [tempLocation, tempSearch, tempType]);

  useEffect(() => {
    loadData(true);
  }, [appliedFilters, loadData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      executeSearch();
    }, 260);
    return () => window.clearTimeout(timer);
  }, [executeSearch]);

  useEffect(() => {
    const target = autoLoadTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      entries => {
        if (
          entries[0]?.isIntersecting &&
          hasMore &&
          !loadingMore &&
          !loadingInitial
        ) {
          loadData(false);
        }
      },
      { threshold: 0.01, rootMargin: '600px 0px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadData, loadingInitial, loadingMore]);

  const handleReset = () => {
    setTempSearch('');
    setTempLocation('');
    setTempType('All');
    setAppliedFilters({ search: '', location: '', type: 'All' });
  };

  const clearSpecificFilter = (key: keyof Filters) => {
    if (key === 'search') setTempSearch('');
    if (key === 'location') setTempLocation('');
    if (key === 'type') setTempType('All');

    setAppliedFilters(prev => ({
      ...prev,
      [key]: key === 'type' ? 'All' : '',
    }));
  };

  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_94%,_transparent)]  lg:top-[calc(3.5rem+env(safe-area-inset-top))] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_92%,_transparent)]">
        <div className="mx-auto max-w-[1500px] space-y-2 px-2 py-2 sm:px-3">
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="flex flex-grow items-center gap-2">
              <button
                type="button"
                title="Kembali"
                aria-label="Kembali"
                onClick={handleBack}
                className="inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] transition-all active:scale-95 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
              >
                <ChevronLeft className="h-4.5 w-4.5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]" />
              </button>

              <div className="relative flex-grow">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--app-text-soft)]" />
                <input
                  type="text"
                  placeholder="Cari villa, apartemen, lokasi..."
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] py-2.5 pl-11 pr-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                  value={tempSearch}
                  onChange={e => setTempSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && executeSearch()}
                />
              </div>
            </div>

            <div className="flex min-w-0 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
              <input
                type="text"
                placeholder="Filter lokasi"
                className="min-w-[150px] flex-1 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm outline-none dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] md:w-44"
                value={tempLocation}
                onChange={e => setTempLocation(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && executeSearch()}
              />

              <select
                title="Filter Status"
                className="min-w-[150px] flex-1 cursor-pointer appearance-none rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm outline-none dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] md:w-44"
                value={tempType}
                onChange={e => setTempType(e.target.value as Filters['type'])}
              >
                <option value="All">Semua Status</option>
                <option value="sale">DIJUAL</option>
                <option value="rent">DISEWA</option>
              </select>
            </div>
          </div>

          <div className="flex min-h-[30px] flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[color:var(--app-text-soft)]">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {!(
              appliedFilters.search ||
              appliedFilters.location.trim() ||
              appliedFilters.type !== 'All'
            ) ? (
              <span className="text-xs text-[color:var(--app-text-soft)] italic">
                Tidak Ada
              </span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {appliedFilters.search && (
                  <FilterChip
                    label={`"${appliedFilters.search}"`}
                    onClear={() => clearSpecificFilter('search')}
                  />
                )}
                {appliedFilters.location.trim() && (
                  <FilterChip
                    label={appliedFilters.location}
                    onClear={() => clearSpecificFilter('location')}
                  />
                )}
                {appliedFilters.type !== 'All' && (
                  <FilterChip
                    label={appliedFilters.type.toUpperCase()}
                    onClear={() => clearSpecificFilter('type')}
                  />
                )}
                <button
                  onClick={handleReset}
                  className="ml-1 text-[10px] font-bold uppercase text-[color:var(--app-danger)] hover:underline"
                >
                  Hapus Semua
                </button>
              </div>
            )}
          </div>

          <p className="hidden text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:block">
            Auto-apply filter aktif
          </p>
        </div>
      </header>

      <div className="h-[126px] md:h-[112px] lg:h-[calc(112px+3.5rem+env(safe-area-inset-top))]" />

      <main className="mx-auto max-w-[1500px] px-2 pb-5 sm:px-3">
        {loadError && (
          <div className="mb-4 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-warning-border)_70%,_transparent)] bg-[color:var(--app-warning-soft)] px-4 py-3 text-xs text-[color:var(--app-warning)] flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button
              onClick={() => loadData(true)}
              className="font-semibold underline underline-offset-2"
            >
              Muat ulang
            </button>
          </div>
        )}

        {loadingInitial ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="ui-skeleton ui-skeleton-pulse h-80 rounded-2xl"
              />
            ))}
          </div>
        ) : items.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {items.map((property, i) => (
                  <motion.div
                    key={property.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: (i % 9) * 0.05 }}
                  >
                    <PropertyCard {...property} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div
              ref={autoLoadTargetRef}
              className="flex min-h-[72px] w-full flex-col items-center justify-center py-5"
            >
              {loadingMore ? (
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--app-text)]">
                  <Loader2 className="h-4 w-4 animate-spin text-[color:var(--app-accent)]" />
                  Memuat data berikutnya...
                </div>
              ) : hasMore ? (
                <span className="text-xs italic text-[color:var(--app-text-soft)]">
                  Scroll untuk muat otomatis
                </span>
              ) : (
                <div className="w-full border-t border-[color:var(--app-border)] pt-4 text-center text-xs font-medium italic text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]">
                  Semua properti sudah dimuat
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <HomeIcon className="mb-3 h-12 w-12 text-[color:var(--app-text-soft)]" />
            <h2 className="text-xl font-bold dark:text-[color:var(--app-text-inverse)]">
              Properti tidak ditemukan
            </h2>
            <p className="mt-2 max-w-xs text-sm text-[color:var(--app-text)]">
              Kami tidak menemukan properti yang sesuai dengan filter Anda.
              Silakan coba atur kembali filter Anda.
            </p>
            <button
              onClick={handleReset}
              className="mt-4 flex items-center gap-2 rounded-2xl bg-[color:var(--app-accent)] px-5 py-2.5 font-bold text-[color:var(--app-text-inverse)] shadow-lg transition-all hover:bg-[color:var(--app-accent-strong)] active:scale-95"
            >
              <RotateCcw className="w-4 h-4" /> Reset Semua Filter
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
