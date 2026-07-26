import { Lock, MessageCircle, Users, View } from 'lucide-react';

import { ExploreCardMedia } from '@/components/explore/cards/ExploreCardMedia';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';

export function ExploreCommunityCard({
  item,
  locale,
}: {
  item: GlobalSearchItem;
  locale: 'id' | 'en';
}) {
  const privacy = String(item.metadata.privacy || 'public');
  const isDiscussion = item.metadata.entityType === 'discussion';
  const comments = Number(item.metadata.comments || 0);
  return (
    <Link
      href={item.href}
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
    >
      <article className="h-full cursor-pointer overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)]">
        <ExploreCardMedia
          src={item.image}
          alt={item.title}
          className="aspect-[3/1] w-full"
        />
        <div className="p-2.5">
          <p className="mb-1 truncate text-[10px] font-bold uppercase text-[color:var(--app-accent)]">
            {item.label}
          </p>
          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)]">
            {item.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs leading-4 text-[color:var(--app-text-soft)]">
            {item.summary}
          </p>
          <div className="mt-2 flex items-center gap-3 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
            {isDiscussion ? (
              <>
                {item.ownerName ? (
                  <span className="min-w-0 flex-1 truncate">
                    {item.ownerName}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {comments}
                </span>
                {item.viewCount !== null ? (
                  <span className="inline-flex items-center gap-1">
                    <View className="h-3.5 w-3.5" />
                    {item.viewCount}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {item.memberCount ?? 0}{' '}
                  {locale === 'id' ? 'anggota' : 'members'}
                </span>
                {privacy !== 'public' ? (
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" />
                    {locale === 'id' ? 'Privat' : 'Private'}
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
