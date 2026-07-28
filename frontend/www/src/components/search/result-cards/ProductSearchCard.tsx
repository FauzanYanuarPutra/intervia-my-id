import { ExploreListingCard } from '@/components/explore/cards/ExploreListingCard';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';

export function ProductSearchCard({
  item,
  locale,
  interactive = true,
}: {
  item: GlobalSearchItem;
  locale: 'id' | 'en';
  interactive?: boolean;
}) {
  return (
    <ExploreListingCard item={item} locale={locale} interactive={interactive} />
  );
}
