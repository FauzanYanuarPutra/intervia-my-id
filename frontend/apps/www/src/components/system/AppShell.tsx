'use client';

import type { CSSProperties, ReactNode } from 'react';
// import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
// import { cn } from '@/lib/utils';
// import { Header } from '@/components/layout/Header';
// import ClientBottomNav from '@/components/layout/ClientBottomNav';
// import { Footer } from '@/components/layout/Footer';
// import { useRouteLayout } from '@/lib/useRouteLayout';

const DeferredPageAssistDock = dynamic(
  () => import('@/components/system/PageAssistDock').then(m => m.PageAssistDock),
  { ssr: false, loading: () => null }
);

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: { children: ReactNode }) {

  // const finalShowHeader = showHeader && !isChat;
  // const finalShowBottomNav = showBottomNav && !isChat;
  // const finalShowFooter = showFooter && !isChat;


  return (
    <div className="flex min-h-[100svh] flex-col bg-white dark:bg-slate-950">

      {/* {finalShowHeader && <Header />} */}

      <main className="flex-1 w-full pt-[calc(56px+env(safe-area-inset-top))]">
        {children}
        {/* {finalShowHeader && <DeferredPageAssistDock />} */}
        {/* {finalShowFooter && <Footer />} */}
      </main>

      {/* {finalShowBottomNav && <ClientBottomNav />} */}
    </div>
  );
}