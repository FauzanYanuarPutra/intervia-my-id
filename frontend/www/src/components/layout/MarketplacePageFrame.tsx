'use client';

import type { ReactNode } from 'react';

import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';

type MarketplacePageFrameProps = {
  children: ReactNode;
  className?: string;
  loading?: boolean;
  shellClassName?: string;
};

const marketplaceFrameClassName =
  'lajukan-home-compact min-h-screen min-h-[100dvh] max-w-[100vw] overflow-x-hidden overscroll-x-none bg-[radial-gradient(circle_at_top,#eef9f1_0%,#f8fbff_32%,#f8fafc_100%)] px-1 pb-6 pt-3 pt-0 sm:px-2 lg:h-[calc(var(--app-viewport-height)-(60px+env(safe-area-inset-top)))] lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0';

const marketplaceShellClassName =
  'lajukan-home-shell mx-auto min-w-0 max-w-full overflow-x-hidden lg:flex lg:h-full lg:flex-col lg:overflow-hidden';

export function MarketplaceHeaderSpacer() {
  return (
    <div
      aria-hidden="true"
      className="h-[calc(52px+env(safe-area-inset-top))] shrink-0 sm:h-[calc(60px+env(safe-area-inset-top))] lg:hidden"
    />
  );
}

export function MarketplacePageFrame({
  children,
  className,
  loading = false,
  shellClassName,
}: MarketplacePageFrameProps) {
  return (
    <div
      className={cn(
        marketplaceFrameClassName,
        loading && 'lajukan-home-loading',
        className,
      )}
    >
      <div className="lg:hidden">
        <Header />
      </div>
      <div className={cn(marketplaceShellClassName, shellClassName)}>
        <MarketplaceHeaderSpacer />
        {children}
      </div>
    </div>
  );
}
