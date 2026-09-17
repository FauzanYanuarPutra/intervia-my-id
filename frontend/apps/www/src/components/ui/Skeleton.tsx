import * as React from 'react';
import { cn } from '@/lib/utils';

type SkeletonVariant = 'block' | 'line' | 'circle' | 'media' | 'chip';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: SkeletonVariant;
  pulse?: boolean;
};

type SkeletonStatusProps = {
  label: string;
  className?: string;
};

type SkeletonGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  label: string;
  busy?: boolean;
};

const variantClassNames: Record<SkeletonVariant, string> = {
  block: 'rounded-xl',
  line: 'h-3.5 rounded-full',
  circle: 'rounded-full',
  media: 'aspect-[4/3] rounded-2xl',
  chip: 'h-8 rounded-full',
};

// Single source for loading placeholders. Route skeletons and inline loading
// states should compose this so styling/performance changes land everywhere.
export function Skeleton({
  className,
  variant = 'block',
  pulse = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-skeleton="true"
      className={cn(
        'ui-skeleton motion-reduce:animate-none',
        pulse && 'ui-skeleton-pulse',
        variantClassNames[variant],
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonStatus({ label, className }: SkeletonStatusProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn('sr-only', className)}
    >
      {label}
    </span>
  );
}

export function SkeletonGroup({
  label,
  busy = true,
  className,
  children,
  ...props
}: SkeletonGroupProps) {
  return (
    <div
      aria-busy={busy}
      className={className}
      {...props}
    >
      {busy ? <SkeletonStatus label={label} /> : null}
      {children}
    </div>
  );
}

export function SkeletonStack({
  lines = 3,
  className,
  lineClassName,
}: {
  lines?: number;
  className?: string;
  lineClassName?: string;
}) {
  const safeLines = Math.max(1, Math.min(8, lines));

  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: safeLines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="line"
          className={cn(
            index === safeLines - 1 && safeLines > 1 && 'w-2/3',
            lineClassName,
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      variant="circle"
      className={cn('h-10 w-10 shrink-0', className)}
      {...props}
    />
  );
}

export function SkeletonPanel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
