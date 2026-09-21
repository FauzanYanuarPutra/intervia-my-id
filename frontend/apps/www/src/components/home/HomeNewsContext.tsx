'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { LajukanNewsArticle } from '@/lib/news';

type HomeNewsContextValue = {
  items: LajukanNewsArticle[];
};

const HomeNewsContext = createContext<HomeNewsContextValue>({
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
    <HomeNewsContext.Provider value={{ items }}>
      {children}
    </HomeNewsContext.Provider>
  );
}

export function useHomeNews() {
  return useContext(HomeNewsContext);
}
