'use client';

import type { LajukanNewsArticle } from '@/lib/news';
import { HomeNewsProvider } from './HomeNewsContext';
import { HomeResponsiveMarketplace } from './HomeResponsiveMarketplace';
import { HomeErrorBoundary } from './HomeErrorBoundary';

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
      <HomeErrorBoundary locale={locale} section="Home">
        <HomeResponsiveMarketplace locale={locale} />
      </HomeErrorBoundary>
    </HomeNewsProvider>
  );
}
