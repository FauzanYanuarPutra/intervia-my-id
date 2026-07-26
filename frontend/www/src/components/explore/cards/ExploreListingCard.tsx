import { Package2 } from 'lucide-react';

import { ExploreCardMedia } from '@/components/explore/cards/ExploreCardMedia';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { NeedSearchCard } from '@/components/search/result-cards/NeedSearchCard';
import {
  getSideLabel,
  SearchCardCta,
  SearchCardEyebrow,
  SearchCardFacts,
  searchCardBorderClass,
} from '@/components/search/result-cards/SearchCardParts';
import {
  getListingCardCtaLabel,
  getListingValueFallback,
} from '@/lib/content/listingSide';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import { cn } from '@/lib/utils';

export function ExploreListingCard({
  item,
  locale,
}: {
  item: GlobalSearchItem;
  locale: 'id' | 'en';
}) {
  const isNeed = item.side === 'demand' || item.kind === 'needs';
  if (isNeed) {
    return <NeedSearchCard item={item} locale={locale} />;
  }
  const imageAttribution =
    typeof item.metadata.imageAttribution === 'string'
      ? item.metadata.imageAttribution
      : '';
  const sideLabel = getSideLabel(item, locale);
  const listingType = item.metadata.contentType || item.kind;

  return (
    <Link
      href={item.href}
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
    >
      <article
        className={cn(
          'flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg border bg-[color:var(--app-surface-strong)] shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)]',
          searchCardBorderClass('emerald'),
        )}
      >
        <ExploreCardMedia
          src={item.image}
          alt={item.title}
          attribution={imageAttribution}
          className="aspect-[16/10] w-full"
        />
        <div className="flex min-w-0 flex-1 flex-col p-2.5">
          <SearchCardEyebrow
            icon={Package2}
            label={item.label || (locale === 'id' ? 'Penawaran' : 'Offer')}
            tone="emerald"
            verified={item.verified}
            sideLabel={sideLabel}
          />
          <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)]">
            {item.title}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-8 max-h-8 overflow-hidden text-xs leading-4 text-[color:var(--app-text-soft)]">
            {item.summary ||
              (locale === 'id'
                ? 'Lihat detail untuk informasi lengkap.'
                : 'Open details for more information.')}
          </p>
          <SearchCardFacts
            item={item}
            locale={locale}
            tone="emerald"
            priceFallback={getListingValueFallback(
              'supply',
              locale,
              listingType,
            )}
          />
          <SearchCardCta
            href={item.href}
            locale={locale}
            tone="emerald"
            label={getListingCardCtaLabel('supply', listingType, locale)}
            as="span"
          />
        </div>
      </article>
    </Link>
  );
}
