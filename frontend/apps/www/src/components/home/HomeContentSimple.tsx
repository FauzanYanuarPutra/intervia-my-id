'use client';

import type { LajukanNewsArticle } from '@/lib/news';
import { HomeNewsProvider } from './HomeNewsContext';
import { HomeResponsiveMarketplace } from './HomeResponsiveMarketplace';
import { HomeContentErrorBoundary } from './HomeContentErrorBoundary';

type HomeContentSimpleProps = {
  locale: string;
  news?: LajukanNewsArticle[];
};

export function HomeContentSimple({
  locale,
  news = [],
}: HomeContentSimpleProps) {
  return (
    <HomeNewsProvider items={news}>
      <HomeContentErrorBoundary locale={locale}>
        <HomeResponsiveMarketplace locale={locale} />
      </HomeContentErrorBoundary>
    </HomeNewsProvider>
  );
}
