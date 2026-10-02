'use client';

import { ArrowRight, BadgeCheck, Clock3, MapPin, Package2, Pencil, Store, Wrench } from 'lucide-react';

import { ExploreCardMedia } from '@/components/explore/cards/ExploreCardMedia';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { NeedSearchCard } from '@/components/search/result-cards/NeedSearchCard';
import { getSideLabel } from '@/components/search/result-cards/SearchCardParts';
import { getListingValueFallback } from '@/lib/content/listingSide';
import {
  formatPriceWithUnit,
  priceUnitLabel,
} from '@/lib/content/priceUnit';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import { cn } from '@/lib/utils';
import { useOptionalAuth } from '@/context/AuthContext';

const PUBLIC_MEDIA_BASE = 'https://www.lajukan.com/api/content/media';

function normalizeMediaUrl(value?: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith(`${PUBLIC_MEDIA_BASE}/`)) return raw;
  if (raw.startsWith('/api/content/media/')) return `https://www.lajukan.com${raw}`;
  if (raw.startsWith('/laju-chat/')) return `${PUBLIC_MEDIA_BASE}${raw}`;

  try {
    const url = new URL(raw);
    const pathname = url.pathname;
    if (pathname.startsWith('/laju-chat/')) {
      return `${PUBLIC_MEDIA_BASE}${pathname}${url.search}${url.hash}`;
    }
    if (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '0.0.0.0'
    ) {
      return `${PUBLIC_MEDIA_BASE}${pathname}${url.search}${url.hash}`;
    }
    return url.toString();
  } catch {
    return raw.startsWith('laju-chat/') ? `${PUBLIC_MEDIA_BASE}/${raw}` : raw;
  }
}

