'use client';

import { ReactNode, Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import GlobalLoader from '@/components/GlobalLoader';
import NetworkStatus from '@/components/common/NetworkStatus';
import { LanguageModalProvider } from '@/components/modal/LanguageModal/LanguageModalContext';
import { usePageMeta } from '@/context/PageMetaContext';
import { AppShell } from '@/components/system/AppShell';

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
};

export default function ClientLayoutWrapper({ children, locale }: Props) {
  const meta = usePageMeta();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const sync = () => setIsDesktop(window.matchMedia('(min-width: 1024px)').matches);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const showBottom = isDesktop
    ? Boolean(meta?.bottomNav?.isVisibleOnWeb)
    : Boolean(meta?.bottomNav?.isVisibleOnMobile);

  const showNav = isDesktop
    ? Boolean(meta?.navbar?.isVisibleOnWeb)
    : Boolean(meta?.navbar?.isVisibleOnMobile);

  const showFooter = isDesktop
    ? Boolean(meta?.footer?.isVisibleOnWeb)
    : Boolean(meta?.footer?.isVisibleOnMobile);

  return (
    <>
      <GlobalLoader />
      <NetworkStatus />
      <LanguageModalProvider locale={locale}>
          
          {children}
        {/* </AppShell> */}
        <Suspense fallback={null}>
          <LanguageModal />
        </Suspense>
      </LanguageModalProvider>
    </>
  );
}
