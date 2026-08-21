import { Link } from '@/i18n/navigation';
import { Briefcase, Building2, ShoppingBag, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { HorizontalRail } from '@/components/home/minimal/HorizontalRail';

export type FeedKind = 'job' | 'talent' | 'property' | 'marketplace' | 'other';

export type FeedCard = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  location: string;
  priceLabel: string;
  kind: FeedKind;
};

type FeedRailProps = {
  isId: boolean;
  items: FeedCard[];
  loading: boolean;
  error: string | null;
};

function feedKindLabel(kind: FeedKind, isId: boolean): string {
  if (kind === 'job') return isId ? 'Lowongan' : 'Job';
  if (kind === 'talent') return isId ? 'Talent' : 'Talent';
  if (kind === 'property') return isId ? 'Properti' : 'Property';
  if (kind === 'marketplace') return isId ? 'Produk' : 'Product';
  return isId ? 'Konten' : 'Content';
}

function kindVisual(kind: FeedKind): { Icon: LucideIcon; chipClass: string } {
  if (kind === 'job') {
    return {
      Icon: Briefcase,
      chipClass:
        'border-[color:color-mix(in_srgb,_var(--app-info-border)_80%,_transparent)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)] dark:border-[color:color-mix(in_srgb,_var(--app-info-border)_30%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_10%,_transparent)] dark:text-[color:var(--app-info)]',
    };
  }
  if (kind === 'talent') {
    return {
      Icon: Users,
      chipClass:
        'border-[color:color-mix(in_srgb,_var(--app-accent-border)_80%,_transparent)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] dark:text-[color:var(--app-accent)]',
    };
  }
  if (kind === 'property') {
    return {
      Icon: Building2,
      chipClass:
        'border-[color:color-mix(in_srgb,_var(--app-group-talent-border)_80%,_transparent)] bg-[color:var(--app-group-talent-soft)] text-[color:var(--app-group-talent)] dark:border-[color:color-mix(in_srgb,_var(--app-group-talent-border)_30%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-group-talent)_10%,_transparent)] dark:text-[color:var(--app-group-talent)]',
    };
  }
  if (kind === 'marketplace') {
    return {
      Icon: ShoppingBag,
      chipClass:
        'border-[color:color-mix(in_srgb,_var(--app-warning-border)_80%,_transparent)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_30%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_10%,_transparent)] dark:text-[color:var(--app-warning)]',
    };
  }
  return {
    Icon: Sparkles,
    chipClass:
      'border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_30%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface)_10%,_transparent)] dark:text-[color:var(--app-text-soft)]',
  };
}

export function FeedRail({ isId, items, loading, error }: FeedRailProps) {
  if (loading) {
    return (
      <HorizontalRail hintLabel={isId ? 'Geser' : 'Swipe'}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="ui-skeleton ui-skeleton-pulse h-36 w-[84%] min-w-[84%] max-w-[320px] rounded-2xl border border-transparent ring-1 ring-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] dark:ring-[color:color-mix(in_srgb,_var(--app-border-strong)_70%,_transparent)] sm:w-[250px] sm:min-w-[250px] sm:max-w-[250px]"
          />
        ))}
      </HorizontalRail>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-transparent bg-[color:var(--app-surface-muted)] p-4 text-sm text-[color:var(--app-text)] ring-1 ring-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:ring-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)]">
        {error ||
          (isId
            ? 'Belum ada data listing yang bisa ditampilkan sekarang.'
            : 'No listing data available right now.')}
      </div>
    );
  }

  return (
    <HorizontalRail hintLabel={isId ? 'Geser kartu' : 'Swipe cards'}>
      {items.map(card => {
        const visual = kindVisual(card.kind);
        const Icon = visual.Icon;
        return (
          <Link
            key={card.id}
            href={card.href}
            className="group flex min-h-[136px] w-[84%] min-w-[84%] max-w-[320px] snap-start flex-col justify-between rounded-2xl border border-transparent bg-[color:var(--app-surface-muted)] p-3 shadow-none ring-1 ring-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] transition hover:bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] dark:ring-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] dark:hover:bg-[color:var(--app-surface-strong)] sm:w-[280px] sm:min-w-[280px] sm:max-w-[280px]"
          >
            <div className="min-w-0">
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${visual.chipClass}`}>
                <Icon className="h-3 w-3" />
                {feedKindLabel(card.kind, isId)}
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {card.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {card.subtitle || card.location}
              </p>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">{card.priceLabel}</p>
              <p className="truncate text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">{card.location}</p>
            </div>
          </Link>
        );
      })}
    </HorizontalRail>
  );
}
