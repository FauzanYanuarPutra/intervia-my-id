'use client';
import { MediaPreviewCarousel } from '@/components/common/MediaPreviewCarousel';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CONTENT_TYPES, getContentTypeName } from '@/data/contentTypes';
import { getSectorLabel, useSectors } from '@/context/SectorContext';
import { findSubSector, getSubSectorName } from '@/data/subSectors';
import { WORK_MODE_OPTIONS } from '@/data/sectorFields';
import { parseImages } from '@/lib/content/catalog';
import {
  getListingSideContextLabel,
  getListingSideVerbLabel,
  getListingValueFallback,
  resolveListingSide,
} from '@/lib/content/listingSide';
import { createPromotionSnapshot } from '@/lib/content/promotionPrograms';
import { BadgePercent, Gift, Heart, Trophy } from 'lucide-react';

type ContentItem = {
  id: string;
  type?: string;
  title: string;
  summary?: string | null;
  slug?: string | null;
  tags?: string[];
  price_cents?: number | null;
  pricing_mode?: string | null;
  currency?: string;
  cover_image?: string | null;
  metadata?: Record<string, unknown> | null;
  rating?: number | null;
  review_count?: number | null;
  seller_stats?: {
    rating?: number | null;
    review_count?: number | null;
  } | null;
};

function getImageCandidates(item: ContentItem): string[] {
  const seen = new Set<string>();
  return parseImages(item as Parameters<typeof parseImages>[0]).filter(
    entry => {
      const key = String(entry || '')
        .trim()
        .toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    },
  );
}

function readMetadataText(
  metadata: Record<string, unknown> | null,
  ...keys: string[]
): string {
  if (!metadata) return '';
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value))
      return String(value);
  }
  return '';
}

