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

export const BUSINESS_DISCOVERY_CATEGORIES: BusinessDiscoveryCategory[] = [
  {
    id: 'equipment',
    layer: 'core',
    launchPriority: 10,
    isTransactionCategory: true,
    isLocationCapability: false,
    labelId: 'Mesin & Alat',
    labelEn: 'Equipment & Tools',
    badgeId: 'Laris',
    badgeEn: 'Popular',
    hintId: 'Mesin, alat produksi, sewa alat, dan perlengkapan usaha.',
    hintEn: 'Machines, production tools, rentals, and business equipment.',
    searchHref: '/search?type=product&q=mesin%20usaha',
    searchType: 'product',
    query: 'mesin usaha',
    createSlugId: 'mesin-alat',
    createSlugEn: 'equipment-tools',
  },
  {
    id: 'supplies',
    layer: 'core',
    launchPriority: 20,
    isTransactionCategory: true,
    isLocationCapability: false,
    labelId: 'Bahan Usaha',
    labelEn: 'Business Supplies',
    badgeId: 'Grosir',
    badgeEn: 'Wholesale',
    hintId: 'Bahan baku, stok grosir, kemasan, dan produk jual ulang.',
    hintEn: 'Raw materials, wholesale stock, packaging, and resale goods.',
    searchHref: '/search?type=product&q=bahan%20usaha',
    searchType: 'product',
    query: 'bahan usaha',
    createSlugId: 'bahan-usaha',
    createSlugEn: 'business-supplies',
  },
  {
    id: 'service',
    layer: 'core',
    launchPriority: 30,
    isTransactionCategory: true,
    isLocationCapability: false,
    labelId: 'Cari Jasa',
    labelEn: 'Find Services',
    badgeId: 'Expert',
    badgeEn: 'Expert',
    hintId: 'Jasa operasional, kreatif, legal, digital, dan lapangan.',
    hintEn: 'Operations, creative, legal, digital, and field services.',
    searchHref: '/search?type=service&q=jasa',
    searchType: 'service',
    query: 'jasa',
    createSlugId: 'jasa',
    createSlugEn: 'services',
  },
  {
    id: 'property',
    layer: 'core',
    launchPriority: 40,
    isTransactionCategory: true,
    isLocationCapability: false,
    labelId: 'Tempat Usaha',
    labelEn: 'Business Places',
    badgeId: 'Prime',
    badgeEn: 'Prime',
    hintId: 'Ruko, kios, booth, gudang kecil, dan lokasi jualan.',
    hintEn: 'Shophouses, kiosks, booths, small warehouses, and selling spots.',
    searchHref: '/search?type=property&q=tempat%20usaha',
    searchType: 'property',
    query: 'tempat usaha',
    createSlugId: 'tempat-usaha',
    createSlugEn: 'business-place',
  },
  {
    id: 'nearby',
    layer: 'capability',
    launchPriority: 50,
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
  },
  {
    id: 'opportunity',
    layer: 'growth',
    launchPriority: 60,
    isTransactionCategory: false,
    isLocationCapability: false,
    labelId: 'Peluang Usaha',
    labelEn: 'Business Opportunities',
    badgeId: 'Cuan',
    badgeEn: 'Grow',
    hintId: 'Franchise, kemitraan, reseller, distributor, dan peluang jalan.',
    hintEn: 'Franchises, partnerships, resellers, distributors, and ready opportunities.',
    searchHref: '/search?q=peluang%20usaha%20franchise%20kemitraan%20reseller',
    searchType: 'all',
    query: 'peluang usaha franchise kemitraan reseller',
    createSlugId: 'peluang-usaha',
    createSlugEn: 'business-opportunity',
  },
];

export const CORE_BUSINESS_DISCOVERY_CATEGORY_IDS = [
  'equipment',
  'supplies',
  'service',
  'property',
] as const satisfies readonly BusinessDiscoveryCategoryId[];

export const LOCATION_CAPABILITY_CATEGORY_IDS = [
  'nearby',
] as const satisfies readonly BusinessDiscoveryCategoryId[];

export const GROWTH_BUSINESS_DISCOVERY_CATEGORY_IDS = [
  'opportunity',
] as const satisfies readonly BusinessDiscoveryCategoryId[];

export const RESULT_BUSINESS_DISCOVERY_CATEGORY_IDS = [
  ...CORE_BUSINESS_DISCOVERY_CATEGORY_IDS,
  ...GROWTH_BUSINESS_DISCOVERY_CATEGORY_IDS,
] as const satisfies readonly BusinessDiscoveryCategoryId[];

export const HOME_BUSINESS_DISCOVERY_CATEGORY_IDS = [
  ...CORE_BUSINESS_DISCOVERY_CATEGORY_IDS,
  ...LOCATION_CAPABILITY_CATEGORY_IDS,
  ...GROWTH_BUSINESS_DISCOVERY_CATEGORY_IDS,
] as const satisfies readonly BusinessDiscoveryCategoryId[];

export function getBusinessDiscoveryCategoryById(
  id: string | null | undefined,
): BusinessDiscoveryCategory | null {
  return BUSINESS_DISCOVERY_CATEGORIES.find(item => item.id === id) || null;
}

export function getBusinessDiscoveryCategoriesByLayer(
  layer: BusinessDiscoveryLayer,
): BusinessDiscoveryCategory[] {
  return BUSINESS_DISCOVERY_CATEGORIES.filter(item => item.layer === layer).sort(
    (left, right) => left.launchPriority - right.launchPriority,
  );
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
  const flow = side === 'demand' ? (locale === 'en' ? 'need' : 'butuh') : locale === 'en' ? 'sell' : 'jual';
  const slug = locale === 'en' ? category.createSlugEn : category.createSlugId;
  return `/create/${flow}/${slug}`;
}
