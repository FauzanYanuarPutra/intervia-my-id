'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildLoginPath } from '@/lib/authRoutes';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { EmptyState } from '@/components/system/feedback/EmptyState';
import {
  MyListingsListSkeleton,
  MyListingsSkeleton,
} from '@/components/system/feedback/RouteSkeletons';
import {
  Clock3,
  FileText,
  Heart,
  ImageIcon,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  PHONE_VERIFICATION_SETTINGS_PATH,
  readPhoneVerifiedStatus,
} from '@/lib/identityVerification';
import {
  readSearchCartSession,
  removeSearchCartItem,
  subscribeSearchCartSession,
  type SearchCartItem,
} from '@/lib/searchCartSession';
import CreateMarketplaceShell from '../(app)/create/CreateMarketplaceShell';

type ListingStatus = 'draft' | 'active' | 'archived';
type ListingCollectionMode = 'mine' | 'favorites' | 'history';

type ListingItem = {
  id: string;
  slug?: string | null;
  title?: string | null;
  summary?: string | null;
  content_type?: string | null;
  type?: string | null;
  cover_image?: string | null;
  content_status?: string | null;
  status?: string | null;
  updated_at?: string;
  created_at?: string;
  metadata?: Record<string, unknown> | null;
};

function parseId(value: string): string {
  const clean = value.trim();
  if (!clean) return '';
  const match = clean.match(
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i,
  );
  return match ? match[1] : clean;
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function readProgress(item: ListingItem): number {
  const meta = (item.metadata || {}) as Record<string, unknown>;
  const progress = meta.listing_progress as Record<string, unknown> | undefined;
  const current =
    typeof progress?.current_step === 'number' ? progress.current_step : 1;
  const total =
    typeof progress?.total_steps === 'number' ? progress.total_steps : 3;
  return Math.min(
    100,
    Math.max(0, Math.round((current / Math.max(total, 1)) * 100)),
  );
}

function summarizeText(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.length > 150 ? `${trimmed.slice(0, 147)}...` : trimmed;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readImageCandidate(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return (
      readString(objectValue.url) ||
      readString(objectValue.src) ||
      readString(objectValue.preview) ||
      readString(objectValue.image_url)
    );
  }
  return '';
}

function resolveListingImage(item: ListingItem): string {
  const meta = (item.metadata || {}) as Record<string, unknown>;
  const direct =
    readString(item.cover_image) ||
    readString(meta.cover_image) ||
    readString(meta.thumbnail) ||
    readString(meta.image) ||
    readString(meta.image_url) ||
    readString(meta.photo_url);
  if (direct) return direct;

  for (const key of ['images', 'photos', 'media', 'attachments']) {
    const collection = meta[key];
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) {
      const candidate = readImageCandidate(entry);
      if (candidate) return candidate;
    }
  }

  return '';
}

function listingTypeLabel(value: string, locale: string): string {
  const normalized = value.toLowerCase();
  const labels: Record<string, { id: string; en: string }> = {
    product: { id: 'Produk', en: 'Product' },
    service: { id: 'Jasa', en: 'Service' },
    job: { id: 'Lowongan', en: 'Job' },
    property: { id: 'Properti', en: 'Property' },
    tool_rental: { id: 'Sewa alat', en: 'Tool rental' },
    business_transfer: { id: 'Oper usaha', en: 'Business transfer' },
    company: { id: 'Profil usaha', en: 'Business profile' },
  };
  const matched = labels[normalized];
  if (matched) return locale === 'id' ? matched.id : matched.en;
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, token => token.toUpperCase());
}

function listingStatusLabel(value: string, locale: string): string {
  const normalized = value.toLowerCase();
  if (normalized === 'active') return locale === 'id' ? 'Tayang' : 'Live';
  if (normalized === 'archived') return locale === 'id' ? 'Arsip' : 'Archived';
  return locale === 'id' ? 'Draft' : 'Draft';
}

