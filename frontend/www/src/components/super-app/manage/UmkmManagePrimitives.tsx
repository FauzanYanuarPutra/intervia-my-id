'use client';

import type {
  ComponentType,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const controlBaseClass =
  'min-h-[50px] w-full touch-manipulation rounded-[14px] border-2 border-slate-300 bg-white px-3.5 text-[14px] font-semibold text-[color:var(--app-text)] shadow-none outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[color:var(--app-accent)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--app-accent)_16%,transparent)] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-emerald-400 dark:disabled:border-slate-800 dark:disabled:bg-slate-900/70';

export function FieldLabel({
  children,
  className,
  htmlFor,
  required,
}: {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'flex items-center gap-1 text-[12px] font-black tracking-[0.005em] text-[color:var(--app-text)]',
        className,
      )}
    >
      <span>{children}</span>
      {required ? (
        <span aria-hidden="true" className="text-red-500">
          *
        </span>
      ) : null}
    </label>
  );
}

export function TextInput(
  props: InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    compact?: boolean;
  },
) {
  const {
    label,
    className,
    compact = false,
    id,
    required,
    disabled,
    ...rest
  } = props;
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <FieldLabel
        htmlFor={inputId}
        required={required}
        className={compact ? 'text-[11px]' : undefined}
      >
        {label}
      </FieldLabel>
      <input
        id={inputId}
        required={required}
        disabled={disabled}
        {...rest}
        className={cn(
          controlBaseClass,
          compact && 'min-h-[44px] rounded-[13px] px-3 text-[13px]',
          className,
        )}
      />
    </div>
  );
}

export function TextArea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label: string;
    compact?: boolean;
  },
) {
  const {
    label,
    className,
    compact = false,
    id,
    required,
    disabled,
    ...rest
  } = props;
  const generatedId = useId();
  const textareaId = id || generatedId;
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <FieldLabel
        htmlFor={textareaId}
        required={required}
        className={compact ? 'text-[11px]' : undefined}
      >
        {label}
      </FieldLabel>
      <textarea
        id={textareaId}
        required={required}
        disabled={disabled}
        {...rest}
        className={cn(
          controlBaseClass,
          'min-h-[116px] resize-y py-3 font-medium leading-6',
          compact && 'min-h-[88px] rounded-[13px] px-3 py-2.5 text-[13px]',
          className,
        )}
      />
    </div>
  );
}

export function SelectInput(
  props: SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    children: ReactNode;
    compact?: boolean;
  },
) {
  const {
    label,
    className,
    children,
    compact = false,
    id,
    required,
    disabled,
    ...rest
  } = props;
  const generatedId = useId();
  const selectId = id || generatedId;
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <FieldLabel
        htmlFor={selectId}
        required={required}
        className={compact ? 'text-[11px]' : undefined}
      >
        {label}
      </FieldLabel>
      <select
        id={selectId}
        required={required}
        disabled={disabled}
        {...rest}
        className={cn(
          controlBaseClass,
          'pr-9',
          compact && 'min-h-[44px] rounded-[13px] px-3 text-[13px]',
          className,
        )}
      >
        {children}
      </select>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  desc,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  desc?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) return;
        onChange(!checked);
      }}
      disabled={disabled}
      className={cn(
        'ui-pressable ui-pressable-card flex min-h-[56px] w-full items-start justify-between gap-3 rounded-[16px] border-2 border-slate-300 bg-white px-3 py-3 text-left shadow-none transition hover:-translate-y-0.5 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:color-mix(in_srgb,var(--app-accent)_16%,transparent)] dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600',
        checked
          ? 'border-[color:var(--app-accent)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_34%,white)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_18%,rgba(15,23,42,0.98))]'
          : 'text-[color:var(--app-text)]',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      )}
    >
      <div>
        <p className="text-[13px] font-semibold">{label}</p>
        {desc ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-5 ui-text-soft">
            {desc}
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          'mt-0.5 h-6 w-11 rounded-full p-1 transition',
          checked
            ? 'bg-[color:var(--app-accent)]'
            : 'bg-slate-200 ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-700',
        )}
      >
        <div
          className={cn(
            'h-4 w-4 rounded-full bg-white shadow-sm transition',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </div>
    </button>
  );
}

