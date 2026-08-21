import { normalizeProfileContentTab, type ProfileContentTab } from '@/lib/profile/profileContentTabs';
import type { ListingItem } from '../types/profileListings';

export function classifyListing(item: ListingItem): ProfileContentTab {
  return normalizeProfileContentTab({
    type: item.content_type || item.status,
    category: item.category,
    metadata: item.metadata,
  });
}

