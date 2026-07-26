import { Lock, MessageCircle, Users } from 'lucide-react';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import {
  SearchCardCta,
  SearchCardEyebrow,
  searchCardBorderClass,
} from './SearchCardParts';
import { cn } from '@/lib/utils';

export function CommunitySearchCard({
  item,
  locale,
}: {
  item: GlobalSearchItem;
  locale: 'id' | 'en';
}) {
  const privacy = String(item.metadata.privacy || 'public');
  return (
    <Link
      href={item.href}
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
    >
      <article
        className={cn(
          'flex h-full min-h-[168px] cursor-pointer flex-col rounded-lg border bg-[color:var(--app-surface-strong)] p-3 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)]',
          searchCardBorderClass('fuchsia'),
        )}
      >
        <SearchCardEyebrow
          icon={Users}
          label={item.label || (locale === 'id' ? 'Komunitas' : 'Community')}
          tone="fuchsia"
          sideLabel={
            privacy !== 'public'
              ? locale === 'id'
                ? 'Privat'
                : 'Private'
              : null
          }
        />
        <h3 className="mt-1.5 line-clamp-2 text-sm font-bold text-[color:var(--app-text)] group-hover:text-fuchsia-700">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs leading-4 text-[color:var(--app-text-soft)]">
          {item.summary}
        </p>
        <div className="mt-2 flex items-center gap-3 border-t border-[color:var(--app-border)] pt-2 text-[10px] text-[color:var(--app-text-soft)]">
          {item.memberCount !== null ? (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {item.memberCount}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {Number(item.metadata.comments || 0)}
            </span>
          )}
          {privacy !== 'public' ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" />
              {locale === 'id' ? 'Privat' : 'Private'}
            </span>
          ) : null}
        </div>
        <SearchCardCta
          href={item.href}
          locale={locale}
          tone="fuchsia"
          label={locale === 'id' ? 'Masuk komunitas' : 'Open community'}
          as="span"
        />
      </article>
    </Link>
  );
}
