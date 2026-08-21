'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AppViewportShellProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'main' | 'section';
  children: ReactNode;
};

export function AppViewportShell({
  as = 'div',
  className,
  children,
  ...props
}: AppViewportShellProps) {
  const sharedProps = {
    ...props,
    'data-app-viewport-shell': 'true',
    className: cn('lajukan-visual-viewport-shell', className),
  };

  if (as === 'main') {
    return <main {...sharedProps}>{children}</main>;
  }

  if (as === 'section') {
    return <section {...sharedProps}>{children}</section>;
  }

  return <div {...sharedProps}>{children}</div>;
}
