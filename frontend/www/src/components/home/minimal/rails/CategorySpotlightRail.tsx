import { Link } from '@/i18n/navigation';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { HorizontalRail } from '@/components/home/minimal/HorizontalRail';
import { FeedKind } from './FeedRail';

type CategorySpotlight = {
  id: string;
  href: string;
  label: string;
  description: string;
  emoji: string;
  icon: LucideIcon;
  tone: 'emerald' | 'sky' | 'amber' | 'slate';
  kind: FeedKind;
};

type CategorySpotlightRailProps = {
  isId: boolean;
  totalFeedCount: number;
  items: CategorySpotlight[];
  feedCounts: Record<FeedKind, number>;
  formatCompact: (value: number) => string;
};

const TONE_STYLES: Record<
  CategorySpotlight['tone'],
  { card: string; badge: string; icon: string }
> = {
  emerald: {
    card: 'bg-[color:color-mix(in_srgb,_var(--app-accent-soft)_70%,_transparent)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] dark:text-[color:var(--app-accent)]',
    badge: 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] dark:text-[color:var(--app-accent)]',
    icon: 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] dark:text-[color:var(--app-accent)]',
  },
  sky: {
    card: 'bg-[color:color-mix(in_srgb,_var(--app-info-soft)_70%,_transparent)] text-[color:var(--app-info)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_10%,_transparent)] dark:text-[color:var(--app-info)]',
    badge: 'bg-[color:var(--app-info-soft)] text-[color:var(--app-info)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] dark:text-[color:var(--app-info)]',
    icon: 'bg-[color:var(--app-info-soft)] text-[color:var(--app-info)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] dark:text-[color:var(--app-info)]',
  },
  amber: {
    card: 'bg-[color:color-mix(in_srgb,_var(--app-warning-soft)_70%,_transparent)] text-[color:var(--app-warning)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_10%,_transparent)] dark:text-[color:var(--app-warning)]',
    badge: 'bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_20%,_transparent)] dark:text-[color:var(--app-warning)]',
    icon: 'bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_20%,_transparent)] dark:text-[color:var(--app-warning)]',
  },
  slate: {
    card: 'bg-[color:color-mix(in_srgb,_var(--app-surface-muted)_80%,_transparent)] text-[color:var(--app-text)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)] dark:text-[color:var(--app-text-soft)]',
    badge: 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]',
    icon: 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]',
  },
};

export function CategorySpotlightRail({
  isId,
  totalFeedCount,
  items,
  feedCounts,
  formatCompact,
}: CategorySpotlightRailProps) {
  return (
    <section className="border-t border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] pt-4 dark:border-[color:var(--app-border-strong)] sm:rounded-3xl sm:border sm:border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] sm:bg-[color:var(--app-surface-strong)] sm:p-4 sm:pt-4 sm:shadow-sm sm:dark:border-[color:var(--app-border-strong)] sm:dark:bg-[color:var(--app-surface-strong)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:text-base">
            {isId ? 'Sorotan kategori' : 'Category spotlight'}
          </h3>
          <p className="text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:text-sm">
            {isId
              ? 'Akses cepat ke kategori yang paling aktif.'
              : 'Quick access to the most active categories.'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-[11px] font-bold text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] dark:text-[color:var(--app-accent)]">
          {totalFeedCount} {isId ? 'data aktif' : 'active items'}
        </span>
      </div>

      <div className="mt-3">
        <HorizontalRail hintLabel={isId ? 'Geser kategori' : 'Swipe categories'}>
          {items.map(spotlight => {
            const tone = TONE_STYLES[spotlight.tone];
            const Icon = spotlight.icon;
            const count = feedCounts[spotlight.kind];
            return (
              <Link
                key={spotlight.id}
                href={spotlight.href}
                className={`group relative min-w-[82%] max-w-[300px] snap-start overflow-hidden rounded-2xl border border-transparent p-4 shadow-none transition hover:-translate-y-0.5 sm:max-w-none sm:border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] sm:shadow-sm sm:hover:shadow-md sm:min-w-[260px] sm:dark:border-[color:var(--app-border-strong)] ${tone.card}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg ${tone.badge}`}>
                    {spotlight.emoji}
                  </div>
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${tone.icon}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">{spotlight.label}</p>
                  <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">{spotlight.description}</p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  <span>{isId ? 'Tersedia' : 'Available'}</span>
                  <span className="text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    {formatCompact(count)}
                  </span>
                </div>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
                  {isId ? 'Lihat kategori' : 'View category'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </HorizontalRail>
      </div>
    </section>
  );
}
