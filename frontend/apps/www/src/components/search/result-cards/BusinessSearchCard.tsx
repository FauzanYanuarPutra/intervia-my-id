import { ExploreBusinessCard } from '@/components/explore/cards/ExploreBusinessCard';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';

export function BusinessSearchCard({
  item,
  locale,
}: {
  item: GlobalSearchItem;
  locale: 'id' | 'en';
}) {
  return <ExploreBusinessCard item={item} locale={locale} />;
}
