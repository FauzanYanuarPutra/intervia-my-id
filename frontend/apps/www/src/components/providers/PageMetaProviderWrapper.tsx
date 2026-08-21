'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { getPageMeta } from '@/config/pageMeta';
import { PageMetaProvider } from '@/context/PageMetaContext';

function PageMetaProviderWrapperComponent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const meta = React.useMemo(() => getPageMeta(pathname), [pathname]);

  return <PageMetaProvider meta={meta}>{children}</PageMetaProvider>;
}

export const PageMetaProviderWrapper = React.memo(
  PageMetaProviderWrapperComponent,
);