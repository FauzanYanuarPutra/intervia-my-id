import { BadgeCheck, MapPin, Store } from 'lucide-react';

import { ExploreCardMedia } from '@/components/explore/cards/ExploreCardMedia';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';

export function ExploreBusinessCard({
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
    <article className="group relative flex min-h-[112px] cursor-pointer overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)]">
      <Link
        href={item.href}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
      >
        <span className="sr-only">{item.title}</span>
      </Link>
      <ExploreCardMedia
        src={item.image}
        alt={item.title}
        attribution={imageAttribution}
        sourceHref={imageSourceHref}
        className="w-[96px] shrink-0"
      />
      <div className="min-w-0 flex-1 p-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
          <Store className="h-3.5 w-3.5" />
          <span className="truncate">
            {item.label || (locale === 'id' ? 'Usaha' : 'Business')}
          </span>
          {item.verified ? (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          ) : null}
        </div>
        <h3 className="mt-1 truncate text-sm font-bold text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)]">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs leading-4 text-[color:var(--app-text-soft)]">
          {item.summary}
        </p>
        {item.location ? (
          <p className="mt-2 flex items-center gap-1 truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.location}</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}
