'use client';

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type MetricTone = 'blue' | 'purple' | 'emerald' | 'amber' | 'rose' | 'slate';

const toneClassMap: Record<
  MetricTone,
  {
    iconWrap: string;
    hoverRing: string;
    accent: string;
  }
> = {
  blue: {
    iconWrap: 'text-[color:var(--app-info)] bg-[color:var(--app-info-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] dark:text-[color:var(--app-info)]',
    hoverRing: 'group-hover:border-[color:color-mix(in_srgb,_var(--app-info-border)_30%,_transparent)] group-hover:shadow-[var(--app-shadow)]',
    accent: 'group-hover:bg-[color:var(--app-info-soft)] dark:group-hover:bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)]',
  },
  purple: {
    iconWrap: 'text-[color:var(--app-info)] bg-[color:var(--app-info-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] dark:text-[color:var(--app-info)]',
    hoverRing: 'group-hover:border-[color:color-mix(in_srgb,_var(--app-info-border)_30%,_transparent)] group-hover:shadow-[var(--app-shadow)]',
    accent: 'group-hover:bg-[color:var(--app-info-soft)] dark:group-hover:bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)]',
  },
  emerald: {
    iconWrap:
      'text-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] dark:text-[color:var(--app-accent)]',
    hoverRing: 'group-hover:border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)] group-hover:shadow-[var(--app-shadow)]',
    accent: 'group-hover:bg-[color:var(--app-accent-soft)] dark:group-hover:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)]',
  },
  amber: {
    iconWrap: 'text-[color:var(--app-warning)] bg-[color:var(--app-warning-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_30%,_transparent)] dark:text-[color:var(--app-warning)]',
    hoverRing: 'group-hover:border-[color:color-mix(in_srgb,_var(--app-warning-border)_30%,_transparent)] group-hover:shadow-[var(--app-shadow)]',
    accent: 'group-hover:bg-[color:var(--app-warning-soft)] dark:group-hover:bg-[color:color-mix(in_srgb,_var(--app-warning)_20%,_transparent)]',
  },
  rose: {
    iconWrap: 'text-[color:var(--app-danger)] bg-[color:var(--app-danger-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-danger)_30%,_transparent)] dark:text-[color:var(--app-danger)]',
    hoverRing: 'group-hover:border-[color:color-mix(in_srgb,_var(--app-danger-border)_30%,_transparent)] group-hover:shadow-[var(--app-shadow)]',
    accent: 'group-hover:bg-[color:var(--app-danger-soft)] dark:group-hover:bg-[color:color-mix(in_srgb,_var(--app-danger)_20%,_transparent)]',
  },
  slate: {
    iconWrap: 'text-[color:var(--app-text)] bg-[color:var(--app-surface-muted)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)] dark:text-[color:var(--app-text-soft)]',
    hoverRing: 'group-hover:border-[color:color-mix(in_srgb,_var(--app-border-strong)_30%,_transparent)] group-hover:shadow-[var(--app-shadow)]',
    accent: 'group-hover:bg-[color:var(--app-surface-muted)] dark:group-hover:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)]',
  },
};

type VisualMetricCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: MetricTone;
  className?: string;
};

export function VisualMetricCard({
  label,
  value,
  icon: Icon,
  tone = 'blue',
  className,
}: VisualMetricCardProps) {
  const toneClasses = toneClassMap[tone];

  return (
    <article
      className={cn(
        'group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_60%,_transparent)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm transition-all duration-300 dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_50%,_transparent)] dark:bg-[color:var(--app-surface-strong)]',
        toneClasses.hoverRing,
        className,
      )}
    >
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110',
          toneClasses.iconWrap,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-widest text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text)]">
          {label}
        </p>
        <h3 className="text-2xl font-bold tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {value}
        </h3>
      </div>

      <div
        className={cn(
          'absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-[color:var(--app-surface-muted)] transition-colors dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_30%,_transparent)]',
          toneClasses.accent,
        )}
      />
    </article>
  );
}