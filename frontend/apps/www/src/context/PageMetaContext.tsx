'use client';

import React, { useContext } from 'react';
import { MetaType } from '@/lib/routes';

const PageMetaContext = React.createContext<MetaType | undefined>(undefined);

export function PageMetaProvider({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta: MetaType;
}) {
  return (
    <PageMetaContext.Provider value={meta}>{children}</PageMetaContext.Provider>
  );
}

export function usePageMeta(): MetaType {
  const context = useContext(PageMetaContext);
  if (!context) {
    throw new Error('usePageMeta must be used within PageMetaProvider');
  }
  return context;
}