export function StatCard({
  label,
  value,
  desc,
  tone,
  compact = true,
}: {
  label: string;
  value: number | string;
  desc: string;
  tone?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'ui-panel-muted',
        compact ? 'p-2.5 sm:p-3' : 'p-4',
        tone || 'ui-text',
      )}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.16em] ui-text-soft">
        {label}
      </p>
      <p
        className={cn(
          'font-black ui-text',
          compact ? 'mt-1.5 text-[1.2rem] sm:text-[1.4rem]' : 'mt-3 text-2xl',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-4.5 ui-text-soft sm:text-[11px] sm:leading-5">
        {desc}
      </p>
    </div>
  );
}

export function SectionCard({
  id,
  title,
  desc,
  children,
  action,
  compact = true,
}: {
  id?: string;
  title: string;
  desc?: string;
  children: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        'overflow-hidden rounded-[20px] bg-white shadow-[0_10px_24px_-24px_rgba(15,23,42,0.16)] ring-1 ring-slate-100/90 dark:bg-slate-950 dark:ring-slate-800/65',
        compact
          ? 'p-2.5 sm:rounded-[22px] sm:p-3.5'
          : 'p-4 sm:rounded-[28px] sm:p-5',
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-start justify-between',
          compact ? 'gap-2.5' : 'gap-3',
        )}
      >
        <div>
          <h3
            className={cn(
              'font-bold ui-text',
              compact ? 'text-[15px]' : 'text-base',
            )}
          >
            {title}
          </h3>
          {desc ? (
            <p
              className={cn(
                'ui-text-soft',
                compact ? 'mt-0.5 text-[11px] leading-5' : 'mt-1 text-sm',
              )}
            >
              {desc}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className={compact ? 'mt-3 sm:mt-3.5' : 'mt-4 sm:mt-5'}>
        {children}
      </div>
    </section>
  );
}

export type TileIcon = ComponentType<{ className?: string }>;

export function InlineBadge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'accent' | 'warning' | 'success';
}) {
  return (
    <span
      className={cn(
        'ui-inline-meta',
        tone === 'accent' && 'ui-accent-border ui-accent-text',
        tone === 'warning' && 'ui-warning-border ui-warning-text',
        tone === 'success' && 'ui-success-border ui-success-text',
        tone === 'default' && 'ui-border ui-text-soft',
      )}
    >
      {children}
    </span>
  );
}

export function ActionTile({
  icon: Icon,
  title,
  desc,
  badge,
  href,
  onClick,
  disabled,
  emphasized,
}: {
  icon: TileIcon;
  title: string;
  desc: string;
  badge?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  emphasized?: boolean;
}) {
  const baseClassName = cn(
    'ui-pressable ui-pressable-card group min-h-[152px] rounded-[20px] bg-white px-3 py-3 text-left text-[color:var(--app-text)] shadow-[0_12px_22px_-18px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 transition duration-200 dark:bg-slate-950 dark:ring-slate-800/80',
    emphasized
      ? 'hover:-translate-y-0.5 hover:shadow-[0_20px_32px_-24px_rgba(15,23,42,0.18)]'
      : 'hover:-translate-y-0.5 hover:shadow-[0_20px_32px_-24px_rgba(15,23,42,0.18)]',
    disabled ? 'cursor-not-allowed opacity-60' : '',
  );

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-[14px] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_28%,white)] p-2 text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
          <Icon className="h-4 w-4" />
        </div>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 bg-white text-[color:var(--app-accent)] transition group-hover:translate-x-0.5 dark:border-slate-800/80 dark:bg-slate-950">
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
      {badge ? (
        <div className="mt-1.5">
          <InlineBadge tone={emphasized ? 'accent' : 'default'}>
            {badge}
          </InlineBadge>
        </div>
      ) : null}
      <p className="mt-1.5 text-[13px] font-black leading-tight text-[color:var(--app-text)]">
        {title}
      </p>
      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
        {desc}
      </p>
      <div className="mt-1.5 flex items-center justify-between border-t border-slate-200/80 pt-1.5 dark:border-slate-800/80">
        <span className="text-[10px] font-bold text-[color:var(--app-text-soft)]">
          {disabled ? 'Locked' : 'Open'}
        </span>
        <span className="h-1 w-7 rounded-full bg-[color:color-mix(in_srgb,var(--app-accent)_18%,transparent)] transition-all group-hover:w-9 group-hover:bg-[color:var(--app-accent)]" />
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={baseClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={baseClassName}
    >
      {content}
    </button>
  );
}

