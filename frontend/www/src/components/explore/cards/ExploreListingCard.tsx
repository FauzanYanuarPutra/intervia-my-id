import { BadgeCheck, MapPin, Package2, Store, Wrench } from 'lucide-react';

import { ExploreCardMedia } from '@/components/explore/cards/ExploreCardMedia';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { NeedSearchCard } from '@/components/search/result-cards/NeedSearchCard';
import { getSideLabel } from '@/components/search/result-cards/SearchCardParts';
import { getListingValueFallback } from '@/lib/content/listingSide';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import { cn } from '@/lib/utils';

export function ExploreListingCard({
  item,
  locale,
  interactive = true,
}: {
  item: GlobalSearchItem;
  locale: 'id' | 'en';
  interactive?: boolean;
}) {
  const isNeed = item.side === 'demand' || item.kind === 'needs';
  if (isNeed) {
    return (
      <NeedSearchCard item={item} locale={locale} interactive={interactive} />
    );
  }

  const imageAttribution =
    typeof item.metadata.imageAttribution === 'string'
      ? item.metadata.imageAttribution
      : '';
  const listingType = item.metadata.contentType || item.kind;
  const isService =
    item.kind === 'services' ||
    String(listingType).toLowerCase().includes('service');
  const ListingIcon = isService ? Wrench : Package2;
  const sideLabel =
    getSideLabel(item, locale) || (locale === 'id' ? 'Menawarkan' : 'Offering');
  const typeLabel =
    item.label ||
    (isService
      ? locale === 'id'
        ? 'Jasa'
        : 'Service'
      : locale === 'id'
        ? 'Produk'
        : 'Product');
  const valueLabel =
    item.priceLabel ||
    getListingValueFallback('supply', locale, String(listingType));

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
          src={item.image}
          alt={item.title}
          attribution={imageAttribution}
          fallbackLabel={locale === 'id' ? 'Belum ada foto' : 'No photo yet'}
          className="aspect-[4/3] w-full sm:aspect-[16/10]"
        />
        <span className="absolute left-2 top-2 inline-flex min-h-7 items-center rounded-full border border-white/70 bg-white/90 px-2.5 text-[10px] font-black text-emerald-800 shadow-sm backdrop-blur">
          {sideLabel}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-3">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-[color:var(--app-text-soft)] sm:text-[11px]">
          <ListingIcon className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-accent)]" />
          <span className="truncate">{typeLabel}</span>
          {item.verified ? (
            <>
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <span className="sr-only">
                {locale === 'id' ? 'Terverifikasi' : 'Verified'}
              </span>
            </>
          ) : null}
        </div>

        <h3
          className={cn(
            'mt-1.5 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-[color:var(--app-text)]',
            interactive && 'group-hover:text-[color:var(--app-accent)]',
          )}
        >
          {item.title}
        </h3>

        <p className="mt-2 truncate text-[15px] font-black leading-5 text-[color:var(--app-text)]">
          {valueLabel}
        </p>

        <div className="mt-2 min-h-9 space-y-1 text-[10px] font-medium text-[color:var(--app-text-soft)] sm:text-[11px]">
          {item.ownerName ? (
            <p className="flex min-w-0 items-center gap-1.5">
              <Store className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.ownerName}</span>
            </p>
          ) : null}
          {item.location ? (
            <p className="flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.location}</span>
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );

  if (!interactive) return card;

  return (
    <Link
      href={item.href}
      className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
    >
      {card}
    </Link>
  );
}
