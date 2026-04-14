'use client';

import * as React from 'react';
import { cn } from '../utils/cn';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_80%,_transparent)] px-6 py-10 text-center text-[color:var(--color-text)] dark:border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--color-surface)_70%,_transparent)] dark:text-[color:var(--color-text-soft)]',
        className,
      )}
    >
      {icon ? <div className="text-[color:var(--color-text-soft)]">{icon}</div> : null}
      <div>
        <p className="text-base font-semibold">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-[color:var(--color-text)] dark:text-[color:var(--color-text-soft)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="mt-2 w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
          {action}
        </div>
      ) : null}
    </div>
  );
}
