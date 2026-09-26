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
import { getExploreResultAction } from '@/lib/discovery/exploreResultConversion';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

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
  const { user } = useAuth();
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
    item.kind === 'services' || String(listingType).toLowerCase().includes('service');
  const ListingIcon = isService ? Wrench : Package2;
  const sideLabel =
    getSideLabel(item, locale) || (locale === 'id' ? 'Menawarkan' : 'Offering');
  const typeLabel =
    item.label ||
    (isService
      ? locale === 'id' ? 'Jasa' : 'Service'
      : locale === 'id' ? 'Produk' : 'Product');
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
  const action = getExploreResultAction(isService ? 'services' : 'products', locale);

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
      ? 'Draft'
      : ['pending', 'pending_review', 'review'].includes(normalizedStatus)
        ? locale === 'id' ? 'Menunggu ditinjau' : 'Under review'
        : ['paused', 'inactive'].includes(normalizedStatus)
          ? locale === 'id' ? 'Dijeda' : 'Paused'
          : ['archived', 'deleted'].includes(normalizedStatus)
            ? locale === 'id' ? 'Diarsipkan' : 'Archived'
            : locale === 'id' ? 'Belum tayang' : 'Not published';

  const actionLabel = isOwner && !isPublic
    ? locale === 'id' ? 'Edit & tayangkan' : 'Edit & publish'
    : action.label;

  const card = (
    <article
      data-testid="canonical-listing-card"
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)]',
        interactive &&
          'cursor-pointer transition motion-reduce:transform-none hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_38px_-27px_rgba(15,23,42,0.28)]',
      )}
    >
      <div className="relative">
        <ExploreCardMedia
          src={imageSrc}
          alt={item.title}
          attribution={imageAttribution}
          fallbackLabel={locale === 'id' ? 'Belum ada foto' : 'No photo yet'}
          className="aspect-[4/3] w-full sm:aspect-[16/10]"
        />
        <span
          className="absolute left-2 top-2 inline-flex min-h-6 max-w-[72%] items-center gap-1.5 rounded-lg bg-slate-950/72 px-2 py-1 text-[9px] font-extrabold leading-none text-white shadow-[0_6px_18px_-10px_rgba(15,23,42,0.65)] backdrop-blur-md"
          title={sideLabel}
        >
          <ListingIcon className="h-3.5 w-3.5 shrink-0 text-white/85" aria-hidden="true" />
          <span className="truncate">{sideLabel}</span>
        </span>
        {isOwner && !isPublic ? (
          <span className="absolute right-2 top-2 inline-flex min-h-7 items-center gap-1 rounded-full border border-amber-200 bg-amber-50/95 px-2.5 text-[10px] font-black text-amber-900 shadow-sm backdrop-blur">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-3">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-[color:var(--app-text-soft)] sm:text-[11px]">
          <ListingIcon className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-accent)]" aria-hidden="true" />
          <span className="truncate">{typeLabel}</span>
          {item.verified ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {locale === 'id' ? 'Terverifikasi' : 'Verified'}
            </span>
          ) : null}
        </div>

        <h3 className={cn(
          'mt-1.5 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-[color:var(--app-text)]',
          interactive && 'group-hover:text-[color:var(--app-accent)]',
        )}>
          {item.title}
        </h3>

        <p className="mt-2 truncate text-[15px] font-black leading-5 text-[color:var(--app-text)]">
          {valueLabel}
        </p>

        <div className="mt-2 min-h-9 space-y-1 text-[10px] font-medium text-[color:var(--app-text-soft)] sm:text-[11px]">
          {item.ownerName ? (
            <p className="flex min-w-0 items-center gap-1.5">
              <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.ownerName}</span>
            </p>
          ) : null}
          {item.location ? (
            <p className="flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.location}</span>
            </p>
          ) : null}
        </div>

        {interactive ? (
          <p className={cn(
            "mt-auto flex items-center gap-1 pt-2 text-[10px] font-black sm:text-[11px]",
            isOwner && !isPublic
              ? "text-amber-700 dark:text-amber-300"
              : "text-[color:var(--app-accent)]",
          )}>
            {isOwner && !isPublic ? <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
            {actionLabel}
            {destinationHref ? (
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
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
      className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
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
