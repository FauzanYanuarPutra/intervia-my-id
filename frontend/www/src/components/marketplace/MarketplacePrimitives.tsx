'use client';

import { type ComponentType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MarketPageFrameProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: 'default' | 'detail' | 'create' | 'search' | 'category' | 'profile';
};

export function MarketPageFrame({
  children,
  className,
  contentClassName,
  variant = 'default',
}: MarketPageFrameProps) {
  return (
    <div
      className={cn(
        'lajukan-market-page min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(18,138,69,0.08)_0%,#fbfdfb_32%,#f7faf7_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(94,226,138,0.10)_0%,#000000_40%,#050505_100%)] lg:pb-4',
        'pb-6',
        `lajukan-market-${variant}`,
        className,
      )}
    >
      <div className={cn('page-shell py-2.5', contentClassName)}>
        {children}
      </div>
    </div>
  );
}

type MarketPanelProps = {
  children: ReactNode;
  className?: string;
  as?: ComponentType<{ className?: string; children: ReactNode }> | 'section' | 'article' | 'aside' | 'div';
};

export function MarketPanel({
  children,
  className,
  as: Component = 'section',
}: MarketPanelProps) {
  return (
    <Component
      className={cn(
        'lajukan-market-panel min-w-0 rounded-[16px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] p-3 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.18)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] sm:p-3.5',
        className,
      )}
    >
      {children}
    </Component>
  );
}

type MarketSectionHeadingProps = {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
};

export function MarketSectionHeading({
  title,
  eyebrow,
  action,
  className,
}: MarketSectionHeadingProps) {
  return (
    <div className={cn('flex min-w-0 items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-0.5 text-[0.98rem] font-bold leading-tight text-[color:var(--app-text)] sm:text-[1.05rem]">
          {title}
        </h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type MarketMobileNavProps = {
  locale: 'id' | 'en';
  authenticated: boolean;
  active?: 'home' | 'explore' | 'create' | 'transactions' | 'account';
};

export function MarketMobileNav(_props: MarketMobileNavProps) {
  return null;
}

export function MarketMobileNavAuto(
  _props: Omit<MarketMobileNavProps, 'authenticated'>,
) {
  return null;
}
