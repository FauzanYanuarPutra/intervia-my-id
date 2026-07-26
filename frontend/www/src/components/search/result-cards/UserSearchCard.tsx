import { UserRound } from 'lucide-react';
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

export function UserSearchCard({
  item,
  locale,
}: {
  item: GlobalSearchItem;
  locale: 'id' | 'en';
}) {
  return (
    <Link
      href={item.href}
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
    >
      <article
        className={cn(
          'flex h-full min-h-[154px] cursor-pointer gap-3 rounded-lg border bg-[color:var(--app-surface-strong)] p-3 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)]',
          searchCardBorderClass('lime'),
        )}
      >
        <ExploreCardMedia
          src={item.image}
          alt={item.title}
          className="h-16 w-16 shrink-0 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <SearchCardEyebrow
            icon={UserRound}
            label={locale === 'id' ? 'Pengguna' : 'User'}
            tone="lime"
            verified={item.verified}
          />
          <h3 className="mt-1.5 line-clamp-2 text-sm font-bold text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)]">
            {item.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs leading-4 text-[color:var(--app-text-soft)]">
            {item.summary || item.label}
          </p>
          <SearchCardFacts item={item} locale={locale} tone="lime" />
          <SearchCardCta
            href={item.href}
            locale={locale}
            tone="lime"
            label={locale === 'id' ? 'Lihat profil' : 'View profile'}
            as="span"
          />
        </div>
      </article>
    </Link>
  );
}
