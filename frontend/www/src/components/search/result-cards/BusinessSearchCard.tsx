import { Store } from 'lucide-react';
import { ExploreCardMedia } from '@/components/explore/cards/ExploreCardMedia';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import {
  SearchCardCta,
  SearchCardEyebrow,
  SearchCardFacts,
  searchCardBorderClass,
} from './SearchCardParts';
import { cn } from '@/lib/utils';

export function BusinessSearchCard({
  item,
  locale,
}: {
  item: GlobalSearchItem;
  locale: 'id' | 'en';
}) {
  const imageAttribution =
    typeof item.metadata.imageAttribution === 'string'
      ? item.metadata.imageAttribution
      : '';
  const imageSourceHref =
    imageAttribution === 'Google Maps' &&
    typeof item.metadata.googleMapsUri === 'string'
      ? item.metadata.googleMapsUri
      : '';

  return (
    <article
      className={cn(
        'group relative grid h-full min-h-[176px] cursor-pointer grid-cols-[92px_minmax(0,1fr)] overflow-hidden rounded-lg border bg-[color:var(--app-surface-strong)] shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)] sm:grid-cols-[112px_minmax(0,1fr)]',
        searchCardBorderClass('teal'),
      )}
    >
      <Link
        href={item.href}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
      >
        <span className="sr-only">{item.title}</span>
      </Link>
      <ExploreCardMedia
        src={item.image}
        alt={item.title}
        attribution={imageAttribution}
        sourceHref={imageSourceHref}
        className="h-full min-h-[124px] w-full"
      />
      <div className="flex min-w-0 flex-col p-2.5">
        <SearchCardEyebrow
          icon={Store}
          label={item.label || (locale === 'id' ? 'Usaha' : 'Business')}
          tone="teal"
          verified={item.verified}
        />
        <h3 className="mt-1.5 line-clamp-2 text-sm font-bold leading-5 text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)]">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs leading-4 text-[color:var(--app-text-soft)]">
          {item.summary}
        </p>
        <SearchCardFacts item={item} locale={locale} tone="teal" />
        <SearchCardCta
          href={item.href}
          locale={locale}
          tone="teal"
          label={locale === 'id' ? 'Lihat usaha' : 'View business'}
          as="span"
        />
      </div>
    </article>
  );
}
