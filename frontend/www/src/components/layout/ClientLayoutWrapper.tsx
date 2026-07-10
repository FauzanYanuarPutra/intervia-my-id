'use client';

import { ReactNode, Suspense } from 'react';

import GlobalLoader from '@/components/GlobalLoader';
import NetworkStatus from '@/components/common/NetworkStatus';
import { GlobalPreferenceDock } from '@/components/common/GlobalPreferenceDock';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import StackMaintenanceGate from '@/components/layout/StackMaintenanceGate';
import { LanguageModalProvider } from '@/components/modal/LanguageModal/LanguageModalContext';
import { LanguageModal } from '@/components/modal/LanguageModal/LanguageModal';
import type { StackStartupState } from '@/lib/system/startupState';
import { cn } from '@/lib/utils';
import { useRouteLayout } from '@/lib/useRouteLayout';
import { MobileRouteChrome } from './MobileRouteChrome';

type Props = {
  children: ReactNode;
  locale: string;
  initialMaintenanceState?: StackStartupState;
  initialLanguageSelectionRequired: boolean;
};

function resolveRouteIntent(pathname: string | null, metaIntent?: string) {
  if (metaIntent) return metaIntent === 'map-discovery' ? 'super' : metaIntent;

  const normalizedPath = (pathname || '/').replace(/^\/(id|en)(?=\/|$)/, '') || '/';
  const firstSegment = normalizedPath.split('/').filter(Boolean)[0] || 'home';
  const routeIntentMap: Record<string, string> = {
    home: 'home',
    search: 'search',
    create: 'create',
    chat: 'chat',
    reels: 'reels',
    community: 'community',
    profile: 'profile',
    notifications: 'notifications',
    settings: 'settings',
    dashboard: 'dashboard',
    jobs: 'jobs',
    support: 'support',
    property: 'property',
    marketplace: 'market',
    microgigs: 'market',
    'my-listings': 'dashboard',
    'super-app': 'super',
    usaha: 'super',
    umkm: 'super',
  };

  return routeIntentMap[firstSegment] || firstSegment;
}

function DesktopRouteHeader() {
  return (
    <>
      <div className="hidden lg:block">
        <Header />
      </div>
      <div
        aria-hidden="true"
        className="hidden h-[calc(52px+env(safe-area-inset-top))] shrink-0 sm:h-[calc(60px+env(safe-area-inset-top))] lg:block"
      />
    </>
  );
}

export default function ClientLayoutWrapper({
  children,
  initialMaintenanceState,
  locale,
  initialLanguageSelectionRequired,
}: Props) {
  const {
    pathname,
    showHeaderDesktop,
    showBottomNavMobile,
    showTopBarMobile,
    showFooterMobile,
    showFooterDesktop,
    meta,
  } = useRouteLayout();
  const isImmersiveRoute = meta.immersive === true;
  const showFooter = showFooterMobile || showFooterDesktop;
  const routeIntent = resolveRouteIntent(pathname, meta.routeIntent);

  const mobileChrome = {
    showTopBar: showTopBarMobile,
    showBottomNav: showBottomNavMobile,
    title: meta.title || '',
    eyebrow: meta.description || '',
  };

  return (
    <>
      <Suspense fallback={null}>
        <GlobalLoader />
      </Suspense>
      <NetworkStatus />
      <LanguageModalProvider
        key={locale}
        locale={locale}
        initialPromptVisible={initialLanguageSelectionRequired}
      >
        <div
          className={cn(
            'lajukan-route-surface',
            isImmersiveRoute &&
            'h-[var(--app-viewport-height)] max-h-[var(--app-viewport-height)] overflow-hidden',
            showTopBarMobile &&
            !isImmersiveRoute &&
            'pt-[calc(2.75rem+env(safe-area-inset-top))] lg:pt-0',
            showBottomNavMobile &&
            !isImmersiveRoute &&
            'pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0',
          )}
          data-route-intent={routeIntent}
          data-route-immersive={isImmersiveRoute ? 'true' : 'false'}
          data-mobile-topbar={showTopBarMobile ? 'true' : 'false'}
          data-mobile-bottom-nav={showBottomNavMobile ? 'true' : 'false'}
        >
          <StackMaintenanceGate
            chrome={
              <>
                {showHeaderDesktop ? <DesktopRouteHeader /> : null}
                {showBottomNavMobile || showTopBarMobile ? (
                  <MobileRouteChrome config={mobileChrome} locale={locale} />
                ) : null}
              </>
            }
            footer={
              showFooter && !isImmersiveRoute ? (
                <div
                  className={cn(
                    !showFooterMobile && 'hidden lg:block',
                    !showFooterDesktop && 'lg:hidden',
                  )}
                >
                  <Footer />
                </div>
              ) : null
            }
            initialState={initialMaintenanceState}
            locale={locale}
          >
            {children}
          </StackMaintenanceGate>
        </div>
        {!isImmersiveRoute ? <GlobalPreferenceDock /> : null}
        <LanguageModal />
      </LanguageModalProvider>
    </>
  );
}