export function RoleBlueprintCard({
  icon: Icon,
  title,
  scope,
  desc,
  permissions,
  tone = 'default',
}: {
  icon: TileIcon;
  title: string;
  scope: string;
  desc: string;
  permissions: string[];
  tone?: 'default' | 'accent' | 'warning';
}) {
  return (
    <article
      className={cn(
        'rounded-[20px] bg-white p-3.5 text-[color:var(--app-text)] shadow-[0_14px_24px_-20px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80',
        tone === 'accent' &&
          'border-[color:var(--app-accent)]/30 bg-[color:var(--app-accent-soft)]/75',
        tone === 'warning' &&
          'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)]',
        tone === 'default' && '',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-[14px] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_28%,white)] p-2 ring-1 ring-[color:var(--app-accent-border)]">
          <Icon className="h-4 w-4" />
        </div>
        <InlineBadge
          tone={
            tone === 'accent'
              ? 'accent'
              : tone === 'warning'
                ? 'warning'
                : 'default'
          }
        >
          {scope}
        </InlineBadge>
      </div>
      <h4 className="mt-3 text-[14px] font-black">{title}</h4>
      <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
        {desc}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {permissions.map(permission => (
          <span
            key={permission}
            className="rounded-full border border-[color:var(--app-accent-border)] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--app-accent)]"
          >
            {permission}
          </span>
        ))}
      </div>
    </article>
  );
}