export default function MyListingsPage() {
  const locale = useLocale() || 'id';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, authFetch } = useAuth();
  const phoneVerified = readPhoneVerifiedStatus(user);
  const currentSearch = searchParams?.toString() || '';
  const filterParam = (searchParams?.get('filter') || '').toLowerCase();
  const isFavoritesMode = filterParam === 'favorites';
  const isHistoryMode = filterParam === 'history';
  const collectionMode: ListingCollectionMode = isFavoritesMode
    ? 'favorites'
    : isHistoryMode
      ? 'history'
      : 'mine';

  const [activeStatus, setActiveStatus] = useState<ListingStatus>('draft');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<ListingItem[]>([]);
  const [savedReferences, setSavedReferences] = useState<SearchCartItem[]>([]);
  const createHref = phoneVerified
    ? '/create'
    : PHONE_VERIFICATION_SETTINGS_PATH;
  const createLabel =
    locale === 'id'
      ? phoneVerified
        ? 'Buat baru'
        : 'Verifikasi'
      : phoneVerified
        ? 'Post new'
        : 'Verify Phone';

  const statusTabs = useMemo(
    () => [
      { id: 'draft' as const, label: locale === 'id' ? 'Draft' : 'Draft' },
      { id: 'active' as const, label: locale === 'id' ? 'Aktif' : 'Active' },
      {
        id: 'archived' as const,
        label: locale === 'id' ? 'Arsip' : 'Archived',
      },
    ],
    [locale],
  );

  const collectionTabs = useMemo(
    () => [
      {
        id: 'mine',
        href: '/my-listings',
        label: locale === 'id' ? 'Postingan' : 'Posts',
      },
      {
        id: 'favorites',
        href: '/my-listings?filter=favorites',
        label: locale === 'id' ? 'Favorit' : 'Favorites',
      },
      {
        id: 'history',
        href: '/my-listings?filter=history',
        label: locale === 'id' ? 'Riwayat' : 'History',
      },
    ],
    [locale],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter(item => {
      const rawType = item.type || item.content_type || 'listing';
      const rawStatus = item.content_status || item.status || activeStatus;
      const text = [
        item.title,
        item.summary,
        item.type,
        item.content_type,
        item.content_status,
        item.status,
        listingTypeLabel(rawType, locale),
        listingStatusLabel(rawStatus, locale),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [activeStatus, items, locale, query]);

  const filteredReferences = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return savedReferences;
    return savedReferences.filter(item => {
      const text = [
        item.title,
        item.summary,
        item.typeLabel,
        item.actionLabel,
        item.location,
        item.priceLabel,
        item.storeName,
        item.kind,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [query, savedReferences]);

  useEffect(() => {
    const syncSavedReferences = () => {
      setSavedReferences(readSearchCartSession().items);
    };

    syncSavedReferences();
    return subscribeSearchCartSession(syncSavedReferences);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(buildLoginPath(locale, pathname, currentSearch));
      return;
    }

    if (isFavoritesMode || isHistoryMode) {
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await authFetch(`/api/my-listings?status=${activeStatus}`);
        const data = (await res.json().catch(() => ({}))) as {
          results?: ListingItem[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Failed to load listings');
        if (!cancelled)
          setItems(Array.isArray(data.results) ? data.results : []);
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(
            err instanceof Error ? err.message : 'Failed to load listings',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [
    activeStatus,
    authFetch,
    authLoading,
    currentSearch,
    isFavoritesMode,
    isHistoryMode,
    locale,
    pathname,
    router,
    user,
  ]);

  if (authLoading) {
    return (
      <CreateMarketplaceShell>
        <MyListingsSkeleton />
      </CreateMarketplaceShell>
    );
  }

  const removeReference = (itemId: string) => {
    setSavedReferences(removeSearchCartItem(itemId).items);
  };

  const pageTitle =
    collectionMode === 'favorites'
      ? locale === 'id'
        ? 'Favorit'
        : 'Favorites'
      : collectionMode === 'history'
        ? locale === 'id'
          ? 'Riwayat dilihat'
          : 'Viewed history'
        : locale === 'id'
          ? 'Postingan'
          : 'Drafts and posts';
  const pageDescription =
    collectionMode === 'favorites'
      ? locale === 'id'
        ? 'Referensi listing yang kamu simpan.'
        : 'Listings you saved as references.'
      : collectionMode === 'history'
        ? locale === 'id'
          ? 'Listing terakhir yang kamu buka.'
          : 'Listings you recently opened.'
        : locale === 'id'
          ? 'Draft, aktif, dan arsip dalam satu tempat.'
          : 'Manage drafts, live posts, and archived listings.';
  const HeaderIcon =
    collectionMode === 'favorites'
      ? Heart
      : collectionMode === 'history'
        ? Clock3
        : FileText;
  const primaryAction =
    collectionMode !== 'mine'
      ? {
          label: locale === 'id' ? 'Cari' : 'Search',
          href: '/search',
          icon: Search,
        }
      : {
          label: createLabel,
          href: createHref,
          icon: Plus,
        };
  const PrimaryActionIcon = primaryAction.icon;
  const SecondaryActionIcon = collectionMode !== 'mine' ? FileText : Clock3;

  return (
    <CreateMarketplaceShell>
      <div className="mx-auto w-full max-w-5xl px-0 py-0 sm:px-1">
        <div className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] p-3 dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] dark:bg-[color:var(--app-surface-strong)] sm:rounded-2xl sm:border-x sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[color:color-mix(in_srgb,var(--app-accent)_12%,white)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)] dark:bg-emerald-400/10">
                <HeaderIcon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[17px] font-black leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {pageTitle}
                </h1>
                <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-[color:var(--app-text-soft)]">
                  {pageDescription}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:justify-end">
              <Link
                href={primaryAction.href}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[13px] bg-[color:var(--app-accent-strong)] px-3 text-xs font-black text-[color:var(--app-text-inverse)] shadow-[0_14px_24px_-20px_rgba(15,23,42,0.35)]"
              >
                <PrimaryActionIcon className="h-3.5 w-3.5" />
                {primaryAction.label}
              </Link>
              <Link
                href={
                  collectionMode !== 'mine' ? '/my-listings' : '/transactions'
                }
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[13px] border border-[color:var(--app-border)] bg-white px-3 text-xs font-black text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950"
              >
                <SecondaryActionIcon className="h-3.5 w-3.5" />
                {collectionMode !== 'mine'
                  ? locale === 'id'
                    ? 'Postingan'
                    : 'Posts'
                  : locale === 'id'
                    ? 'Transaksi'
                    : 'Transactions'}
              </Link>
            </div>
          </div>

          {!phoneVerified && (
            <div className="mt-4 rounded-2xl border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--app-warning)]">
                    {locale === 'id'
                      ? 'Verifikasi dulu'
                      : 'Verify your phone before creating a new listing'}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--app-text)]">
                    {locale === 'id'
                      ? 'Draft aman. Posting baru aktif setelah nomor beres.'
                      : 'You can still view older drafts, but the new listing flow is gated until an active phone number is verified.'}
                  </p>
                </div>
                <Link
                  href={PHONE_VERIFICATION_SETTINGS_PATH}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[color:var(--app-warning)] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)]"
                >
                  {locale === 'id' ? 'Verifikasi' : 'Open verification'}
                </Link>
              </div>
            </div>
          )}

          <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(230px,320px)] lg:items-center">
            <div className="grid grid-cols-3 gap-1 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55">
              {collectionTabs.map(tab => {
                const active =
                  (tab.id === 'favorites' && collectionMode === 'favorites') ||
                  (tab.id === 'history' && collectionMode === 'history') ||
                  (tab.id === 'mine' && collectionMode === 'mine');
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={`inline-flex min-h-9 items-center justify-center rounded-[12px] px-2 text-xs font-black transition sm:text-[13px] ${
                      active
                        ? 'bg-white text-[color:var(--app-accent)] shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] dark:bg-slate-900 dark:text-emerald-300'
                        : 'text-[color:var(--app-text-soft)] hover:bg-white/70 hover:text-[color:var(--app-text)] dark:hover:bg-slate-900'
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>

            <div className="ui-field-shell rounded-[14px] border border-slate-300 bg-white px-2.5 py-1 shadow-none transition focus-within:border-[color:var(--app-accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--app-accent)_14%,transparent)] dark:border-slate-700 dark:bg-slate-950 dark:focus-within:border-emerald-400">
              <label className="flex min-h-[34px] items-center gap-2">
                <Search className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
                <input
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={
                    isFavoritesMode
                      ? locale === 'id'
                        ? 'Cari favorit'
                        : 'Search favorites'
                      : isHistoryMode
                        ? locale === 'id'
                          ? 'Cari riwayat'
                          : 'Search history'
                        : locale === 'id'
                          ? 'Cari postingan'
                          : 'Search posts'
                  }
                  className="w-full min-w-0 bg-transparent text-[13px] font-semibold text-[color:var(--app-text)] outline-none placeholder:text-slate-400"
                  aria-label={
                    locale === 'id' ? 'Cari postingan' : 'Search listings'
                  }
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[color:var(--app-text-soft)] transition hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
                    aria-label={
                      locale === 'id' ? 'Hapus pencarian' : 'Clear search'
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </label>
            </div>
          </div>

          {collectionMode === 'mine' ? (
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55 sm:max-w-md">
              {statusTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveStatus(tab.id)}
                  className={`min-h-9 rounded-[12px] px-2 text-xs font-black transition sm:text-[13px] ${
                    activeStatus === tab.id
                      ? 'bg-white text-[color:var(--app-accent)] shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] dark:bg-slate-900 dark:text-emerald-300'
                      : 'text-[color:var(--app-text-soft)] hover:bg-white/70 hover:text-[color:var(--app-text)] dark:hover:bg-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}

          {error && (
            <div className="mt-4 rounded-lg border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-xs text-[color:var(--app-danger)]">
              {error}
            </div>
          )}

          {collectionMode === 'history' ? (
            <EmptyState
              className="mt-3 px-3 py-6 sm:py-7"
              title={
                query
                  ? locale === 'id'
                    ? 'Tidak ketemu'
                    : 'No match'
                  : locale === 'id'
                    ? 'Riwayat masih kosong'
                    : 'No viewed history yet'
              }
              description={
                query
                  ? locale === 'id'
                    ? 'Coba kata lain atau reset pencarian.'
                    : 'Try another keyword or reset search.'
                  : locale === 'id'
                    ? 'Setelah kamu membuka listing dari Search atau Home, riwayatnya akan muncul di sini.'
                    : 'After you open listings from Search or Home, your viewed history will show here.'
              }
              action={
                query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="inline-flex min-h-9 items-center rounded-xl border border-[color:var(--app-border-strong)] bg-white px-3 text-xs font-black text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:bg-slate-950"
                  >
                    {locale === 'id' ? 'Reset cari' : 'Reset search'}
                  </button>
                ) : (
                  <Link
                    href="/search"
                    className="inline-flex min-h-9 items-center rounded-xl bg-[color:var(--app-accent-strong)] px-3 text-xs font-black text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                  >
                    {locale === 'id' ? 'Cari listing' : 'Search listings'}
                  </Link>
                )
              }
            />
          ) : collectionMode === 'favorites' ? (
            filteredReferences.length === 0 ? (
              <EmptyState
                className="mt-3 px-3 py-6 sm:py-7"
                title={
                  query
                    ? locale === 'id'
                      ? 'Tidak ketemu'
                      : 'No match'
                    : locale === 'id'
                      ? 'Belum ada favorit'
                      : 'No favorites yet'
                }
                description={
                  query
                    ? locale === 'id'
                      ? 'Coba kata lain atau reset pencarian.'
                      : 'Try another keyword or reset search.'
                    : locale === 'id'
                      ? 'Buka Search, tambah item yang menarik, nanti referensinya muncul di sini.'
                      : 'Open Search, add interesting items, and the references will show here.'
                }
                action={
                  query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="inline-flex min-h-9 items-center rounded-xl border border-[color:var(--app-border-strong)] bg-white px-3 text-xs font-black text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:bg-slate-950"
                    >
                      {locale === 'id' ? 'Reset cari' : 'Reset search'}
                    </button>
                  ) : (
                    <Link
                      href="/search"
                      className="inline-flex min-h-9 items-center rounded-xl bg-[color:var(--app-accent-strong)] px-3 text-xs font-black text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                    >
                      {locale === 'id' ? 'Cari listing' : 'Search listings'}
                    </Link>
                  )
                }
              />
            ) : (
              <div className="mt-4 space-y-3">
                {filteredReferences.map(item => {
                  const imageStyle = item.image
                    ? {
                        backgroundImage: `url("${item.image.replace(/"/g, '%22')}")`,
                      }
                    : undefined;

                  return (
                    <div
                      key={item.id}
                      className="rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 shadow-[0_14px_32px_-26px_rgba(15,23,42,0.26)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/72"
                    >
                      <div className="flex gap-3">
                        <div
                          className="flex h-[86px] w-[86px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] bg-cover bg-center text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]"
                          style={imageStyle}
                        >
                          {item.image ? null : <Heart className="h-6 w-6" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h2 className="line-clamp-2 text-[15px] font-black leading-snug text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                                {item.title}
                              </h2>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text)] dark:bg-slate-900">
                                  {item.typeLabel}
                                </span>
                                <span className="rounded-full bg-[color:color-mix(in_srgb,var(--app-accent)_10%,transparent)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-accent)]">
                                  {item.priceLabel}
                                </span>
                                {item.quantity > 1 ? (
                                  <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)] dark:bg-slate-900">
                                    x{item.quantity}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <span className="hidden shrink-0 text-[11px] font-semibold text-[color:var(--app-text-soft)] min-[420px]:inline">
                              {item.location}
                            </span>
                          </div>

                          {item.summary ? (
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                              {item.summary}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                        <button
                          type="button"
                          onClick={() => removeReference(item.id)}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] border-2 border-slate-300 bg-white px-3 text-sm font-black text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] dark:border-slate-700 dark:bg-slate-950"
                          aria-label={
                            locale === 'id'
                              ? 'Hapus favorit'
                              : 'Remove favorite'
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Link
                          href={item.href}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[color:var(--app-accent-strong)] px-3 text-sm font-black text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                        >
                          {item.actionLabel ||
                            (locale === 'id' ? 'Buka' : 'Open')}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : loading ? (
            <MyListingsListSkeleton count={3} />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              className="mt-3 px-3 py-6 sm:py-7"
              title={
                query
                  ? locale === 'id'
                    ? 'Tidak ketemu'
                    : 'No match'
                  : !phoneVerified
                    ? locale === 'id'
                      ? 'Verifikasi dulu'
                      : 'Verify your phone to start creating listings'
                    : locale === 'id'
                      ? 'Belum ada'
                      : 'No listings found for this status'
              }
              description={
                query
                  ? locale === 'id'
                    ? 'Coba kata lain atau pindah tab.'
                    : 'Try another keyword or switch tabs.'
                  : !phoneVerified
                    ? locale === 'id'
                      ? 'Nomor beres, tombol buat baru aktif.'
                      : 'After your active phone number is verified, posting a new offer becomes available again. Older drafts can still be reviewed here.'
                    : locale === 'id'
                      ? 'Buat baru atau pindah tab.'
                      : 'Start a new post or switch tabs to see the others.'
              }
              action={
                query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="inline-flex min-h-9 items-center rounded-xl border border-[color:var(--app-border-strong)] bg-white px-3 text-xs font-black text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:bg-slate-950"
                  >
                    {locale === 'id' ? 'Reset cari' : 'Reset search'}
                  </button>
                ) : (
                  <Link
                    href={createHref}
                    className="inline-flex min-h-9 items-center rounded-xl bg-[color:var(--app-accent-strong)] px-3 text-xs font-black text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                  >
                    {createLabel}
                  </Link>
                )
              }
            />
          ) : (
            <div className="mt-4 space-y-3">
              {filteredItems.map(item => {
                const id = parseId(item.id);
                const rawType = item.type || item.content_type || 'listing';
                const typeLabel = listingTypeLabel(rawType, locale);
                const rawStatus =
                  item.content_status || item.status || activeStatus;
                const itemStatus = listingStatusLabel(rawStatus, locale);
                const progress = readProgress(item);
                const imageUrl = resolveListingImage(item);
                const imageStyle = imageUrl
                  ? {
                      backgroundImage: `url("${imageUrl.replace(/"/g, '%22')}")`,
                    }
                  : undefined;

                return (
                  <div
                    key={item.id}
                    className="rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 shadow-[0_14px_32px_-26px_rgba(15,23,42,0.26)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/72"
                  >
                    <div className="flex gap-3">
                      <div
                        className="flex h-[86px] w-[86px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] bg-cover bg-center text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]"
                        style={imageStyle}
                        aria-label={imageUrl ? typeLabel : undefined}
                      >
                        {!imageUrl ? <ImageIcon className="h-6 w-6" /> : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="line-clamp-2 text-[15px] font-black leading-snug text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                              {item.title ||
                                (locale === 'id' ? 'Tanpa judul' : 'Untitled')}
                            </h2>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text)] dark:bg-slate-900">
                                {typeLabel}
                              </span>
                              <span className="rounded-full bg-[color:color-mix(in_srgb,var(--app-accent)_10%,transparent)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-accent)]">
                                {itemStatus}
                              </span>
                            </div>
                          </div>
                          <span className="hidden shrink-0 text-[11px] font-semibold text-[color:var(--app-text-soft)] min-[420px]:inline">
                            {formatDate(item.updated_at || item.created_at)}
                          </span>
                        </div>

                        {summarizeText(item.summary) ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                            {summarizeText(item.summary)}
                          </p>
                        ) : null}

                        {activeStatus === 'draft' ? (
                          <div className="mt-3">
                            <div className="h-2 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)] dark:bg-slate-900">
                              <div
                                className="h-full bg-[color:var(--app-warning)]"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                              {locale === 'id'
                                ? 'Progress'
                                : 'Current progress'}
                              : {progress}%
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {activeStatus === 'draft' ? (
                        <Link
                          href={`/create?draft=${id}`}
                          className="col-span-2 inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[color:var(--app-warning)] px-3 text-sm font-black text-[color:var(--app-text-inverse)]"
                        >
                          {locale === 'id' ? 'Lanjut isi' : 'Continue Draft'}
                        </Link>
                      ) : (
                        <>
                          <Link
                            href={`/create?draft=${id}`}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] border-2 border-slate-300 bg-white px-3 text-sm font-black text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-slate-700 dark:bg-slate-950"
                          >
                            {locale === 'id' ? 'Edit' : 'Edit'}
                          </Link>
                          <Link
                            href={`/content/${id}`}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[color:var(--app-accent-strong)] px-3 text-sm font-black text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                          >
                            {locale === 'id' ? 'Lihat' : 'View'}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CreateMarketplaceShell>
  );
}
