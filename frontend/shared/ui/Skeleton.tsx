'use client';

import * as React from 'react';
import { cn } from '../utils/cn';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-[color:color-mix(in_srgb,_var(--color-surface)_90%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--color-surface)_80%,_transparent)]',
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}