export default function SearchResultCard({
  item,
  buildUrl,
}: {
  item: ContentItem;
  buildUrl: (item: ContentItem) => string;
}) {
  const locale = useLocale() || 'id';
  const { getSectorById } = useSectors();
  const thumbnails = getImageCandidates(item);
  const imageCandidates = thumbnails.filter(
    (entry, index, source) => Boolean(entry) && source.indexOf(entry) === index,
  );
  const hasImages = imageCandidates.length > 0;

  const meta = item.metadata as Record<string, unknown> | null;
  const listingSide = resolveListingSide({
    type: item.type,
    metadata: meta,
    title: item.title,
    summary: item.summary,
  });
  const isDemandListing = listingSide === 'demand';
  const sectorId = meta?.sector as string | undefined;
  const subSectorId = meta?.sub_sector as string | undefined;
  const sector = sectorId ? getSectorById(sectorId) : null;
  const subSector =
    sectorId && subSectorId ? findSubSector(sectorId, subSectorId) : null;
  const workModeId = meta?.work_mode as string | undefined;
  const workModeOpt = workModeId
    ? WORK_MODE_OPTIONS.find(w => w.value === workModeId)
    : null;
  const ct = CONTENT_TYPES.find(c => c.id === (item.type || 'product'));
  const localeCode = locale === 'id' ? 'id' : 'en';
  const reviewCount =
    typeof item.review_count === 'number'
      ? item.review_count
      : typeof item.seller_stats?.review_count === 'number'
        ? item.seller_stats.review_count
        : 0;
  const promotionSnapshot = createPromotionSnapshot(
    meta?.promotion,
    typeof item.price_cents === 'number' ? item.price_cents : undefined,
    localeCode,
  );
  const valueLabel = isDemandListing
    ? readMetadataText(meta, 'budget_label', 'budget_range', 'budget') ||
      getListingValueFallback('demand', localeCode, item.type)
    : item.price_cents != null
      ? `${item.currency || 'IDR'} ${(item.price_cents / 100).toLocaleString()}`
      : readMetadataText(meta, 'price_label', 'rate_label') ||
        getListingValueFallback('supply', localeCode, item.type);
  const sideToneClass = isDemandListing
    ? 'border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200'
    : 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200';
  const PromotionIcon =
    promotionSnapshot?.offerType === 'discount'
      ? BadgePercent
      : promotionSnapshot?.offerType === 'loyalty_card'
        ? Gift
        : Trophy;
  const showPromotionChip =
    Boolean(promotionSnapshot?.offerType) &&
    Boolean(promotionSnapshot?.promoLabel);

  const url = buildUrl(item);

  return (
    <div className="py-4 sm:py-5">
      <div className="flex gap-4 sm:gap-6">
        {/* Thumbnail - optional, small */}
        {hasImages && (
          <div className="relative hidden h-20 w-20 shrink-0 overflow-hidden rounded bg-[color:var(--app-surface-muted)] sm:block sm:h-24 sm:w-24 dark:bg-[color:var(--app-surface-strong)]">
            <MediaPreviewCarousel
              items={imageCandidates}
              alt=""
              aspectClassName="h-full w-full"
              className="h-full w-full bg-transparent"
              sizes="96px"
              controls={false}
              lightbox={false}
              showCounter={imageCandidates.length > 1}
              showDots={imageCandidates.length > 1}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {/* Content Type Badge */}
          {ct && (
            <div className="mb-1 flex flex-wrap gap-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] uppercase flex items-center gap-1 inline-flex">
                <ct.icon className="w-2.5 h-2.5" />
                {getContentTypeName(ct, locale)}
              </span>
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${sideToneClass}`}
              >
                {getListingSideVerbLabel(listingSide, localeCode)} -{' '}
                {getListingSideContextLabel(
                  listingSide,
                  item.type || meta?.type,
                  localeCode,
                )}
              </span>
            </div>
          )}
          {/* Title */}
          <Link href={url} className="block group mb-1">
            <h3 className="text-xl sm:text-2xl font-normal text-[color:var(--app-info)] dark:text-[color:var(--app-info)] group-hover:underline leading-snug line-clamp-2">
              {item.title}
            </h3>
          </Link>
          {/* Snippet */}
          {item.summary && (
            <p className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] leading-relaxed line-clamp-2 sm:line-clamp-3 mb-3">
              <span className="text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] font-medium">
                {item.summary.split(' ').slice(0, 3).join(' ')}
              </span>{' '}
              {item.summary.split(' ').slice(3).join(' ')}
            </p>
          )}
          {showPromotionChip && promotionSnapshot && (
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-warning)]">
                <PromotionIcon className="h-3 w-3" />
                {promotionSnapshot.promoLabel}
              </span>
              <span className="inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text)]">
                {promotionSnapshot.offerType === 'loyalty_card'
                  ? locale === 'id'
                    ? 'Repeat order'
                    : 'Repeat orders'
                  : promotionSnapshot.offerType === 'raffle'
                    ? locale === 'id'
                      ? 'Campaign seru'
                      : 'Exciting campaign'
                    : locale === 'id'
                      ? 'Benefit aktif'
                      : 'Active benefit'}
              </span>
            </div>
          )}
          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            <span
              className={`font-semibold ${
                isDemandListing
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]'
              }`}
            >
              {valueLabel}
            </span>
            {sector && (
              <span className="flex items-center gap-1">
                <sector.icon className="w-3 h-3" />
                {getSectorLabel(sector, locale)}
              </span>
            )}
            {subSector && <span>{getSubSectorName(subSector, locale)}</span>}
            {workModeOpt &&
              (item.type === 'job' || item.type === 'service') && (
                <span className="flex items-center gap-1">
                  {workModeOpt.icon}{' '}
                  {locale === 'id' ? workModeOpt.shortId : workModeOpt.shortEn}
                </span>
              )}
            {reviewCount > 0 && (
              <span className="flex items-center gap-1 text-[color:var(--app-warning)] dark:text-[color:var(--app-warning)]">
                <Heart className="h-3 w-3 fill-current" />
                {reviewCount.toLocaleString(
                  localeCode === 'id' ? 'id-ID' : 'en-US',
                )}{' '}
                likes
              </span>
            )}
            {item.tags && item.tags.length > 0 && (
              <span className="text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text)]">
                {item.tags.slice(0, 3).join(' - ')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
