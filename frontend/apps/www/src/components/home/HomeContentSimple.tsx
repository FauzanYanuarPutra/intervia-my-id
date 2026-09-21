'use client';

import type { LajukanNewsArticle } from '@/lib/news';
import { HomeNewsProvider } from './HomeNewsContext';
import { HomeResponsiveMarketplace } from './HomeResponsiveMarketplace';

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
      <HomeResponsiveMarketplace locale={locale} />
    </HomeNewsProvider>
  );
}