export function ExploreListingCard({
  item,
  locale,
  interactive = true,
}: {
  item: GlobalSearchItem;
  locale: 'id' | 'en';
  interactive?: boolean;
}) {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const isNeed = item.side === 'demand' || item.kind === 'needs';

  if (isNeed) {
    return <NeedSearchCard item={item} locale={locale} interactive={interactive} />;
  }

  const imageAttribution =
    typeof item.metadata.imageAttribution === 'string'
      ? item.metadata.imageAttribution
      : '';
  const imageSrc = normalizeMediaUrl(item.image);
  const listingType = item.metadata.contentType || item.kind;
  const isService =
    item.kind === 'services' ||
    String(listingType).toLowerCase().includes('service');
  const ListingIcon = isService ? Wrench : Package2;
  const sideLabel =
    getSideLabel(item, locale) || (locale === 'id' ? 'Menawarkan' : 'Offering');

  const rawTypeLabel = String(item.label || listingType || '').trim();
  const typeLabel =
    /service|jasa/i.test(rawTypeLabel) || isService
      ? locale === 'id'
        ? 'Jasa'
        : 'Service'
      : /product|produk|barang/i.test(rawTypeLabel)
        ? locale === 'id'
          ? 'Produk'
          : 'Product'
        : rawTypeLabel ||
          (locale === 'id' ? 'Penawaran' : 'Offering');

  const baseValueLabel =
    item.priceLabel ||
    getListingValueFallback('supply', locale, String(listingType));
  const resolvedPriceUnit = priceUnitLabel(
    item.metadata.priceUnit ||
      item.metadata.price_unit ||
      item.metadata.unit ||
      item.metadata.unit_label,
    locale,
  );
  const valueLabel = formatPriceWithUnit(baseValueLabel, resolvedPriceUnit);

  const normalizedStatus = String(
    item.metadata.contentStatus ||
      item.metadata.content_status ||
      item.metadata.status ||
      'active',
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  const isPublic =
    normalizedStatus === 'active' ||
    normalizedStatus === 'published' ||
    normalizedStatus === 'live';

  const ownerId = String(
    item.metadata.ownerId ||
      item.metadata.owner_id ||
      '',
  )
    .trim()
    .toLowerCase();

  const viewerId = String(user?.id || '').trim().toLowerCase();
  const isOwner = Boolean(viewerId && ownerId && viewerId === ownerId);
  const destinationHref = isPublic
    ? item.href
    : isOwner
      ? '/create?draft=' + encodeURIComponent(item.id)
      : '';

  const statusLabel =
    normalizedStatus === 'draft'
      ? locale === 'id'
        ? 'Draft'
        : 'Draft'
      : ['pending', 'pending_review', 'review'].includes(normalizedStatus)
        ? locale === 'id'
          ? 'Menunggu ditinjau'
          : 'Under review'
        : ['paused', 'inactive'].includes(normalizedStatus)
          ? locale === 'id'
            ? 'Dijeda'
            : 'Paused'
          : ['archived', 'deleted'].includes(normalizedStatus)
            ? locale === 'id'
              ? 'Diarsipkan'
              : 'Archived'
            : locale === 'id'
              ? 'Belum tayang'
              : 'Not published';

  const actionLabel =
    isOwner && !isPublic
      ? locale === 'id'
        ? 'Edit & tayangkan'
        : 'Edit & publish'
      : locale === 'id'
        ? 'Lihat detail'
        : 'View details';

  const card = (
    <article
      data-testid="canonical-listing-card"
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_12px_28px_-26px_rgba(15,23,42,0.38)]',
        interactive &&
          'cursor-pointer transition-[transform,border-color,box-shadow] duration-200 motion-reduce:transform-none hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.32)]',
      )}
    >
      <div className="relative">
        <ExploreCardMedia
          src={imageSrc}
          alt={item.title}
          attribution={imageAttribution}
          fallbackLabel={locale === 'id' ? 'Belum ada foto' : 'No photo yet'}
          className="aspect-[5/4] w-full sm:aspect-[16/10]"
        />

        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <span className="inline-flex min-h-6 items-center rounded-full border border-white/80 bg-white/92 px-2 py-1 text-[9px] font-black text-emerald-800 shadow-sm backdrop-blur sm:text-[10px]">
            {sideLabel}
          </span>

          {isOwner && !isPublic ? (
            <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-amber-200 bg-amber-50/95 px-2 py-1 text-[9px] font-black text-amber-900 shadow-sm backdrop-blur sm:text-[10px]">
              <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{statusLabel}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-3">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-[color:var(--app-text-soft)] sm:text-[11px]">
          <ListingIcon
            className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-accent)]"
            aria-hidden="true"
          />
          <span className="truncate">{typeLabel}</span>
          {item.verified ? (
            <BadgeCheck
              className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400"
              aria-label={locale === 'id' ? 'Terverifikasi' : 'Verified'}
            />
          ) : null}
        </div>

        <h3
          className={cn(
            'mt-1.5 line-clamp-2 min-h-10 break-words text-sm font-bold leading-5 text-[color:var(--app-text)] sm:text-[15px]',
            interactive && 'group-hover:text-[color:var(--app-accent)]',
          )}
        >
          {item.title}
        </h3>

        <p className="mt-2 truncate text-[16px] font-black leading-5 tracking-[-0.02em] text-[color:var(--app-text)] sm:text-[17px]">
          {valueLabel}
        </p>

        {item.location || item.ownerName ? (
          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-[color:var(--app-text-soft)] sm:text-[11px]">
            {item.location ? (
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="line-clamp-1 min-w-0 break-words">
              {item.location || item.ownerName}
            </span>
          </div>
        ) : null}

        {interactive ? (
          <p
            className={cn(
              'mt-auto flex items-center gap-1 pt-3 text-[10px] font-black sm:text-[11px]',
              isOwner && !isPublic
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-[color:var(--app-accent)]',
            )}
          >
            {isOwner && !isPublic ? (
              <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : null}
            <span className="truncate">{actionLabel}</span>
            {destinationHref ? (
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            ) : null}
          </p>
        ) : null}
      </div>
    </article>
  );

  if (!interactive || !destinationHref) return card;

  return (
    <Link
      href={destinationHref}
      className="group block h-full rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
      aria-label={
        isOwner && !isPublic
          ? (locale === 'id' ? 'Edit ' : 'Edit ') + item.title
          : undefined
      }
    >
      {card}
    </Link>
  );
}
