'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/Header';
import ClientBottomNav from '@/components/layout/ClientBottomNav';
import { Footer } from '@/components/layout/Footer';

const DeferredPageAssistDock = dynamic(
  () =>
    import('@/components/system/PageAssistDock').then(mod => mod.PageAssistDock),
  { ssr: false, loading: () => null },
);

type AppShellProps = {
  children: ReactNode;
  showHeader: boolean;
  showBottomNav: boolean;
  showFooter?: boolean;
};

type RouteIntent =
  | 'home'
  | 'search'
  | 'features'
  | 'super'
  | 'dashboard'
  | 'create'
  | 'payments'
  | 'activity'
  | 'notifications'
  | 'settings'
  | 'profile'
  | 'content'
  | 'support'
  | 'default';

function normalizePathname(pathname: string) {
  const clean = pathname.replace(/^\/(id|en)(?=\/|$)/, '');
  return clean === '' ? '/' : clean;
}

function resolveRouteIntent(pathname: string): RouteIntent {
  const cleanPath = normalizePathname(pathname);

  if (cleanPath === '/' || cleanPath.startsWith('/home')) return 'home';
  if (
    cleanPath.startsWith('/kategori') ||
    cleanPath.startsWith('/search') ||
    cleanPath.startsWith('/marketplace') ||
    cleanPath.startsWith('/jobs') ||
    cleanPath.startsWith('/freelancers') ||
    cleanPath.startsWith('/property') ||
    cleanPath.startsWith('/microgigs')
  ) {
    return 'search';
  }
  if (cleanPath.startsWith('/lainnya') || cleanPath.startsWith('/community')) {
    return 'features';
  }
  if (cleanPath.startsWith('/super-app')) return 'super';
  if (cleanPath.startsWith('/dashboard')) return 'dashboard';
  if (
    cleanPath === '/create' ||
    cleanPath.endsWith('/create') ||
    cleanPath.startsWith('/company/create')
  ) {
    return 'create';
  }
  if (cleanPath.startsWith('/payments')) return 'payments';
  if (cleanPath.startsWith('/transactions')) return 'activity';
  if (cleanPath.startsWith('/notifications')) return 'notifications';
  if (cleanPath.startsWith('/settings')) return 'settings';
  if (cleanPath.startsWith('/profile')) return 'profile';
  if (cleanPath.startsWith('/content/')) return 'content';
  if (cleanPath.startsWith('/support')) return 'support';
  return 'default';
}

function shouldUseDetailMobileChrome(pathname: string) {
  const cleanPath = normalizePathname(pathname);

  return (
    /^\/content\/[^/]+\/?$/.test(cleanPath) ||
    /^\/jobs\/(?!create(?:\/|$))[^/]+\/?$/.test(cleanPath) ||
    /^\/property\/(?!create(?:\/|$))[^/]+\/?$/.test(cleanPath) ||
    /^\/profile\/(?!edit(?:\/|$)|freelancer(?:\/|$))[^/]+\/?$/.test(cleanPath) ||
    /^\/transactions\/[^/]+\/?$/.test(cleanPath)
  );
}

export function AppShell({
  children,
  showHeader,
  showBottomNav,
  showFooter = true,
}: AppShellProps) {
  const pathname = usePathname();
  const [assistDockReady, setAssistDockReady] = useState(false);
  const routeIntent = resolveRouteIntent(pathname);
  const effectiveShowBottomNav = showBottomNav && !shouldUseDetailMobileChrome(pathname);
  const shellStyle = {
    '--app-bottom-nav-height': effectiveShowBottomNav
      ? 'calc(66px + env(safe-area-inset-bottom))'
      : '0px',
  } as CSSProperties;
  const mainStyle = effectiveShowBottomNav
    ? ({
        paddingBottom: 'calc(var(--app-bottom-nav-height) + var(--app-thumb-zone-gap))',
        scrollPaddingBottom:
          'calc(var(--app-bottom-nav-height) + var(--app-thumb-zone-gap))',
      } as CSSProperties)
    : undefined;

  useEffect(() => {
    if (!showHeader || typeof window === 'undefined') {
      setAssistDockReady(false);
      return;
    }
    const idleWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions,
        ) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    if (typeof idleWindow.requestIdleCallback === 'function') {
      const idleId = idleWindow.requestIdleCallback(
        () => setAssistDockReady(true),
        { timeout: 2400 },
      );
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = globalThis.setTimeout(() => setAssistDockReady(true), 1200);
    return () => globalThis.clearTimeout(timeoutId);
  }, [showHeader]);

  return (
    <div
      data-route-intent={routeIntent}
      style={shellStyle}
      className="app-shell relative isolate flex min-h-[100svh] w-full flex-col overflow-x-clip bg-[radial-gradient(circle_at_top,#eef9f1_0%,#f8fbff_34%,#f8fafc_100%)] text-[color:var(--app-text)] dark:bg-[radial-gradient(circle_at_top,#052e1d_0%,#07111d_38%,#020617_100%)] dark:text-[color:var(--app-text-soft)]"
    >
      {showHeader ? (
        <div className="relative z-[1]">
          <Header />
        </div>
      ) : null}
      <main
        id="main-content"
        style={mainStyle}
        className={cn(
          'app-shell-main relative z-[1] w-full flex-1',
          showHeader
            ? 'pt-[calc(52px+env(safe-area-inset-top))] sm:pt-[calc(60px+env(safe-area-inset-top))]'
            : 'pt-0',
          effectiveShowBottomNav
            ? 'md:pb-5'
            : 'pb-0',
        )}
      >
        {children}
        {showHeader && assistDockReady ? <DeferredPageAssistDock /> : null}
        {showFooter ? <Footer /> : null}
      </main>
      {effectiveShowBottomNav ? (
        <div className="relative z-[1]">
          <ClientBottomNav />
        </div>
      ) : null}
    </div>
  );
}
