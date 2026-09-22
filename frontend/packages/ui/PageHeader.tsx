import * as React from 'react'; import { cn } from '../utils/cn';

export function PageHeader({
  label,
  title,
  description,
  primaryAction,
  secondaryActions,
  className,
}: {
  label?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {label ? (
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--color-primary)]">
            {label}
          </p>
        ) : null}
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <div className="mt-1 max-w-3xl text-xs leading-5 text-[color:var(--color-text-soft)] sm:text-sm sm:leading-6">
            {description}
          </div>
        ) : null}
      </div>
      {primaryAction || secondaryActions ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {secondaryActions}
          {primaryAction}
        </div>
      ) : null}
    </header>
  );
}
