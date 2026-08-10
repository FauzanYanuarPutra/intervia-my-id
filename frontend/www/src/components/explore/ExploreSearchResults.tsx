'use client';

import {
  ArrowRight,
  CircleAlert,
  Database,
  ExternalLink,
  MapPin,
  PackageSearch,
  ShieldCheck,
} from 'lucide-react';

import { CompactSeeAllButton } from '@/components/common/CompactSectionAction';
import { ExploreCardMedia } from '@/components/explore/cards/ExploreCardMedia';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { BusinessSearchCard } from '@/components/search/result-cards/BusinessSearchCard';
import { CommunitySearchCard } from '@/components/search/result-cards/CommunitySearchCard';
import { NeedSearchCard } from '@/components/search/result-cards/NeedSearchCard';
import { ProductSearchCard } from '@/components/search/result-cards/ProductSearchCard';
import { ServiceSearchCard } from '@/components/search/result-cards/ServiceSearchCard';
import { UserSearchCard } from '@/components/search/result-cards/UserSearchCard';
import { VideoSearchCard } from '@/components/search/result-cards/VideoSearchCard';
import type {
  GlobalSearchGroup,
  GlobalSearchGroupKey,
  GlobalSearchItem,
  GlobalSearchResponse,
  GlobalSearchTab,
} from '@/lib/search/globalSearch';
import type { LajukanLocale } from '@/lib/discovery/lajukanCategories';
import { cn } from '@/lib/utils';

const SEARCH_GROUPS: GlobalSearchGroupKey[] = [
  'products',
  'services',
  'businesses',
  'references',
  'needs',
  'communities',
  'videos',
  'users',
];

const SEARCH_GROUP_COPY: Record<
  GlobalSearchGroupKey,
  {
    labelId: string;
    labelEn: string;
    descriptionId: string;
    descriptionEn: string;
  }
> = {
  products: {
    labelId: 'Produk',
    labelEn: 'Products',
    descriptionId: 'Bahan, stok, alat, dan barang yang bisa dibandingkan.',
    descriptionEn: 'Materials, stock, tools, and goods you can compare.',
  },
  services: {
    labelId: 'Jasa',
    labelEn: 'Services',
    descriptionId: 'Penyedia jasa operasional, kreatif, teknis, dan usaha.',
    descriptionEn: 'Operational, creative, technical, and business services.',
  },
  businesses: {
    labelId: 'Usaha',
    labelEn: 'Businesses',
    descriptionId: 'Toko, UMKM, dan profil penyedia yang relevan.',
    descriptionEn: 'Relevant stores, MSMEs, and provider profiles.',
  },
  references: {
    labelId: 'Referensi tempat usaha',
    labelEn: 'Business place references',
    descriptionId: 'Data lokasi untuk acuan, bukan daftar toko aktif.',
    descriptionEn: 'Location data for reference, not a list of active stores.',
  },
  needs: {
    labelId: 'Kebutuhan',
    labelEn: 'Needs',
    descriptionId: 'Permintaan aktif dari pembeli atau pencari penyedia.',
    descriptionEn: 'Active requests from buyers or seekers.',
  },
  communities: {
    labelId: 'Komunitas',
    labelEn: 'Communities',
    descriptionId: 'Grup dan diskusi untuk belajar, tanya jawab, dan jejaring.',
    descriptionEn: 'Groups and discussions for learning and networking.',
  },
  videos: {
    labelId: 'Video',
    labelEn: 'Videos',
    descriptionId: 'Konten singkat untuk inspirasi dan edukasi usaha.',
    descriptionEn: 'Short content for business inspiration and education.',
  },
  users: {
    labelId: 'Orang',
    labelEn: 'Users',
    descriptionId: 'Profil orang dan pelaku usaha yang bisa dicek.',
    descriptionEn: 'People and business owner profiles you can inspect.',
  },
};

