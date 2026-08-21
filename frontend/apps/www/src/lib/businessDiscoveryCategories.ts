import {
  MARKETPLACE_EXPLORE_CATEGORIES,
  getExploreCategoryBySlug,
} from '@/lib/discovery/lajukanCategories';

export type BusinessDiscoveryCategoryId =
  | 'equipment'
  | 'supplies'
  | 'service'
  | 'property'
  | 'nearby'
  | 'opportunity';

export type BusinessDiscoveryLayer = 'core' | 'capability' | 'growth';

export type BusinessDiscoveryCategory = {
  id: BusinessDiscoveryCategoryId;
  layer: BusinessDiscoveryLayer;
  launchPriority: number;
  isTransactionCategory: boolean;
  isLocationCapability: boolean;
  labelId: string;
  labelEn: string;
  badgeId: string;
  badgeEn: string;
  hintId: string;
  hintEn: string;
  searchHref: string;
  searchType: 'all' | 'product' | 'service' | 'property' | 'umkm';
  query: string;
  createSlugId: string;
  createSlugEn: string;
};

const SEARCH_TYPE_BY_ID: Record<
  Exclude<BusinessDiscoveryCategoryId, 'nearby'>,
  BusinessDiscoveryCategory['searchType']
> = {
  supplies: 'product',
  service: 'service',
  equipment: 'product',
  property: 'property',
  opportunity: 'all',
};

const MARKETPLACE_CATEGORIES: BusinessDiscoveryCategory[] =
  MARKETPLACE_EXPLORE_CATEGORIES.map(category => ({
    id: category.id as Exclude<BusinessDiscoveryCategoryId, 'nearby'>,
    layer: 'core',
    launchPriority: category.navigation.order,
    isTransactionCategory: true,
    isLocationCapability: false,
    labelId: category.labelId,
    labelEn: category.labelEn,
    badgeId: category.badge.labelId,
    badgeEn: category.badge.labelEn,
    hintId: category.descriptionId,
    hintEn: category.descriptionEn,
    searchHref: `/explore/${category.slug}`,
    searchType:
      SEARCH_TYPE_BY_ID[
        category.id as Exclude<BusinessDiscoveryCategoryId, 'nearby'>
      ],
    query: category.searchQuery,
    createSlugId: category.slug,
    createSlugEn: category.slug,
  }));

const NEARBY_CATEGORY: BusinessDiscoveryCategory = {
  id: 'nearby',
  layer: 'capability',
  launchPriority: 80,
  isTransactionCategory: false,
  isLocationCapability: true,
  labelId: 'Usaha Sekitar',
  labelEn: 'Nearby Businesses',
  badgeId: 'Dekat',
  badgeEn: 'Nearby',
  hintId: 'UMKM sekitar untuk partner, reseller, dan kolaborasi.',
  hintEn: 'Nearby SMEs for partners, resellers, and collaboration.',
  searchHref: '/umkm',
  searchType: 'umkm',
  query: '',
  createSlugId: 'usaha-sekitar',
  createSlugEn: 'nearby-business',
};

export const BUSINESS_DISCOVERY_CATEGORIES: BusinessDiscoveryCategory[] = [
  ...MARKETPLACE_CATEGORIES,
  NEARBY_CATEGORY,
].sort((left, right) => left.launchPriority - right.launchPriority);

export const CORE_BUSINESS_DISCOVERY_CATEGORY_IDS = [
  'supplies',
  'service',
  'equipment',
  'property',
  'opportunity',
] as const satisfies readonly BusinessDiscoveryCategoryId[];

export const LOCATION_CAPABILITY_CATEGORY_IDS = [
  'nearby',
] as const satisfies readonly BusinessDiscoveryCategoryId[];

export const GROWTH_BUSINESS_DISCOVERY_CATEGORY_IDS =
  [] as const satisfies readonly BusinessDiscoveryCategoryId[];

export const RESULT_BUSINESS_DISCOVERY_CATEGORY_IDS = [
  ...CORE_BUSINESS_DISCOVERY_CATEGORY_IDS,
  ...GROWTH_BUSINESS_DISCOVERY_CATEGORY_IDS,
] as const satisfies readonly BusinessDiscoveryCategoryId[];

export const HOME_BUSINESS_DISCOVERY_CATEGORY_IDS = [
  ...CORE_BUSINESS_DISCOVERY_CATEGORY_IDS,
] as const satisfies readonly BusinessDiscoveryCategoryId[];

export function getBusinessDiscoveryCategoryById(
  id: string | null | undefined,
): BusinessDiscoveryCategory | null {
  return BUSINESS_DISCOVERY_CATEGORIES.find(item => item.id === id) || null;
}

export function getBusinessDiscoveryCategoryByCreateSlug(
  slug: string | null | undefined,
): BusinessDiscoveryCategory | null {
  const normalized = slug?.trim().toLowerCase();
  if (!normalized) return null;

  const exploreCategory = getExploreCategoryBySlug(normalized);
  if (
    exploreCategory &&
    exploreCategory.id !== 'community' &&
    exploreCategory.id !== 'video'
  ) {
    return getBusinessDiscoveryCategoryById(exploreCategory.id);
  }

  return (
    BUSINESS_DISCOVERY_CATEGORIES.find(
      item =>
        item.createSlugId === normalized ||
        item.createSlugEn === normalized ||
        item.id === normalized,
    ) || null
  );
}

export function getBusinessDiscoveryCategoriesByLayer(
  layer: BusinessDiscoveryLayer,
): BusinessDiscoveryCategory[] {
  return BUSINESS_DISCOVERY_CATEGORIES.filter(
    item => item.layer === layer,
  ).sort((left, right) => left.launchPriority - right.launchPriority);
}

export function isCoreBusinessDiscoveryCategoryId(
  id: string | null | undefined,
): id is (typeof CORE_BUSINESS_DISCOVERY_CATEGORY_IDS)[number] {
  return CORE_BUSINESS_DISCOVERY_CATEGORY_IDS.includes(
    id as (typeof CORE_BUSINESS_DISCOVERY_CATEGORY_IDS)[number],
  );
}

export function isLocationCapabilityCategoryId(
  id: string | null | undefined,
): id is (typeof LOCATION_CAPABILITY_CATEGORY_IDS)[number] {
  return LOCATION_CAPABILITY_CATEGORY_IDS.includes(
    id as (typeof LOCATION_CAPABILITY_CATEGORY_IDS)[number],
  );
}

export function isResultBusinessDiscoveryCategoryId(
  id: string | null | undefined,
): id is (typeof RESULT_BUSINESS_DISCOVERY_CATEGORY_IDS)[number] {
  return RESULT_BUSINESS_DISCOVERY_CATEGORY_IDS.includes(
    id as (typeof RESULT_BUSINESS_DISCOVERY_CATEGORY_IDS)[number],
  );
}

export function buildBusinessDiscoveryCreateHref({
  locale,
  side,
  category,
}: {
  locale: string;
  side: 'demand' | 'supply';
  category: BusinessDiscoveryCategory;
}): string {
  const flow =
    side === 'demand'
      ? locale === 'en'
        ? 'need'
        : 'butuh'
      : locale === 'en'
        ? 'sell'
        : 'jual';
  const slug = locale === 'en' ? category.createSlugEn : category.createSlugId;
  return `/create/${flow}/${slug}`;
}
