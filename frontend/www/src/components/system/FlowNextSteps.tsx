'use client';

import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export type FlowStepCard = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

type FlowNextStepsProps = {
  eyebrow: string;
  title: string;
  description: string;
  cards: FlowStepCard[];
  className?: string;
  darkSurface?: boolean;
};

export function FlowNextSteps({
  eyebrow,
  title,
  description,
  cards,
  className = '',
  darkSurface = false,
}: FlowNextStepsProps) {
  const t = useTranslations('Flow');
  return (
    <section className={`rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 shadow-sm ${className}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${darkSurface ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-accent)]'}`}>{eyebrow}</p>
      <h2 className={`mt-2 text-lg font-bold tracking-tight ${darkSurface ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-accent)]'}`}>{title}</h2>
      <p className={`mt-2 max-w-3xl text-sm ${darkSurface ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-accent)]'}`}>{description}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={`${card.href}-${card.title}`}
              href={card.href}
              className={`group rounded-2xl border p-3 transition ${darkSurface
                  ? 'border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] text-[color:var(--app-accent)] hover:bg-[color:var(--app-surface-muted)]'
                  : 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]'
                }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <Icon className="h-4 w-4" />
                </span>
                {card.badge ? (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${darkSurface ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]' : 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'}`}>
                    {card.badge}
                  </span>
                ) : null}
              </div>
              <h3 className={`mt-3 text-sm font-bold ${darkSurface ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-accent)]'}`}>{card.title}</h3>
              <p className={`mt-1 text-xs leading-5 line-clamp-2 ${darkSurface ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-accent)]'}`}>{card.description}</p>
              <span className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${darkSurface ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-accent)]'}`}>
                {t('open')}
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
