'use client';

import type { ReactNode } from 'react';
import { type LucideIcon, Check, ChevronRight, Dot } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

type StatusChipProps = {
  label: string;
  tone?: Tone;
  pulse?: boolean;
  icon?: LucideIcon;
  className?: string;
};

type SummaryStatProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
};

export type TimelineItem = {
  id: string;
  label: string;
  meta?: string;
  state: 'complete' | 'current' | 'upcoming' | 'warning';
};

type TimelineProps = {
  items: readonly TimelineItem[];
  className?: string;
};

type VehicleOptionCardProps = {
  title: string;
  subtitle: string;
  priceLabel: string;
  etaLabel: string;
  capacityLabel: string;
  selected?: boolean;
  icon: LucideIcon;
  badge?: string;
  detail?: string;
  footerLabel?: string;
  onClick?: () => void;
  className?: string;
};

type DriverIdentityCardProps = {
  name: string;
  subtitle: string;
  ratingLabel: string;
  etaLabel: string;
  vehicleLabel?: string;
  tone?: Tone;
  actions?: ReactNode;
  className?: string;
};

function toneClasses(tone: Tone): string {
  if (tone === 'accent') {
    return 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]';
  }
  if (tone === 'success') {
    return 'border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] text-[color:var(--app-success)]';
  }
  if (tone === 'warning') {
    return 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]';
  }
  if (tone === 'danger') {
    return 'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]';
  }
  if (tone === 'info') {
    return 'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)]';
  }
  return 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)]';
}

function timelineDotClasses(state: TimelineItem['state']): string {
  if (state === 'complete') return 'bg-[color:var(--app-success)] text-[color:var(--app-text-inverse)]';
  if (state === 'current') return 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] ring-4 ring-[color:var(--app-accent-soft)]';
  if (state === 'warning') return 'bg-[color:var(--app-warning)] text-[color:var(--app-text-inverse)]';
  return 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] border border-[color:var(--app-border)]';
}

export function StatusChip({
  label,
  tone = 'default',
  pulse = false,
  icon: Icon,
  className,
}: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold',
        toneClasses(tone),
        pulse && 'ui-status-pulse',
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
    </span>
  );
}

export function MobilitySummaryStat({
  label,
  value,
  hint,
  tone = 'default',
  icon: Icon,
  className,
}: SummaryStatProps) {
  return (
    <div
      className={cn(
        'rounded-[24px] border p-4 shadow-[var(--app-shadow-soft)]',
        toneClasses(tone),
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">
            {label}
          </p>
          <p className="mt-2 text-lg font-semibold leading-tight">{value}</p>
          {hint ? (
            <p className="mt-1 text-[12px] leading-5 opacity-85">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_74%,_transparent)]">
            <Icon className="h-4.5 w-4.5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function MobilityTimeline({ items, className }: TimelineProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={item.id} className="flex gap-3">
            <div className="flex w-9 flex-col items-center">
              <span
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold',
                  timelineDotClasses(item.state),
                )}
              >
                {item.state === 'complete' ? (
                  <Check className="h-4 w-4" />
                ) : item.state === 'upcoming' ? (
                  <Dot className="h-5 w-5" />
                ) : (
                  index + 1
                )}
              </span>
              {!isLast ? (
                <span className="mt-1 h-full min-h-[28px] w-px bg-[color:var(--app-border)]" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold text-[color:var(--app-text)]">
                {item.label}
              </p>
              {item.meta ? (
                <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                  {item.meta}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VehicleOptionCard({
  title,
  subtitle,
  priceLabel,
  etaLabel,
  capacityLabel,
  selected = false,
  icon: Icon,
  badge,
  detail,
  footerLabel,
  onClick,
  className,
}: VehicleOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group w-full rounded-[24px] border px-4 py-4 text-left transition',
        selected
          ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] shadow-[var(--app-shadow)]'
          : 'bg-[color:var(--app-surface-strong)] hover:border-[color:var(--app-accent-border)] hover:shadow-[var(--app-shadow-soft)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span
            className={cn(
              'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px]',
              selected
                ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]'
                : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]',
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[color:var(--app-text)]">
                {title}
              </p>
              {badge ? (
                <span className="inline-flex rounded-full border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-warning)]">
                  {badge}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
              {subtitle}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="ui-inline-meta">{etaLabel}</span>
              <span className="ui-inline-meta">{capacityLabel}</span>
              {footerLabel ? <span className="ui-inline-meta">{footerLabel}</span> : null}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-[color:var(--app-text)]">
            {priceLabel}
          </p>
          <span
            className={cn(
              'mt-3 inline-flex h-8 w-8 items-center justify-center rounded-full transition',
              selected
                ? 'bg-[color:var(--app-text)] text-[color:var(--app-text-inverse)]'
                : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] group-hover:bg-[color:var(--app-accent-soft)] group-hover:text-[color:var(--app-accent)]',
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </div>
      {detail ? (
        <div
          className={cn(
            'mt-3 overflow-hidden rounded-[18px] border px-3 py-2 text-[12px] leading-5 transition',
            selected
              ? 'border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_78%,_transparent)] text-[color:var(--app-text)]'
              : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
          )}
        >
          {detail}
        </div>
      ) : null}
    </button>
  );
}

export function DriverIdentityCard({
  name,
  subtitle,
  ratingLabel,
  etaLabel,
  vehicleLabel,
  tone = 'accent',
  actions,
  className,
}: DriverIdentityCardProps) {
  return (
    <div
      className={cn(
        'rounded-[28px] border p-4 shadow-[var(--app-shadow)]',
        toneClasses(tone),
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_88%,_transparent)] text-base font-bold">
          {name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{name}</p>
          <p className="mt-1 text-[12px] leading-5 opacity-85">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{ratingLabel}</p>
          <p className="mt-1 text-[11px] opacity-80">{etaLabel}</p>
        </div>
      </div>
      {vehicleLabel ? (
        <p className="mt-3 rounded-[18px] border border-current/15 bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_78%,_transparent)] px-3 py-2 text-[12px] leading-5">
          {vehicleLabel}
        </p>
      ) : null}
      {actions ? <div className="mt-3">{actions}</div> : null}
    </div>
  );
}