export function StoreSwitcherCard({
  name,
  city,
  address,
  badges,
  status,
  selected,
  summary,
  readinessPercent,
  healthLabel,
  healthTone = 'default',
  metrics = [],
  nextActionLabel,
  nextActionDesc,
  actionLabel,
  secondaryActionHref,
  secondaryActionLabel,
  onClick,
}: {
  name: string;
  city: string;
  address: string;
  badges: Array<{
    label: string;
    tone?: 'default' | 'accent' | 'warning' | 'success';
  }>;
  status: string;
  selected: boolean;
  summary: string;
  readinessPercent: number;
  healthLabel?: string;
  healthTone?: 'default' | 'accent' | 'warning' | 'success';
  metrics?: Array<{
    label: string;
    value: string;
    tone?: 'default' | 'accent' | 'warning' | 'success';
  }>;
  nextActionLabel?: string;
  nextActionDesc?: string;
  actionLabel?: string;
  secondaryActionHref?: string;
  secondaryActionLabel?: string;
  onClick: () => void;
}) {
  const visibleBadges = badges.slice(0, 5);
  const hiddenBadgeCount = Math.max(0, badges.length - visibleBadges.length);
  const safeReadiness = Math.max(0, Math.min(100, readinessPercent));
  const progressWidth = safeReadiness === 0 ? 0 : Math.max(safeReadiness, 12);

  return (
    <article
      className={cn(
        'ui-pressable-card group w-full rounded-[24px] px-4 py-4 text-left transition duration-200',
        selected
          ? 'bg-[color:color-mix(in_srgb,var(--app-accent-soft)_32%,white)] shadow-[0_20px_36px_-28px_rgba(15,23,42,0.2)] ring-1 ring-[color:var(--app-accent-border)]'
          : 'bg-white shadow-[0_14px_28px_-26px_rgba(15,23,42,0.16)] ring-1 ring-slate-200/80 hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-28px_rgba(15,23,42,0.2)] dark:bg-slate-950 dark:ring-slate-800/80',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[14px] font-black text-[color:var(--app-text)]">
              {name}
            </p>
            {healthLabel ? (
              <InlineBadge tone={healthTone}>{healthLabel}</InlineBadge>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
            {city}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full border transition',
            selected
              ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
              : 'border-slate-200/80 bg-white text-[color:var(--app-accent)] dark:border-slate-800/80 dark:bg-slate-950',
          )}
        >
          {selected ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          )}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
        {address}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {visibleBadges.map(badge => (
          <InlineBadge key={badge.label} tone={badge.tone || 'default'}>
            {badge.label}
          </InlineBadge>
        ))}
        {hiddenBadgeCount > 0 ? (
          <InlineBadge tone="default">+{hiddenBadgeCount}</InlineBadge>
        ) : null}
      </div>

      <div className="mt-3 rounded-[20px] border border-[color:var(--app-accent-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,244,235,0.9))] px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] ui-accent-text">
              {status}
            </p>
            <p className="mt-1.5 text-[11px] leading-5 ui-text-soft">
              {summary}
            </p>
          </div>
          <p className="shrink-0 text-[1.45rem] font-black text-[color:var(--app-text)]">
            {safeReadiness}%
          </p>
        </div>
        <div className="mt-3 h-2 rounded-full bg-[color:var(--app-accent-soft)]/78">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300',
              safeReadiness >= 80
                ? 'bg-[color:var(--app-accent)]'
                : safeReadiness >= 45
                  ? 'bg-[color:var(--app-warning-border)]'
                  : 'bg-slate-300',
            )}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      {metrics.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {metrics.map(metric => (
            <div
              key={metric.label}
              className={cn(
                'rounded-[18px] border px-3 py-2.5',
                metric.tone === 'accent' &&
                  'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]/70',
                metric.tone === 'success' &&
                  'border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)]',
                metric.tone === 'warning' &&
                  'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)]',
                (!metric.tone || metric.tone === 'default') &&
                  'border-slate-200/80 bg-[color:var(--app-surface-muted)]',
              )}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] ui-text-soft">
                {metric.label}
              </p>
              <p className="mt-1 text-[12px] font-black text-[color:var(--app-text)]">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {nextActionLabel || nextActionDesc ? (
        <div className="mt-3 rounded-[18px] border border-slate-200/80 bg-white/88 px-3.5 py-3 dark:border-slate-800/80 dark:bg-slate-950/88">
          {nextActionLabel ? (
            <p className="text-[10px] font-black uppercase tracking-[0.18em] ui-accent-text">
              {nextActionLabel}
            </p>
          ) : null}
          {nextActionDesc ? (
            <p className="mt-1.5 text-[11px] leading-5 ui-text-soft">
              {nextActionDesc}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onClick}
          className="ui-button-primary inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-semibold"
        >
          <span>{actionLabel || (selected ? 'Continue' : 'Open')}</span>
          {selected ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          )}
        </button>

        {secondaryActionHref && secondaryActionLabel ? (
          <Link
            href={secondaryActionHref}
            className="ui-button-secondary inline-flex min-h-[42px] items-center justify-center rounded-[16px] px-4 text-sm font-semibold"
          >
            {secondaryActionLabel}
          </Link>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200/80 pt-3 dark:border-slate-800/80">
        <span
          className={cn(
            'text-[10px] font-bold tracking-[0.02em]',
            selected
              ? 'text-[color:var(--app-accent)]'
              : 'text-[color:var(--app-text-soft)]',
          )}
        >
          {status}
        </span>
        <span className="h-1 w-8 rounded-full bg-[color:color-mix(in_srgb,var(--app-accent)_18%,transparent)] transition-all group-hover:w-10 group-hover:bg-[color:var(--app-accent)]" />
      </div>
    </article>
  );
}

export function SectionJumpTile({
  icon: Icon,
  title,
  desc,
  badge,
  onClick,
  disabled,
  tone = 'default',
  selected = false,
  actionLabel,
  selectedLabel,
  compact = true,
}: {
  icon: TileIcon;
  title: string;
  desc: string;
  badge?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'accent' | 'warning' | 'success';
  selected?: boolean;
  actionLabel?: string;
  selectedLabel?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'ui-pressable ui-pressable-card group w-full text-left transition duration-200',
        compact ? 'rounded-[18px] px-2.5 py-2.5' : 'rounded-[24px] px-4 py-4',
        selected &&
          'bg-[color:color-mix(in_srgb,var(--app-accent-soft)_36%,white)] shadow-[0_18px_38px_-28px_rgba(15,23,42,0.18)] ring-1 ring-[color:var(--app-accent-border)]',
        !selected &&
          tone === 'accent' &&
          'bg-[color:color-mix(in_srgb,var(--app-accent-soft)_28%,white)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-[color:var(--app-accent-border)]',
        tone === 'warning' &&
          'bg-[color:var(--app-warning-soft)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-[color:var(--app-warning-border)]',
        tone === 'success' &&
          'bg-[color:var(--app-success-soft)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-[color:var(--app-success-border)]',
        !selected &&
          tone === 'default' &&
          'bg-white shadow-[0_14px_28px_-24px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 hover:-translate-y-0.5 hover:shadow-[0_20px_32px_-24px_rgba(15,23,42,0.18)] dark:bg-slate-950 dark:ring-slate-800/80',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'border shadow-sm',
            compact ? 'rounded-[12px] p-1.5' : 'rounded-2xl p-2.5',
            selected
              ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
              : 'border-[color:var(--app-accent-border)] bg-white/88 text-[color:var(--app-accent)]',
          )}
        >
          <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </div>
        <div className="flex items-start gap-2">
          {badge ? (
            <InlineBadge
              tone={
                selected
                  ? 'accent'
                  : tone === 'warning'
                    ? 'warning'
                    : tone === 'success'
                      ? 'success'
                      : tone === 'accent'
                        ? 'accent'
                        : 'default'
              }
            >
              {badge}
            </InlineBadge>
          ) : null}
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-full border transition',
              compact ? 'h-7 w-7' : 'h-8 w-8',
              selected
                ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
                : 'border-slate-200/80 bg-white text-[color:var(--app-accent)] dark:border-slate-800/80 dark:bg-slate-950',
            )}
          >
            {selected ? (
              <CheckCircle2 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            ) : (
              <ChevronRight
                className={
                  compact
                    ? 'h-3.5 w-3.5 transition group-hover:translate-x-0.5'
                    : 'h-4 w-4 transition group-hover:translate-x-0.5'
                }
              />
            )}
          </span>
        </div>
      </div>
      <p
        className={cn(
          'font-black text-[color:var(--app-text)]',
          compact ? 'mt-2 text-[12px] sm:text-[13px]' : 'mt-4 text-sm',
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          'text-[color:var(--app-text-soft)]',
          compact
            ? 'mt-1 line-clamp-2 text-[10px] leading-4'
            : 'mt-1 text-xs leading-5',
        )}
      >
        {desc}
      </p>
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-t border-slate-200/80 dark:border-slate-800/80',
          compact ? 'mt-2 pt-1.5' : 'mt-4 pt-3',
        )}
      >
        <span
          className={cn(
            compact ? 'text-[10px] font-bold' : 'text-[11px] font-bold',
            selected
              ? 'text-[color:var(--app-accent)]'
              : 'text-[color:var(--app-text-soft)]',
          )}
        >
          {selected ? selectedLabel || 'Selected' : actionLabel || 'Open'}
        </span>
        <span className="h-1 w-7 rounded-full bg-[color:color-mix(in_srgb,var(--app-accent)_18%,transparent)] transition-all group-hover:w-9 group-hover:bg-[color:var(--app-accent)]" />
      </div>
    </button>
  );
}
