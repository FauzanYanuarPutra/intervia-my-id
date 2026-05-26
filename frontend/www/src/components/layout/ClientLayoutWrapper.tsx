'use client';

import { ReactNode, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import GlobalLoader from '@/components/GlobalLoader';
import NetworkStatus from '@/components/common/NetworkStatus';
import { GlobalPreferenceDock } from '@/components/common/GlobalPreferenceDock';
import { DevelopmentStageNotice } from '@/components/layout/DevelopmentStageNotice';
import {
  MobileRouteChrome,
  resolveMobileRouteChromeConfig,
} from '@/components/layout/MobileRouteChrome';
import StackMaintenanceGate from '@/components/layout/StackMaintenanceGate';
import { LanguageModalProvider } from '@/components/modal/LanguageModal/LanguageModalContext';
import type { StackStartupState } from '@/lib/system/startupState';
import { cn } from '@/lib/utils';

const LanguageModal = dynamic(
  () =>
    import('@/components/modal/LanguageModal/LanguageModal').then(
      m => m.LanguageModal,
    ),
  { ssr: false, loading: () => null },
);

type Props = {
  children: ReactNode;
  locale: string;
  initialMaintenanceState?: StackStartupState;
};

function resolveRouteIntent(pathname: string | null): string {
  const path = (pathname || '/').replace(/^\/(id|en)(?=\/|$)/, '') || '/';

  if (path === '/' || path.startsWith('/home')) return 'home';
  if (path.startsWith('/search') || path.startsWith('/kategori')) return 'search';
  if (path.startsWith('/create')) return 'create';
  if (path.startsWith('/reels')) return 'reels';
  if (path.startsWith('/chat')) return 'chat';
  if (
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/onboarding')
  ) return 'auth';
  if (path.startsWith('/community') || path.startsWith('/forum')) return 'community';
  if (path.startsWith('/jobs') || path.startsWith('/projects') || path.startsWith('/my-applications')) return 'jobs';
  if (path.startsWith('/property')) return 'property';
  if (path.startsWith('/marketplace') || path.startsWith('/listing') || path.startsWith('/content')) return 'market';
  if (path.startsWith('/super-app') || path.startsWith('/usaha') || path.startsWith('/umkm')) return 'super';
  if (path.startsWith('/profile') || path.startsWith('/freelancers')) return 'profile';
  if (path.startsWith('/transactions') || path.startsWith('/payments')) return 'activity';
  if (path.startsWith('/notifications')) return 'notifications';
  if (path.startsWith('/settings')) return 'settings';
  if (path.startsWith('/support') || path.startsWith('/contact')) return 'support';
  if (path.startsWith('/trust') || path.startsWith('/privacy') || path.startsWith('/terms')) return 'trust';
  if (path.startsWith('/dashboard') || path.startsWith('/my-')) return 'dashboard';

  return 'market';
}

export default function ClientLayoutWrapper({
  children,
  initialMaintenanceState,
  locale,
}: Props) {
  const pathname = usePathname();
  const mobileChrome = resolveMobileRouteChromeConfig(pathname, locale);

  return (
    <>
      <GlobalLoader />
      <NetworkStatus />
      <DevelopmentStageNotice locale={locale} />
      <LanguageModalProvider locale={locale}>
        <div
          className={cn(
            'lajukan-route-surface',
            mobileChrome.showBottomNav &&
              'pb-[calc(3.35rem+env(safe-area-inset-bottom))] lg:pb-0',
          )}
          data-route-intent={resolveRouteIntent(pathname)}
          data-mobile-bottom-nav={mobileChrome.showBottomNav ? 'true' : 'false'}
        >
          <StackMaintenanceGate
            chrome={<MobileRouteChrome config={mobileChrome} locale={locale} />}
            initialState={initialMaintenanceState}
            locale={locale}
          >
            {children}
          </StackMaintenanceGate>
        </div>
        <GlobalPreferenceDock />
        <Suspense fallback={null}>
          <LanguageModal />
        </Suspense>
      </LanguageModalProvider>
    </>
  );
}
