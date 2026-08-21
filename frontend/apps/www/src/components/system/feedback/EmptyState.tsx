'use client';

import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-5 py-10 text-center dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]',
        className,
      )}
      aria-live="polite"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--app-surface)] text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">{title}</h3>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex items-center justify-center">{action}</div> : null}
    </section>
  );
}