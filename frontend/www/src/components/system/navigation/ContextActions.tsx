'use client';

import { useMemo, useState } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { cn } from '@/lib/utils';

type ActionConfig = {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
};

type ContextActionsProps = {
  primaryAction?: ActionConfig;
  secondaryActions?: ActionConfig[];
  className?: string;
};

export function ContextActions({
  primaryAction,
  secondaryActions = [],
  className,
}: ContextActionsProps) {
  const [open, setOpen] = useState(false);
  const hasSecondary = secondaryActions.length > 0;

  const content = useMemo(
    () =>
      secondaryActions.map((action) => {
        const Icon = action.icon;
        const baseClass = cn(
          'flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium transition',
          action.danger
            ? 'text-[color:var(--app-danger)] hover:bg-[color:var(--app-danger-soft)] dark:text-[color:var(--app-danger)] dark:hover:bg-[color:color-mix(in_srgb,_var(--app-danger)_30%,_transparent)]'
            : 'text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]',
          action.disabled && 'cursor-not-allowed opacity-50',
        );

        if (action.href) {
          return (
            <Link key={action.id} href={action.href} className={baseClass} onClick={() => setOpen(false)}>
              {Icon ? <Icon className="h-4 w-4" /> : null}
              <span>{action.label}</span>
            </Link>
          );
        }

        return (
          <button
            key={action.id}
            type="button"
            className={baseClass}
            onClick={() => {
              if (action.disabled) return;
              action.onClick?.();
              setOpen(false);
            }}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            <span>{action.label}</span>
          </button>
        );
      }),
    [secondaryActions],
  );

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {primaryAction ? (
        primaryAction.href ? (
          <Link
            href={primaryAction.href}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[color:var(--app-accent-strong)] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] dark:bg-[color:var(--app-accent)] dark:hover:bg-[color:var(--app-accent)]"
          >
            {primaryAction.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[color:var(--app-accent-strong)] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[color:var(--app-accent)] dark:hover:bg-[color:var(--app-accent)]"
          >
            {primaryAction.label}
          </button>
        )
      ) : null}

      {hasSecondary ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="More actions"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {open ? (
            <div
              role="menu"
              className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-1.5 shadow-lg dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            >
              {content}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
