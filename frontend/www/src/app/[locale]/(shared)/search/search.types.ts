import { type LucideIcon } from 'lucide-react';
import { type ListingSide } from '@/lib/content/listingSide';
import type { BusinessDiscoveryCategoryId } from '@/lib/businessDiscoveryCategories';

export type SortKey = 'relevance' | 'newest' | 'price_low' | 'price_high';
export type TypeKey =
  | 'all'
  | 'job'
  | 'freelancer'
  | 'product'
  | 'property'
  | 'service'
  | 'tool_rental'
  | 'business_transfer'
  | 'umkm';
export type CardType = Exclude<TypeKey, 'all' | 'umkm'> | 'other';
export type SideFilter = 'all' | 'demand' | 'supply';
export type SearchResultsView = 'results' | 'umkm';
export type SearchVisualKey = TypeKey | 'other';
export type SearchFilterTabKey =
  | TypeKey
  | BusinessDiscoveryCategoryId
  | 'used_goods';

export type SearchCard = {
  id: string;
  content_type: string;
  title: string;
  summary: string;
  location: string;
  priceLabel: string;
  priceUnitLabel: string;
  typeLabel: string;
  typeKey: CardType;
  side: ListingSide;
  sideLabel: string;
  sideContextLabel: string;
  businessCategory?: BusinessDiscoveryCategoryId | null;
  supplierBadges: string[];
  image?: string;
  images: string[];
  href: string;
  profileHref?: string | null;
  updatedAt: number;
  priceCents: number | null;
  lat?: number | null;
  lng?: number | null;
  distanceKm?: number | null;
  distanceLabel?: string | null;
  liked: boolean;
  likeCount: number;
  entityKind: 'person' | 'listing';
  verified: boolean;
  hasMedia: boolean;
  ownerId?: string | null;
  ownerName?: string | null;
  storeId?: string | null;
  storeSlug?: string | null;
  storeName?: string | null;
  productId?: string | null;
};

export type CategoryVisual = {
  icon: LucideIcon;
  hintId: string;
  hintEn: string;
  cardClass: string;
  imageClass: string;
  iconBubbleClass: string;
  activeFilterClass: string;
  inactiveFilterClass: string;
  chipClass: string;
  ribbonClass: string;
  priceClass: string;
  outlineButtonClass: string;
  solidButtonClass: string;
  sidePanelClass: string;
};
