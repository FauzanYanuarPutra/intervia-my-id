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
    showHeaderDesktop,
    showBottomNavMobile,
    showTopBarMobile,
    showFooterMobile,
    showFooterDesktop,
    meta,
  } = useRouteLayout();
  const isImmersiveRoute = meta.immersive === true;
  const showFooter = showFooterMobile || showFooterDesktop;

  const mobileChrome = {
    showTopBar: showTopBarMobile,
    showBottomNav: showBottomNavMobile,
    title: '',
    eyebrow: '',
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
            isImmersiveRoute && 'h-[100dvh] overflow-hidden',
            showTopBarMobile &&
            !isImmersiveRoute &&
            'pt-[calc(2.75rem+env(safe-area-inset-top))] lg:pt-0',
            showBottomNavMobile &&
            !isImmersiveRoute &&
            'pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0',
          )}
        // data-route-intent={resolveRouteIntent(pathname)}
        // data-mobile-bottom-nav={showBottomNavMobile ? 'true' : 'false'}
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
