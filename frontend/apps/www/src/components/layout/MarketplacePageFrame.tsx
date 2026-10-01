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
  'lajukan-home-compact flex min-h-screen min-h-[var(--app-document-viewport-height)] min-w-0 max-w-[100vw] flex-col overflow-x-clip overscroll-x-none bg-[radial-gradient(circle_at_top,#eef9f1_0%,#f8fbff_32%,#f8fafc_100%)] px-1 pb-6 pt-3 sm:px-2 lg:h-[calc(var(--app-visual-viewport-height)-(60px+env(safe-area-inset-top)))] lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0';

const marketplaceShellClassName =
  'lajukan-home-shell mx-auto flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-clip lg:overflow-hidden';

export const homeDesktopGridClassName =
  'lajukan-home-desktop-grid relative z-0 mx-auto grid h-auto min-h-0 min-w-0 w-full max-w-[2200px] flex-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden lg:h-full lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_260px] 2xl:grid-cols-[280px_minmax(0,1fr)_340px]';
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