function ReferenceNextBatchAction({
  cursor,
  isId,
  onNextCursor,
}: {
  cursor: string;
  isId: boolean;
  onNextCursor: (cursor: string) => void;
}) {
  return (
    <div className="mt-5 flex flex-col items-start gap-2 border-t border-[color:var(--app-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] leading-5 text-[color:var(--app-text-soft)]">
        {isId
          ? 'Daftar berikutnya akan mengganti hasil saat ini agar halaman tetap ringan.'
          : 'The next list replaces the current results to keep this page lightweight.'}
      </p>
      <button
        type="button"
        onClick={() => onNextCursor(cursor)}
        className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[color:var(--app-accent)] px-4 text-xs font-black text-white transition hover:bg-[color:var(--app-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2"
      >
        {isId ? 'Muat berikutnya' : 'Load next'}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function metadataText(item: GlobalSearchItem, key: string): string {
  const metadata = item.metadata || {};
  const value = metadata[key];
  return typeof value === 'string' ? value.trim() : '';
}

function isValidPublicReference(item: GlobalSearchItem): boolean {
  if (item.kind !== 'references') return false;
  if (item.metadata?.isTransactional === true) return false;

  return Boolean(
    metadataText(item, 'sourceTitle') &&
      safeExternalHref(metadataText(item, 'sourceUrl')) &&
      metadataText(item, 'sourceLicense') &&
      safeExternalHref(metadataText(item, 'sourceLicenseUrl')),
  );
}

function formatResultCount(value: number, locale: LajukanLocale): string {
  return Math.max(Number(value || 0), 0).toLocaleString(
    locale === 'id' ? 'id-ID' : 'en-US',
  );
}

function safeExternalHref(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}

function PublicReferenceCard({
  item,
  locale,
}: {
  item: GlobalSearchItem;
  locale: LajukanLocale;
}) {
  const isId = locale === 'id';
  const sourceTitle = metadataText(item, 'sourceTitle');
  const sourceUrl = safeExternalHref(metadataText(item, 'sourceUrl'));
  const sourceLicense = metadataText(item, 'sourceLicense');
  const sourceLicenseUrl = safeExternalHref(
    metadataText(item, 'sourceLicenseUrl'),
  );
  const imageAttribution = metadataText(item, 'imageAttribution');
  const imageSourceUrl = safeExternalHref(
    metadataText(item, 'imageSourceUrl'),
  );
  const distanceKm = item.metadata?.distanceKm;
  const distanceLabel =
    typeof distanceKm === 'number' && Number.isFinite(distanceKm)
      ? `${distanceKm.toLocaleString(isId ? 'id-ID' : 'en-US', {
          maximumFractionDigits: 1,
        })} km`
      : '';

  return (
    <article
      data-testid="public-reference-card"
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-amber-200/80 bg-[color:var(--app-surface-strong)] shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)]"
    >
      <div className="relative">
        <Link
          href={item.href}
          aria-label={
            isId
              ? `Buka catatan referensi ${item.title}`
              : `Open reference record ${item.title}`
          }
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--app-accent)]"
        >
          <ExploreCardMedia
            src={item.image}
            alt={item.title}
            attribution={imageAttribution}
            sourceHref={imageSourceUrl || undefined}
            fallbackLabel={
              isId ? 'Referensi lokasi publik' : 'Public location reference'
            }
            className="aspect-[16/9] w-full"
          />
        </Link>
        <span className="absolute left-2 top-2 inline-flex min-h-7 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/95 px-2.5 text-[10px] font-black text-amber-900 shadow-sm backdrop-blur">
          <Database className="h-3.5 w-3.5" aria-hidden="true" />
          {isId ? 'Data lokasi publik' : 'Public location data'}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-[color:var(--app-text-soft)]">
          <span className="truncate">{item.label}</span>
          {distanceLabel ? (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[color:var(--app-accent)]">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {distanceLabel}
            </span>
          ) : null}
        </div>

        <Link
          href={item.href}
          className="mt-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
        >
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-[color:var(--app-text)] transition hover:text-[color:var(--app-accent)]">
            {item.title}
          </h3>
        </Link>

        {item.location ? (
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[color:var(--app-text-soft)]">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.location}</span>
          </p>
        ) : null}

        {item.summary ? (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
            {item.summary}
          </p>
        ) : null}

        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-amber-950">
          {isId
            ? 'Bukan toko atau penawaran aktif. Stok, harga, kontak, dan status verifikasi tidak tersedia.'
            : 'Not an active store or offer. Stock, prices, contact details, and verification status are unavailable.'}
        </p>

        <div className="mt-auto grid gap-1.5 pt-3 text-[10px] font-bold">
          {sourceTitle && sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-md border border-[color:var(--app-border)] px-2 text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
            >
              <Database className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {isId ? 'Sumber: ' : 'Source: '}
                {sourceTitle}
              </span>
              <ExternalLink className="ml-auto h-3 w-3 shrink-0" aria-hidden="true" />
            </a>
          ) : null}
          {sourceLicense && sourceLicenseUrl ? (
            <a
              href={sourceLicenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-md border border-[color:var(--app-border)] px-2 text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {isId ? 'Lisensi: ' : 'License: '}
                {sourceLicense}
              </span>
              <ExternalLink className="ml-auto h-3 w-3 shrink-0" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SearchSkeleton({ locale }: { locale: LajukanLocale }) {
  return (
    <section
      className="border-t border-[color:var(--app-border)] py-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">
        {locale === 'id' ? 'Memuat hasil pencarian.' : 'Loading search results.'}
      </span>
      <div className="h-5 w-40 animate-pulse rounded bg-[color:var(--app-border)]" />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-44 animate-pulse rounded-lg bg-[color:var(--app-border)]"
          />
        ))}
      </div>
    </section>
  );
}

function renderSearchCard(item: GlobalSearchItem, locale: LajukanLocale) {
  if (item.kind === 'products')
    return <ProductSearchCard item={item} locale={locale} />;
  if (item.kind === 'services')
    return <ServiceSearchCard item={item} locale={locale} />;
  if (item.kind === 'businesses')
    return <BusinessSearchCard item={item} locale={locale} />;
  if (item.kind === 'references')
    return <PublicReferenceCard item={item} locale={locale} />;
  if (item.kind === 'needs')
    return <NeedSearchCard item={item} locale={locale} />;
  if (item.kind === 'communities')
    return <CommunitySearchCard item={item} locale={locale} />;
  if (item.kind === 'videos') return <VideoSearchCard item={item} />;
  return <UserSearchCard item={item} locale={locale} />;
}

function SearchGroupSection({
  groupKey,
  group,
  locale,
  compact,
  onSelectTab,
  onNextCursor,
}: {
  groupKey: GlobalSearchGroupKey;
  group: GlobalSearchGroup;
  locale: LajukanLocale;
  compact: boolean;
  onSelectTab?: (tab: GlobalSearchTab) => void;
  onNextCursor?: (cursor: string) => void;
}) {
  const isId = locale === 'id';
  const safeItems =
    groupKey === 'references'
      ? group.items.filter(isValidPublicReference)
      : group.items;
  if (!group.available || (safeItems.length === 0 && !group.error)) return null;
  const copy = SEARCH_GROUP_COPY[groupKey];
  const items = compact
    ? safeItems.slice(0, groupKey === 'videos' ? 4 : 3)
    : safeItems;
  const displayedTotal =
    groupKey === 'references'
      ? safeItems.length
      : Math.max(group.total, safeItems.length);

  return (
    <section className="border-t border-[color:var(--app-border)] py-6">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[color:var(--app-text)]">
            {isId ? copy.labelId : copy.labelEn}
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs leading-5 text-[color:var(--app-text-soft)]">
            {isId ? copy.descriptionId : copy.descriptionEn}{' '}
            {isId ? 'Menampilkan' : 'Showing'}{' '}
            {formatResultCount(displayedTotal, locale)}.
          </p>
        </div>
        {compact && safeItems.length > 0 && onSelectTab ? (
          <CompactSeeAllButton
            isId={isId}
            label={isId ? 'Lihat semua' : 'View all'}
            className="h-11 min-h-11"
            onClick={() => onSelectTab(groupKey)}
            aria-label={
              isId ? `Lihat semua ${copy.labelId}` : `View all ${copy.labelEn}`
            }
          />
        ) : null}
      </div>

      {group.error ? (
        <div
          role="status"
          className="mt-3 rounded-[8px] border border-dashed border-[color:var(--app-border-strong)] p-4 text-xs text-[color:var(--app-text-soft)]"
        >
          {isId
            ? `Sebagian hasil ${copy.labelId.toLowerCase()} belum dapat dimuat. Hasil yang sudah tersedia tetap ditampilkan.`
            : `Some ${copy.labelEn.toLowerCase()} results could not be loaded. Available results remain visible.`}
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          <div
            className={cn(
              'mt-4 grid gap-3',
              groupKey === 'videos'
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                : groupKey === 'products' || groupKey === 'services'
                  ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  : groupKey === 'needs'
                    ? 'sm:grid-cols-2 xl:grid-cols-3'
                    : groupKey === 'businesses' ||
                        groupKey === 'references' ||
                        groupKey === 'communities'
                      ? 'sm:grid-cols-2 lg:grid-cols-3'
                      : 'sm:grid-cols-2 xl:grid-cols-3',
            )}
          >
            {items.map(item => (
              <div key={`${item.kind}-${item.id}`}>
                {renderSearchCard(item, locale)}
              </div>
            ))}
          </div>
          {!compact &&
          groupKey === 'references' &&
          group.nextCursor &&
          onNextCursor ? (
            <ReferenceNextBatchAction
              cursor={group.nextCursor}
              isId={isId}
              onNextCursor={onNextCursor}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function ExploreSearchResults({
  payload,
  loading,
  error,
  locale,
  compact = true,
  activeTab = 'all',
  onSelectTab,
  onNextCursor,
  onRetry,
}: {
  payload: GlobalSearchResponse;
  loading: boolean;
  error: boolean;
  locale: LajukanLocale;
  compact?: boolean;
  activeTab?: GlobalSearchTab;
  onSelectTab?: (tab: GlobalSearchTab) => void;
  onNextCursor?: (cursor: string) => void;
  onRetry?: () => void;
}) {
  const isId = locale === 'id';
  const groups =
    activeTab === 'all'
      ? SEARCH_GROUPS
      : SEARCH_GROUPS.filter(groupKey => groupKey === activeTab);
  const visibleGroups = groups.filter(groupKey => {
    const group = payload.groups[groupKey];
    if (!group.available) return false;
    if (groupKey === 'references') {
      return group.items.some(isValidPublicReference) || Boolean(group.error);
    }
    return group.items.length > 0 || Boolean(group.error);
  });
  const availableFilterGroups = SEARCH_GROUPS.filter(groupKey => {
    if (groupKey === 'references') return false;
    const group = payload.groups[groupKey];
    return (
      group.available && (group.items.length > 0 || Boolean(group.error))
    );
  });
  const selectedGroup =
    activeTab === 'all' ? null : payload.groups[activeTab as GlobalSearchGroupKey];
  const visibleTotal =
    activeTab === 'all'
      ? visibleGroups.reduce((total, groupKey) => {
          const group = payload.groups[groupKey];
          if (groupKey === 'references') {
            return total + group.items.filter(isValidPublicReference).length;
          }
          return total + Math.max(group.total, group.items.length);
        }, 0)
      : activeTab === 'references'
        ? payload.groups.references.items.filter(isValidPublicReference).length
        : Math.max(selectedGroup?.total || 0, selectedGroup?.items.length || 0);
  const referenceNextCursor =
    activeTab === 'references'
      ? payload.groups.references.nextCursor
      : null;
  const hasRenderableResults = visibleTotal > 0 || visibleGroups.length > 0;

  if (loading && !hasRenderableResults) return <SearchSkeleton locale={locale} />;

  if (error && !hasRenderableResults) {
    return (
      <section className="border-t border-[color:var(--app-border)] py-8">
        <div
          role="alert"
          className="flex flex-col items-start gap-4 rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
              <CircleAlert className="h-4 w-4 text-amber-600" />
              {isId
                ? 'Hasil belum bisa dimuat.'
                : 'Results could not be loaded.'}
            </p>
            <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
              {isId ? 'Periksa koneksi lalu coba lagi.' : 'Check your connection and retry.'}
            </p>
          </div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-10 cursor-pointer rounded-[8px] border border-[color:var(--app-border)] px-4 text-xs font-bold transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
            >
              {isId ? 'Coba lagi' : 'Retry'}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  if (!hasRenderableResults) {
    return (
      <section className="border-t border-[color:var(--app-border)] py-8">
        <div
          role="status"
          className="rounded-[8px] border border-dashed border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] p-5"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
            <PackageSearch className="h-4 w-4 text-[color:var(--app-accent)]" />
            {isId ? 'Belum ada hasil yang cocok.' : 'No matching results yet.'}
          </p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
            {activeTab === 'references'
              ? isId
                ? 'Coba nama usaha, jenis tempat, atau kota lain. Hanya data dengan sumber dan lisensi yang jelas yang ditampilkan.'
                : 'Try another business name, place type, or city. Only data with a clear source and license is shown.'
              : activeTab !== 'all'
                ? isId
                  ? `Belum ada hasil ${SEARCH_GROUP_COPY[activeTab as GlobalSearchGroupKey]?.labelId.toLowerCase() || 'jenis ini'}. Coba lihat semua hasil.`
                  : 'There are no results of this type yet. Try viewing all results.'
                : isId
                  ? 'Coba kata yang lebih singkat, pilih kategori lain, atau tulis kebutuhanmu.'
                  : 'Try another keyword, choose a category, or post a need so providers can respond.'}
          </p>
          {activeTab !== 'all' && activeTab !== 'references' && onSelectTab ? (
            <button
              type="button"
              onClick={() => onSelectTab('all')}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white hover:bg-[color:var(--app-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2"
            >
              {isId ? 'Lihat semua hasil' : 'View all results'}
            </button>
          ) : activeTab === 'all' ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/explore"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-xs font-bold text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
              >
                {isId ? 'Pilih kategori' : 'Choose a category'}
              </Link>
              <Link
                href="/create?side=demand"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white hover:bg-[color:var(--app-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2"
              >
                {isId ? 'Tulis kebutuhan' : 'Post a need'}
              </Link>
            </div>
          ) : null}
          {referenceNextCursor && onNextCursor ? (
            <ReferenceNextBatchAction
              cursor={referenceNextCursor}
              isId={isId}
              onNextCursor={onNextCursor}
            />
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <div aria-busy={loading} aria-live="polite">
      {onSelectTab && activeTab !== 'references' ? (
        <nav
          aria-label={isId ? 'Jenis hasil pencarian' : 'Search result type'}
          className="mt-4 flex min-w-0 gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            onClick={() => onSelectTab('all')}
            aria-pressed={activeTab === 'all'}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]',
              activeTab === 'all'
                ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)]',
            )}
          >
            {isId ? 'Semua hasil' : 'All results'}
          </button>
          {availableFilterGroups.map(groupKey => {
            const copy = SEARCH_GROUP_COPY[groupKey];
            const active = activeTab === groupKey;
            return (
              <button
                key={groupKey}
                type="button"
                onClick={() => onSelectTab(groupKey)}
                aria-pressed={active}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]',
                  active
                    ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                    : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)]',
                )}
              >
                {isId ? copy.labelId : copy.labelEn}
              </button>
            );
          })}
        </nav>
      ) : null}

      {loading || error ? (
        <div
          role="status"
          className={cn(
            'mt-5 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs font-semibold',
            error
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)]',
          )}
        >
          <span>
            {error
              ? isId
                ? 'Pembaruan gagal. Hasil terakhir yang tersedia tetap ditampilkan.'
                : 'Refresh failed. The latest available results remain visible.'
              : isId
                ? 'Memperbarui hasil…'
                : 'Refreshing results…'}
          </span>
          {error && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 rounded-md px-2 py-1 font-bold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
            >
              {isId ? 'Coba lagi' : 'Retry'}
            </button>
          ) : null}
        </div>
      ) : null}

      {groups.map(groupKey => (
        <SearchGroupSection
          key={groupKey}
          groupKey={groupKey}
          group={payload.groups[groupKey]}
          locale={locale}
          compact={compact && activeTab === 'all'}
          onSelectTab={onSelectTab}
          onNextCursor={onNextCursor}
        />
      ))}
    </div>
  );
}
