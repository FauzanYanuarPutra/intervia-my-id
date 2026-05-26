'use client';
import { useState } from 'react';
import { LajukanImage as Image } from '@/components/common/LajukanImage';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CONTENT_TYPES, getContentTypeName } from '@/data/contentTypes';
import { getSectorLabel, useSectors } from '@/context/SectorContext';
import { findSubSector, getSubSectorName } from '@/data/subSectors';
import { WORK_MODE_OPTIONS } from '@/data/sectorFields';
import { defaultImageForContent, parseImages } from '@/lib/content/catalog';
import { createPromotionSnapshot } from '@/lib/content/promotionPrograms';
import { BadgePercent, Gift, Star, Trophy } from 'lucide-react';

type ContentItem = {
  id: string;
  type?: string;
  title: string;
  summary?: string | null;
  slug?: string | null;
  tags?: string[];
  price_cents?: number | null;
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
  const fallbackThumbnail = defaultImageForContent(
    item as Parameters<typeof defaultImageForContent>[0],
  );
  const imageCandidates = [...thumbnails, fallbackThumbnail].filter(
    (entry, index, source) => Boolean(entry) && source.indexOf(entry) === index,
  );
  const imageCandidateKey = imageCandidates.join('|');
  const [imageState, setImageState] = useState({ key: '', index: 0 });
  const imageIndex =
    imageState.key === imageCandidateKey ? imageState.index : 0;
  const imageSrc = imageCandidates[imageIndex] || null;

  const meta = item.metadata as Record<string, unknown> | null;
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
  const ratingValue =
    typeof item.rating === 'number'
      ? item.rating
      : typeof item.seller_stats?.rating === 'number'
        ? item.seller_stats.rating
        : 0;
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
        {imageSrc && (
          <div className="relative hidden h-20 w-20 shrink-0 overflow-hidden rounded bg-[color:var(--app-surface-muted)] sm:block sm:h-24 sm:w-24 dark:bg-[color:var(--app-surface-strong)]">
            <Image
              src={imageSrc}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
              unoptimized
              onError={() => {
                setImageState(current => {
                  const currentIndex =
                    current.key === imageCandidateKey ? current.index : 0;
                  const nextIndex =
                    currentIndex + 1 < imageCandidates.length
                      ? currentIndex + 1
                      : currentIndex;
                  return { key: imageCandidateKey, index: nextIndex };
                });
              }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {/* Content Type Badge */}
          {ct && (
            <div className="mb-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] uppercase flex items-center gap-1 inline-flex">
                <ct.icon className="w-2.5 h-2.5" />
                {getContentTypeName(ct, locale)}
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
            {item.price_cents != null && (
              <span className="font-semibold text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
                {item.currency || 'IDR'}{' '}
                {(item.price_cents / 100).toLocaleString()}
              </span>
            )}
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
            {ratingValue > 0 && (
              <span className="flex items-center gap-1 text-[color:var(--app-warning)] dark:text-[color:var(--app-warning)]">
                <Star className="w-3 h-3 fill-current" />
                {ratingValue.toFixed(1)} ({reviewCount || 0})
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
