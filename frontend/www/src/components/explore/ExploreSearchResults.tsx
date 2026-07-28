'use client';

import { CircleAlert, PackageSearch } from 'lucide-react';

import { CompactSeeAllButton } from '@/components/common/CompactSectionAction';
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

function SearchSkeleton() {
  return (
    <section
      className="border-t border-[color:var(--app-border)] py-6"
      aria-hidden="true"
    >
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
}: {
  groupKey: GlobalSearchGroupKey;
  group: GlobalSearchGroup;
  locale: LajukanLocale;
  compact: boolean;
  onSelectTab?: (tab: GlobalSearchTab) => void;
}) {
  const isId = locale === 'id';
  if (!group.available || (group.items.length === 0 && !group.error))
    return null;
  const copy = SEARCH_GROUP_COPY[groupKey];
  const items = compact
    ? group.items.slice(0, groupKey === 'videos' ? 4 : 3)
    : group.items;

  return (
    <section className="border-t border-[color:var(--app-border)] py-6">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[color:var(--app-text)]">
            {isId ? copy.labelId : copy.labelEn}
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs leading-5 text-[color:var(--app-text-soft)]">
            {isId ? copy.descriptionId : copy.descriptionEn} {group.total}{' '}
            {isId ? 'hasil' : 'results'}.
          </p>
        </div>
        {compact && group.items.length > 0 && onSelectTab ? (
          <CompactSeeAllButton
            isId={isId}
            onClick={() => onSelectTab(groupKey)}
            aria-label={
              isId ? `Lihat semua ${copy.labelId}` : `View all ${copy.labelEn}`
            }
          />
        ) : null}
      </div>

      {group.error ? (
        <div className="mt-3 rounded-[8px] border border-dashed border-[color:var(--app-border-strong)] p-4 text-xs text-[color:var(--app-text-soft)]">
          {isId
            ? `Hasil ${copy.labelId.toLowerCase()} belum dapat dimuat. Bagian lain tetap tersedia.`
            : `${copy.labelEn} results are temporarily unavailable. Other sections remain available.`}
        </div>
      ) : (
        <div
          className={cn(
            'mt-4 grid gap-3',
            groupKey === 'videos'
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
              : groupKey === 'products' || groupKey === 'services'
                ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                : groupKey === 'needs'
                  ? 'sm:grid-cols-2 xl:grid-cols-3'
                  : groupKey === 'businesses' || groupKey === 'communities'
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
      )}
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
  onRetry,
}: {
  payload: GlobalSearchResponse;
  loading: boolean;
  error: boolean;
  locale: LajukanLocale;
  compact?: boolean;
  activeTab?: GlobalSearchTab;
  onSelectTab?: (tab: GlobalSearchTab) => void;
  onRetry?: () => void;
}) {
  const isId = locale === 'id';

  if (loading) return <SearchSkeleton />;

  if (error) {
    return (
      <section className="border-t border-[color:var(--app-border)] py-8">
        <div className="flex flex-col items-start gap-4 rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
              <CircleAlert className="h-4 w-4 text-amber-600" />
              {isId
                ? 'Hasil belum bisa dimuat.'
                : 'Results could not be loaded.'}
            </p>
            <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
              {isId ? 'Coba lagi sebentar.' : 'Please retry in a moment.'}
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

  if (payload.total === 0) {
    return (
      <section className="border-t border-[color:var(--app-border)] py-8">
        <div className="rounded-[8px] border border-dashed border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
            <PackageSearch className="h-4 w-4 text-[color:var(--app-accent)]" />
            {isId ? 'Belum ada hasil yang cocok.' : 'No matching results yet.'}
          </p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Coba kata kunci lain, pilih kategori, atau tulis kebutuhan agar penyedia bisa menanggapi.'
              : 'Try another keyword, choose a category, or post a need so providers can respond.'}
          </p>
        </div>
      </section>
    );
  }

  const groups =
    activeTab === 'all'
      ? SEARCH_GROUPS
      : SEARCH_GROUPS.filter(groupKey => groupKey === activeTab);

  return (
    <>
      {groups.map(groupKey => (
        <SearchGroupSection
          key={groupKey}
          groupKey={groupKey}
          group={payload.groups[groupKey]}
          locale={locale}
          compact={compact && activeTab === 'all'}
          onSelectTab={onSelectTab}
        />
      ))}
    </>
  );
}
