import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { OverviewActionCard } from '../types';

export function OverviewActionCardGrid({
  cards,
}: {
  cards: OverviewActionCard[];
}) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <Link
            key={`${card.href}:${card.label}`}
            href={card.href}
            className={cn(
              'group flex min-h-[112px] flex-col justify-between rounded-[16px] border p-4 text-left transition hover:-translate-y-0.5',
              card.primary
                ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white shadow-[0_18px_34px_-28px_rgba(15,23,42,0.32)]'
                : 'border-slate-200 bg-slate-50/80 text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)] dark:border-white/10 dark:bg-slate-950/75',
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  'inline-flex h-10 w-10 items-center justify-center rounded-[14px]',
                  card.primary
                    ? 'bg-white/16 text-white'
                    : 'bg-white text-[color:var(--app-accent)] ring-1 ring-slate-200 dark:bg-white/8 dark:ring-white/10',
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <ChevronRight
                className={cn(
                  'h-4 w-4 shrink-0 transition group-hover:translate-x-0.5',
                  card.primary
                    ? 'text-white/80'
                    : 'text-[color:var(--app-text-soft)]',
                )}
              />
            </span>
            <span>
              <span className="block text-[15px] font-bold">{card.label}</span>
              <span
                className={cn(
                  'mt-1 block text-[11px] leading-5',
                  card.primary
                    ? 'text-white/82'
                    : 'text-[color:var(--app-text-soft)]',
                )}
              >
                {card.desc}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
