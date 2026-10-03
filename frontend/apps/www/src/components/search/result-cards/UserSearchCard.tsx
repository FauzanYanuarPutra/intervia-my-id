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
  const profileLabel = locale === 'id' ? 'Profil' : 'Profile';
  const profileCta = locale === 'id' ? 'Lihat profil' : 'View profile';

  return (
    <Link
      href={item.href}
      className="group block h-full min-w-0 rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
    >
      <article
        className={cn(
          'flex h-full min-w-0 items-start gap-2.5 rounded-[12px] border bg-[color:var(--app-surface-strong)] p-2.5 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)] sm:gap-3 sm:p-3',
          searchCardBorderClass('lime'),
        )}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-lime-100 bg-[color:var(--app-surface-muted)] sm:h-14 sm:w-14">
          <ExploreCardMedia
            src={item.image}
            alt={item.title}
            fallbackLabel={profileLabel}
            className="h-full w-full rounded-full"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col self-stretch">
          <SearchCardEyebrow
            icon={UserRound}
            label={locale === 'id' ? 'Pengguna' : 'User'}
            tone="lime"
            verified={item.verified}
          />

          <h3 className="mt-1.5 line-clamp-2 min-w-0 text-[13px] font-extrabold leading-[18px] tracking-[-0.015em] text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)] sm:text-sm sm:leading-5">
            {item.title}
          </h3>

          <p className="mt-1 line-clamp-2 min-w-0 text-[10px] leading-4 text-[color:var(--app-text-soft)] sm:text-[11px]">
            {item.summary || item.label || profileLabel}
          </p>

          <SearchCardFacts item={item} locale={locale} tone="lime" />

          <div className="mt-auto flex min-w-0 pt-2">
            <SearchCardCta
              href={item.href}
              locale={locale}
              tone="lime"
              label={profileCta}
              as="span"
            />
          </div>
        </div>
      </article>
    </Link>
  );
}
