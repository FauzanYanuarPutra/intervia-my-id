'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductCard } from '@/components/ui-kit';
import { useAppBack } from '@/lib/navigation/useAppBack';
import {
  ChevronLeft,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  ShoppingBag,
  TriangleAlert,
} from 'lucide-react';
import {
  asString,
  ContentItem,
  extractContentItems,
  formatIDRFromCents,
  matchAnyFilter,
} from '@/lib/content/catalog';
import {
  formatPriceWithUnit,
  resolveContentPriceUnitLabel,
} from '@/lib/content/priceUnit';

type ProductItem = {
  id: string;
  href: string;
  image?: string;
  title: string;
  price: string;
  priceValue: number;
  location: string;
  category: string;
  type: string;
  content_type: string;
  brand: string;
  seller_type: string;
  work_mode: string;
  price_unit: string;
  stock?: number;
  condition: string;
  inStock: boolean;
  description: string;
  subtitle: string;
};

type Filters = {
  search: string;
  category: string;
  location: string;
  minPrice: string;
  maxPrice: string;
  condition: string;
  inStockOnly: boolean;
  sortBy: 'latest' | 'price_low' | 'price_high';
};

const PAGE_SIZE = 16;

function mapContentToProduct(
  item: ContentItem,
  locale: 'id' | 'en',
): ProductItem {
  const meta = item.metadata || {};
  const id = String(item.id);
  const slug = item.slug || id;
  const price = formatIDRFromCents(item.price_cents);
  const priceUnitLabel = resolveContentPriceUnitLabel(item, locale);
  const fallbackPriceLabel = asString(meta.price_label);
  const itemType = asString(item.content_type) || asString(item.category) || 'listing';

  return {
    id,
    href: `/content/${slug}`,
    image: item.cover_image || asString(meta.image) || asString(meta.thumbnail),
    title: item.title || item.summary || 'Untitled Product',
    price:
      price !== '-'
        ? formatPriceWithUnit(price, priceUnitLabel)
        : fallbackPriceLabel
          ? formatPriceWithUnit(fallbackPriceLabel, priceUnitLabel)
          : 'Negotiable',
    priceValue: Number.isFinite(item.price_cents as number)
      ? Math.max(0, Math.floor((item.price_cents as number) / 100))
      : 0,
    location:
      asString(meta.location) ||
      asString(meta.city) ||
      asString(meta.region) ||
      'Indonesia',
    category:
      asString(item.category) ||
      asString(meta.category) ||
      asString(item.content_type) ||
      'General',
    type: itemType,
    content_type: itemType,
    brand: asString(meta.brand) || 'Unknown',
    seller_type: asString(meta.seller_type) || '',
    work_mode: asString(meta.work_mode) || asString(meta.delivery_mode) || '',
    price_unit: priceUnitLabel || '',
    stock:
      typeof meta.stock === 'number'
        ? meta.stock
        : Number.isFinite(Number(meta.stock))
          ? Number(meta.stock)
          : undefined,
    condition: asString(meta.condition) || 'n/a',
    inStock:
      typeof meta.stock === 'number'
        ? meta.stock > 0
        : asString(meta.availability)?.toLowerCase() === 'in_stock',
    description:
      item.summary ||
      asString(meta.description) ||
      asString(meta.body) ||
      '',
    subtitle:
      [
        asString(meta.seller_type),
        asString(meta.work_mode),
        asString(meta.location),
      ]
        .filter(Boolean)
        .join(' • ') || asString(meta.price_label) || '',
  };
}

function isMarketplaceType(item: ContentItem): boolean {
  const typeText =
    `${item.content_type || ''} ${item.category || ''}`.toLowerCase();
  return (
    typeText.includes('product') ||
    typeText.includes('market') ||
    typeText.includes('shop') ||
    typeText.includes('catalog')
  );
}

