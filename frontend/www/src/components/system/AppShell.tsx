'use client';

import type { CSSProperties, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/Header';
import ClientBottomNav from '@/components/layout/ClientBottomNav';
import { Footer } from '@/components/layout/Footer';
import { PageAssistDock } from '@/components/system/PageAssistDock';

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

export function AppShell({
  children,
  showHeader,
  showBottomNav,
  showFooter = true,
}: AppShellProps) {
  const pathname = usePathname();
  const routeIntent = resolveRouteIntent(pathname);
  const shellStyle = {
    '--app-bottom-nav-height': showBottomNav
      ? 'calc(92px + env(safe-area-inset-bottom))'
      : '0px',
  } as CSSProperties;
  const mainStyle = showBottomNav
    ? ({
        paddingBottom: 'calc(var(--app-bottom-nav-height) + var(--app-thumb-zone-gap))',
        scrollPaddingBottom:
          'calc(var(--app-bottom-nav-height) + var(--app-thumb-zone-gap))',
      } as CSSProperties)
    : undefined;

  return (
    <div
      data-route-intent={routeIntent}
      style={shellStyle}
      className="app-shell flex min-h-[100svh] w-full flex-col text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]"
    >
      {showHeader ? <Header /> : null}
      <main
        id="main-content"
        style={mainStyle}
        className={cn(
          'app-shell-main w-full flex-1',
          showHeader
            ? 'pt-[calc(60px+env(safe-area-inset-top))] sm:pt-[calc(68px+env(safe-area-inset-top))]'
            : 'pt-0',
          showBottomNav
            ? 'md:pb-5'
            : 'pb-0',
        )}
      >
        {children}
        {showHeader ? <PageAssistDock /> : null}
        {showFooter ? <Footer /> : null}
      </main>
      {showBottomNav ? <ClientBottomNav /> : null}
    </div>
  );
}
