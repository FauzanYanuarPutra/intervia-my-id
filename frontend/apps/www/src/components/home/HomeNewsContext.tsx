'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { LajukanNewsArticle } from '@/lib/news';

type HomeNewsContextValue = {
  enabled: boolean;
  items: LajukanNewsArticle[];
};

const HomeNewsContext = createContext<HomeNewsContextValue>({
  enabled: false,
  items: [],
});

export function HomeNewsProvider({
  items,
  children,
}: {
  items: LajukanNewsArticle[];
  children: ReactNode;
}) {
  return (
    <HomeNewsContext.Provider value={{ enabled: true, items }}>
      {children}
    </HomeNewsContext.Provider>
  );
}

export function useHomeNews() {
  return useContext(HomeNewsContext);
}
