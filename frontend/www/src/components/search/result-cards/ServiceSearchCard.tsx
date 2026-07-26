import { Wrench } from 'lucide-react';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import {
  getListingCardCtaLabel,
  getListingValueFallback,
} from '@/lib/content/listingSide';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import { NeedSearchCard } from './NeedSearchCard';
import {
  getSideLabel,
  SearchCardCta,
  SearchCardEyebrow,
  SearchCardFacts,
  searchCardBorderClass,
} from './SearchCardParts';
import { cn } from '@/lib/utils';

export function ServiceSearchCard({
  item,
  locale,
  interactive = true,
}: {
  item: GlobalSearchItem;
  locale: 'id' | 'en';
  interactive?: boolean;
}) {
  if (item.side === 'demand') {
    return (
      <NeedSearchCard item={item} locale={locale} interactive={interactive} />
    );
  }

  const title = (
    <h3
      className={cn(
        'mt-1.5 line-clamp-2 text-sm font-bold leading-5 text-[color:var(--app-text)]',
        interactive && 'group-hover:text-[color:var(--app-accent)]',
      )}
    >
      {item.title}
    </h3>
  );
  const sideLabel = getSideLabel(item, locale);

  const card = (
    <article
      className={cn(
        'flex h-full min-h-[168px] flex-col rounded-lg border bg-[color:var(--app-surface-strong)] p-3 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)]',
        interactive &&
          'cursor-pointer transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)]',
        searchCardBorderClass('sky'),
      )}
    >
      <SearchCardEyebrow
        icon={Wrench}
        label={item.label || (locale === 'id' ? 'Jasa' : 'Service')}
        tone="sky"
        verified={item.verified}
        sideLabel={sideLabel}
      />
      {title}
      <p className="mt-1 line-clamp-1 text-xs leading-4 text-[color:var(--app-text-soft)]">
        {item.summary}
      </p>
      <SearchCardFacts
        item={item}
        locale={locale}
        tone="sky"
        priceFallback={getListingValueFallback('supply', locale, 'service')}
      />
      {interactive ? (
        <SearchCardCta
          href={item.href}
          locale={locale}
          tone="sky"
          label={getListingCardCtaLabel('supply', 'service', locale)}
          as="span"
        />
      ) : null}
    </article>
  );

  if (!interactive) return card;

  return (
    <Link
      href={item.href}
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
    >
      {card}
    </Link>
  );
}
