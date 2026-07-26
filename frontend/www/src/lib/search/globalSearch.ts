import { getExploreCategoryBySlug } from '@/lib/discovery/lajukanCategories';

export const GLOBAL_SEARCH_TABS = [
  'all',
  'products',
  'services',
  'businesses',
  'needs',
  'communities',
  'videos',
  'users',
] as const;

export type GlobalSearchTab = (typeof GLOBAL_SEARCH_TABS)[number];
export type GlobalSearchGroupKey = Exclude<GlobalSearchTab, 'all'>;
export type GlobalSearchSort = 'relevance' | 'latest' | 'nearest';
export type GlobalSearchSide = 'all' | 'supply' | 'demand';

export type GlobalSearchState = {
  query: string;
  tab: GlobalSearchTab;
  side: GlobalSearchSide;
  category: string;
  subcategory: string;
  location: string;
  distanceKm: number | null;
  sort: GlobalSearchSort;
  cursor: string;
};

export type GlobalSearchItem = {
  id: string;
  kind: GlobalSearchGroupKey;
  title: string;
  summary: string;
  href: string;
  image: string | null;
  label: string;
  location: string;
  priceLabel: string;
  ownerName: string;
  verified: boolean;
  side: 'supply' | 'demand' | null;
  memberCount: number | null;
  viewCount: number | null;
  durationLabel: string;
  metadata: Record<
    string,
    string | number | boolean | null | Array<string | number | boolean>
  >;
};

export type GlobalSearchGroup = {
  items: GlobalSearchItem[];
  total: number;
  nextCursor: string | null;
  available: boolean;
  error: string | null;
};

export type GlobalSearchResponse = {
  query: string;
  total: number;
  groups: Record<GlobalSearchGroupKey, GlobalSearchGroup>;
  availableTabs: GlobalSearchTab[];
};

const TAB_SET = new Set<string>(GLOBAL_SEARCH_TABS);
const SORT_SET = new Set<string>(['relevance', 'latest', 'nearest']);
const SIDE_SET = new Set<string>(['all', 'supply', 'demand']);

function cleanText(value: string | null, maxLength = 160): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function parseDistance(value: string | null): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(Math.max(Math.round(parsed), 1), 100);
}

function parseSide(value: string | null): GlobalSearchSide {
  const normalized = cleanText(value, 32).toLowerCase();
  if (SIDE_SET.has(normalized)) return normalized as GlobalSearchSide;
  if (
    ['offer', 'offers', 'provider', 'seller', 'penawaran'].includes(normalized)
  ) {
    return 'supply';
  }
  if (
    [
      'need',
      'needs',
      'request',
      'requests',
      'seeker',
      'buyer',
      'kebutuhan',
    ].includes(normalized)
  ) {
    return 'demand';
  }
  return 'all';
}

export function parseGlobalSearchState(
  input: URLSearchParams | Readonly<URLSearchParams>,
): GlobalSearchState {
  const requestedTab = cleanText(input.get('tab'), 32).toLowerCase();
  const legacyType = cleanText(input.get('type'), 32).toLowerCase();
  const tabFromLegacyType: Record<string, GlobalSearchTab> = {
    product: 'products',
    property: 'products',
    tool_rental: 'products',
    business_transfer: 'products',
    service: 'services',
    freelancer: 'users',
    user: 'users',
    users: 'users',
    umkm: 'businesses',
  };
  const tab = TAB_SET.has(requestedTab)
    ? (requestedTab as GlobalSearchTab)
    : tabFromLegacyType[legacyType] || 'all';

  const requestedCategory = cleanText(input.get('category'), 80).toLowerCase();
  const category = getExploreCategoryBySlug(requestedCategory)?.slug || '';
  const requestedSort = cleanText(input.get('sort'), 32).toLowerCase();

  return {
    query: cleanText(input.get('q'), 160),
    tab,
    side: parseSide(input.get('side')),
    category,
    subcategory: cleanText(input.get('subcategory'), 80).toLowerCase(),
    location: cleanText(input.get('location'), 120),
    distanceKm: parseDistance(input.get('distance')),
    sort: SORT_SET.has(requestedSort)
      ? (requestedSort as GlobalSearchSort)
      : 'relevance',
    cursor: cleanText(input.get('cursor'), 120),
  };
}

export function serializeGlobalSearchState(state: GlobalSearchState): string {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.tab !== 'all') params.set('tab', state.tab);
  if (state.side !== 'all') params.set('side', state.side);
  if (state.category) params.set('category', state.category);
  if (state.subcategory) params.set('subcategory', state.subcategory);
  if (state.location) params.set('location', state.location);
  if (state.distanceKm !== null) {
    params.set('distance', String(state.distanceKm));
  }
  if (state.sort !== 'relevance') params.set('sort', state.sort);
  if (state.cursor) params.set('cursor', state.cursor);
  return params.toString();
}

export function emptyGlobalSearchGroup(available = true): GlobalSearchGroup {
  return {
    items: [],
    total: 0,
    nextCursor: null,
    available,
    error: null,
  };
}

export function emptyGlobalSearchResponse(query: string): GlobalSearchResponse {
  return {
    query,
    total: 0,
    groups: {
      products: emptyGlobalSearchGroup(),
      services: emptyGlobalSearchGroup(),
      businesses: emptyGlobalSearchGroup(),
      needs: emptyGlobalSearchGroup(),
      communities: emptyGlobalSearchGroup(),
      videos: emptyGlobalSearchGroup(),
      users: emptyGlobalSearchGroup(),
    },
    availableTabs: ['all'],
  };
}

function normalizedSearchText(value: string): string {
  return value.toLocaleLowerCase('id-ID').replace(/\s+/g, ' ').trim();
}

function fieldRelevance(value: string, query: string, weight: number): number {
  const text = normalizedSearchText(value);
  if (!text) return 0;
  if (text === query) return weight * 8;

  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.some(word => word === query)) return weight * 6;
  if (words.some(word => word.startsWith(query))) return weight * 4;
  if (text.includes(query)) return weight * 2;
  return 0;
}

export function rankGlobalSearchItems(
  items: GlobalSearchItem[],
  rawQuery: string,
): GlobalSearchItem[] {
  const query = normalizedSearchText(rawQuery);
  if (query.length < 2 || items.length < 2) return items;

  return items
    .map((item, index) => ({
      item,
      index,
      score:
        fieldRelevance(item.title, query, 12) +
        fieldRelevance(item.ownerName, query, 8) +
        fieldRelevance(item.label, query, 5) +
        fieldRelevance(item.summary, query, 3) +
        fieldRelevance(item.location, query, 2),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(entry => entry.item);
}