function matchesFilters(item: ProductItem, filters: Filters): boolean {
  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack =
      `${item.title} ${item.category} ${item.location} ${item.description}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  if (filters.category.trim()) {
    const match = item.category
      .toLowerCase()
      .includes(filters.category.trim().toLowerCase());
    if (!match) return false;
  }

  if (filters.location.trim()) {
    const match = item.location
      .toLowerCase()
      .includes(filters.location.trim().toLowerCase());
    if (!match) return false;
  }

  if (filters.condition.trim()) {
    const match = item.condition
      .toLowerCase()
      .includes(filters.condition.trim().toLowerCase());
    if (!match) return false;
  }

  const minPrice = Number(filters.minPrice);
  if (Number.isFinite(minPrice) && minPrice > 0 && item.priceValue < minPrice) {
    return false;
  }

  const maxPrice = Number(filters.maxPrice);
  if (Number.isFinite(maxPrice) && maxPrice > 0 && item.priceValue > maxPrice) {
    return false;
  }

  if (filters.inStockOnly && !item.inStock) return false;

  return true;
}

export default function MarketplaceClient() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.startsWith('/en') ? 'en' : 'id';
  const searchParams = useSearchParams();
  const autoLoadTargetRef = useRef<HTMLDivElement>(null);
  const autoLoadLockRef = useRef(false);
  const fallbackHomePath = pathname.startsWith('/en') ? '/en/home' : '/id/home';

  const initialFilters = useMemo<Filters>(
    () => ({
      search: searchParams.get('q') || '',
      category: searchParams.get('category') || '',
      location: searchParams.get('location') || '',
      minPrice: searchParams.get('min_price') || '',
      maxPrice: searchParams.get('max_price') || '',
      condition: searchParams.get('condition') || '',
      inStockOnly: searchParams.get('in_stock') === '1',
      sortBy:
        (searchParams.get('sort') as Filters['sortBy']) === 'price_low' ||
          (searchParams.get('sort') as Filters['sortBy']) === 'price_high'
          ? (searchParams.get('sort') as Filters['sortBy'])
          : 'latest',
    }),
    [searchParams],
  );
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);

  const [items, setItems] = useState<ProductItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const handleBack = useAppBack(router, fallbackHomePath);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (filters.search.trim()) params.set('q', filters.search.trim());
    else params.delete('q');
    if (filters.category.trim())
      params.set('category', filters.category.trim());
    else params.delete('category');
    if (filters.location.trim())
      params.set('location', filters.location.trim());
    else params.delete('location');
    if (filters.minPrice.trim())
      params.set('min_price', filters.minPrice.trim());
    else params.delete('min_price');
    if (filters.maxPrice.trim())
      params.set('max_price', filters.maxPrice.trim());
    else params.delete('max_price');
    if (filters.condition.trim())
      params.set('condition', filters.condition.trim());
    else params.delete('condition');
    if (filters.inStockOnly) params.set('in_stock', '1');
    else params.delete('in_stock');
    if (filters.sortBy !== 'latest') params.set('sort', filters.sortBy);
    else params.delete('sort');

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    }
  }, [filters, pathname, router, searchParams]);

  const loadData = useCallback(
    async (reset: boolean) => {
      if (
        !reset &&
        (!hasMore || loadingInitial || loadingMore || autoLoadLockRef.current)
      )
        return;

      const currentPage = reset ? 1 : page;
      const offset = (currentPage - 1) * PAGE_SIZE;
      if (reset) {
        setLoadingInitial(true);
        setLoadError(null);
        autoLoadLockRef.current = false;
      } else {
        setLoadingMore(true);
        autoLoadLockRef.current = true;
      }

      try {
        const params = new URLSearchParams();
        params.set('type', 'product');
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(offset));
        if (filters.search.trim()) params.set('q', filters.search.trim());
        if (filters.category.trim())
          params.set('category', filters.category.trim());
        if (filters.location.trim())
          params.set('location', filters.location.trim());

        const response = await fetch(`/api/content?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            (payload as { error?: string }).error ||
            `Failed to load marketplace content (${response.status})`,
          );
        }

        const serverItems = extractContentItems(payload);
        const contentItems = serverItems.filter(entry => {
          if (!isMarketplaceType(entry)) return false;
          return matchAnyFilter(entry, filters.search);
        });
        let mapped = contentItems
          .map(item => mapContentToProduct(item, locale))
          .filter(entry => matchesFilters(entry, filters));

        if (filters.sortBy === 'price_low') {
          mapped = [...mapped].sort((a, b) => a.priceValue - b.priceValue);
        } else if (filters.sortBy === 'price_high') {
          mapped = [...mapped].sort((a, b) => b.priceValue - a.priceValue);
        }

        setItems(prev => (reset ? mapped : [...prev, ...mapped]));
        setHasMore(serverItems.length === PAGE_SIZE);
        setPage(reset ? 2 : currentPage + 1);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load marketplace content';
        setLoadError(message);
        if (reset) setItems([]);
      } finally {
        autoLoadLockRef.current = false;
        setLoadingInitial(false);
        setLoadingMore(false);
      }
    },
    [filters, hasMore, loadingInitial, loadingMore, locale, page],
  );

  useEffect(() => {
    loadData(true);
  }, [filters, loadData]);

  const commitFilters = useCallback((nextDraft: Filters) => {
    const next: Filters = {
      search: nextDraft.search.trim(),
      category: nextDraft.category.trim(),
      location: nextDraft.location.trim(),
      minPrice: nextDraft.minPrice.trim(),
      maxPrice: nextDraft.maxPrice.trim(),
      condition: nextDraft.condition.trim(),
      inStockOnly: nextDraft.inStockOnly,
      sortBy: nextDraft.sortBy,
    };

    setFilters(prev =>
      prev.search === next.search &&
        prev.category === next.category &&
        prev.location === next.location &&
        prev.minPrice === next.minPrice &&
        prev.maxPrice === next.maxPrice &&
        prev.condition === next.condition &&
        prev.inStockOnly === next.inStockOnly &&
        prev.sortBy === next.sortBy
        ? prev
        : next,
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      commitFilters(draftFilters);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [commitFilters, draftFilters]);

  useEffect(() => {
    const target = autoLoadTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      entries => {
        if (
          entries[0]?.isIntersecting &&
          hasMore &&
          !loadingInitial &&
          !loadingMore
        ) {
          loadData(false);
        }
      },
      { threshold: 0.01, rootMargin: '600px 0px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadData, loadingInitial, loadingMore]);

  const resetFilters = () => {
    const empty: Filters = {
      search: '',
      category: '',
      location: '',
      minPrice: '',
      maxPrice: '',
      condition: '',
      inStockOnly: false,
      sortBy: 'latest',
    };
    setDraftFilters(empty);
    setFilters(empty);
  };

  const hasActiveFilters = Boolean(
    filters.search.trim() ||
    filters.category.trim() ||
    filters.location.trim() ||
    filters.minPrice.trim() ||
    filters.maxPrice.trim() ||
    filters.condition.trim() ||
    filters.inStockOnly ||
    filters.sortBy !== 'latest',
  );

  const categoryOptions = useMemo(
    () =>
      [...new Set(items.map(item => item.category.trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 20),
    [items],
  );

  const avgPrice = useMemo(() => {
    const priced = items.filter(item => item.priceValue > 0);
    if (priced.length === 0) return '-';
    const avg = Math.round(
      priced.reduce((sum, item) => sum + item.priceValue, 0) / priced.length,
    );
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(avg);
  }, [items]);

  return (
    <div className="lajukan-market-page lajukan-market-marketplace min-h-screen bg-[color:var(--app-surface-muted)] pb-6 dark:bg-[color:var(--app-surface-strong)] lg:pb-0">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_94%,_transparent)]  lg:top-[calc(3.5rem+env(safe-area-inset-top))] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_92%,_transparent)]">
        <div className="mx-auto max-w-[1500px] space-y-2 px-2 py-2 sm:px-3">
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="flex flex-grow items-center gap-2">
              <button
                type="button"
                title="Back"
                aria-label="Back"
                onClick={handleBack}
                className="inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] transition-all active:scale-95 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
              >
                <ChevronLeft className="h-4.5 w-4.5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]" />
              </button>

              <div className="relative flex-grow">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
                <input
                  type="text"
                  placeholder="Search products and services"
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] py-2.5 pl-11 pr-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                  value={draftFilters.search}
                  onChange={event =>
                    setDraftFilters(prev => ({
                      ...prev,
                      search: event.target.value,
                    }))
                  }
                  onKeyDown={event =>
                    event.key === 'Enter' && commitFilters(draftFilters)
                  }
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] md:max-w-xl md:grid md:grid-cols-2 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
              <select
                value={draftFilters.category}
                onChange={event =>
                  setDraftFilters(prev => ({
                    ...prev,
                    category: event.target.value,
                  }))
                }
                className="min-w-[150px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
              >
                <option value="">All categories</option>
                {categoryOptions.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Location filter"
                value={draftFilters.location}
                onChange={event =>
                  setDraftFilters(prev => ({
                    ...prev,
                    location: event.target.value,
                  }))
                }
                onKeyDown={event =>
                  event.key === 'Enter' && commitFilters(draftFilters)
                }
                className="min-w-[150px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
            <input
              type="number"
              min={0}
              placeholder="Min price"
              value={draftFilters.minPrice}
              onChange={event =>
                setDraftFilters(prev => ({
                  ...prev,
                  minPrice: event.target.value,
                }))
              }
              className="min-w-[132px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            />
            <input
              type="number"
              min={0}
              placeholder="Max price"
              value={draftFilters.maxPrice}
              onChange={event =>
                setDraftFilters(prev => ({
                  ...prev,
                  maxPrice: event.target.value,
                }))
              }
              className="min-w-[132px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            />
            <select
              value={draftFilters.condition}
              onChange={event =>
                setDraftFilters(prev => ({
                  ...prev,
                  condition: event.target.value,
                }))
              }
              className="min-w-[150px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            >
              <option value="">Any condition</option>
              <option value="new">New</option>
              <option value="like_new">Like New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="refurbished">Refurbished</option>
            </select>
            <select
              value={draftFilters.sortBy}
              onChange={event =>
                setDraftFilters(prev => ({
                  ...prev,
                  sortBy: event.target.value as Filters['sortBy'],
                }))
              }
              className="min-w-[170px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            >
              <option value="latest">Sort: Latest</option>
              <option value="price_low">Sort: Price Low to High</option>
              <option value="price_high">Sort: Price High to Low</option>
            </select>
            <label className="inline-flex min-w-[136px] items-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <input
                type="checkbox"
                checked={draftFilters.inStockOnly}
                onChange={event =>
                  setDraftFilters(prev => ({
                    ...prev,
                    inStockOnly: event.target.checked,
                  }))
                }
                className="accent-lajukan-600"
              />
              In stock only
            </label>
          </div>

          <div className="flex min-h-[32px] flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[color:var(--app-text-soft)]">
              <Filter className="h-3 w-3" /> Filters:
            </span>
            {!hasActiveFilters ? (
              <span className="text-xs italic text-[color:var(--app-text-soft)]">
                None
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {filters.search ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    &quot;{filters.search}&quot;
                  </span>
                ) : null}
                {filters.category ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    {filters.category}
                  </span>
                ) : null}
                {filters.location ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    {filters.location}
                  </span>
                ) : null}
                {filters.minPrice ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    Min {filters.minPrice}
                  </span>
                ) : null}
                {filters.maxPrice ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    Max {filters.maxPrice}
                  </span>
                ) : null}
                {filters.condition ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    {filters.condition}
                  </span>
                ) : null}
                {filters.inStockOnly ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    In stock
                  </span>
                ) : null}
                <button
                  onClick={resetFilters}
                  className="ml-1 text-[10px] font-bold uppercase text-[color:var(--app-danger)] hover:underline"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          <p className="hidden text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:block">
            Auto-apply filter aktif
          </p>
        </div>
      </header>

      <div className="h-[160px] md:h-[128px] lg:h-[calc(128px+3.5rem+env(safe-area-inset-top))]" />

      <main className="mx-auto max-w-[1500px] px-2 pb-5 sm:px-3">
        <section className="mb-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-xs dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <p className="font-semibold text-[color:var(--app-text)]">
              Loaded Items
            </p>
            <p className="mt-1 text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {items.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-xs dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <p className="font-semibold text-[color:var(--app-text)]">
              Avg Price
            </p>
            <p className="mt-1 text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {avgPrice}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-xs dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <p className="font-semibold text-[color:var(--app-text)]">
              In-stock Ratio
            </p>
            <p className="mt-1 text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {items.length > 0
                ? `${Math.round((items.filter(item => item.inStock).length / items.length) * 100)}%`
                : '-'}
            </p>
          </div>
        </section>

        {loadError ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-warning-border)_70%,_transparent)] bg-[color:var(--app-warning-soft)] px-4 py-3 text-xs text-[color:var(--app-warning)]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p>{loadError}</p>
              <button
                onClick={() => loadData(true)}
                className="font-semibold underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {loadingInitial ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="ui-skeleton ui-skeleton-pulse h-56 rounded-2xl"
              />
            ))}
          </div>
        ) : items.length > 0 ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {items.length} item(s) loaded
              </div>
              <button
                type="button"
                onClick={() => loadData(true)}
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              <AnimatePresence mode="popLayout">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: (index % PAGE_SIZE) * 0.02,
                    }}
                  >
                    <div className="space-y-2">
                      <ProductCard {...item} />
                      <div className="flex flex-wrap items-center gap-1.5 px-1">
                        <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
                          {item.brand}
                        </span>
                        <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
                          {item.condition}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.inStock
                              ? 'border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:var(--app-accent-border)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] dark:text-[color:var(--app-accent)]'
                              : 'border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)] dark:border-[color:var(--app-danger-border)] dark:bg-[color:color-mix(in_srgb,_var(--app-danger)_30%,_transparent)] dark:text-[color:var(--app-danger)]'
                            }`}
                        >
                          {item.inStock ? 'In stock' : 'Out of stock'}
                        </span>
                      </div>
                    </div>
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
                <span className="text-xs italic text-[color:var(--app-text-soft)]">
                  All catalog items loaded
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <ShoppingBag className="mb-3 h-12 w-12 text-[color:var(--app-text-soft)]" />
            <h2 className="text-xl font-bold dark:text-[color:var(--app-text-inverse)]">
              No marketplace items found
            </h2>
            <p className="mt-2 text-sm text-[color:var(--app-text)]">
              Try different keywords or category filters.
            </p>
            <button
              onClick={resetFilters}
              className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[color:var(--app-accent)] px-5 py-2.5 font-bold text-[color:var(--app-text-inverse)] shadow-lg hover:bg-[color:var(--app-accent-strong)]"
            >
              <RefreshCcw className="h-4 w-4" />
              Reset filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
