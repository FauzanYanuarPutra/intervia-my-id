import { Play, View } from 'lucide-react';

import { ExploreCardMedia } from '@/components/explore/cards/ExploreCardMedia';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';

export function ExploreVideoCard({ item }: { item: GlobalSearchItem }) {
  return (
    <Link
      href={item.href}
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
    >
      <article className="h-full cursor-pointer overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)]">
        <div className="relative block">
          <ExploreCardMedia
            src={item.image}
            alt={item.title}
            className="aspect-[9/12] w-full"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/10">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white">
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </span>
          </span>
          {item.durationLabel ? (
            <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-white">
              {item.durationLabel}
            </span>
          ) : null}
        </div>
        <div className="p-2.5">
          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)]">
            {item.title}
          </h3>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[color:var(--app-text-soft)]">
            <span className="truncate">{item.ownerName}</span>
            {item.viewCount !== null ? (
              <span className="inline-flex shrink-0 items-center gap-1">
                <View className="h-3 w-3" />
                {item.viewCount}
              </span>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
}
