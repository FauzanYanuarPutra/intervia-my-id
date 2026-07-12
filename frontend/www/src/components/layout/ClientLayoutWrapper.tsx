'use client';

import { ReactNode, Suspense } from 'react';
import { Sparkles } from 'lucide-react';

import GlobalLoader from '@/components/GlobalLoader';
import NetworkStatus from '@/components/common/NetworkStatus';
import { GlobalPreferenceDock } from '@/components/common/GlobalPreferenceDock';
import { LocalizedAnchor } from '@/components/navigation/LocalizedAnchor';
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

  const normalizedPath =
    (pathname || '/').replace(/^\/(id|en)(?=\/|$)/, '') || '/';
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

function normalizePathname(pathname: string | null): string {
  const clean = (pathname || '/').replace(/^\/(id|en)(?=\/|$)/, '') || '/';
  return clean === '' ? '/' : clean;
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

function PersonalAiFloatingLauncher({
  pathname,
  showBottomNavMobile,
}: {
  pathname: string | null;
  showBottomNavMobile: boolean;
}) {
  const cleanPath = normalizePathname(pathname);
  const isPersonalAiPage =
    cleanPath === '/profile/ai' || cleanPath.startsWith('/profile/ai/');

  if (isPersonalAiPage) return null;

  return (
    <LocalizedAnchor
      href="/profile/ai"
      aria-label="Open Personal AI"
      title="Personal AI"
      className={cn(
        'ui-layer-sticky group fixed right-[max(env(safe-area-inset-right),0.85rem)] z-[1240]',
        'inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30',
        'bg-emerald-600 text-white shadow-[0_18px_42px_-22px_rgba(5,150,105,0.55)]',
        'transition hover:-translate-y-0.5 hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
        'md:right-[max(env(safe-area-inset-right),1.25rem)] md:h-12 md:w-auto md:gap-2 md:rounded-full md:px-4',
        showBottomNavMobile
          ? 'bottom-[calc(5.35rem+env(safe-area-inset-bottom))] md:bottom-[max(env(safe-area-inset-bottom),1.25rem)]'
          : 'bottom-[calc(1rem+env(safe-area-inset-bottom))] md:bottom-[max(env(safe-area-inset-bottom),1.25rem)]',
      )}
    >
      <Sparkles className="h-5 w-5 shrink-0" />
      <span className="hidden whitespace-nowrap text-sm font-black md:inline">
        Personal AI
      </span>
    </LocalizedAnchor>
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
              'flex h-[var(--app-viewport-height)] min-h-0 flex-col overflow-hidden',
            !isImmersiveRoute &&
              'min-h-screen min-h-[100svh] overflow-x-hidden',
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
        <PersonalAiFloatingLauncher
          pathname={pathname}
          showBottomNavMobile={showBottomNavMobile}
        />
        {!isImmersiveRoute ? <GlobalPreferenceDock /> : null}
        <LanguageModal />
      </LanguageModalProvider>
    </>
  );
}
