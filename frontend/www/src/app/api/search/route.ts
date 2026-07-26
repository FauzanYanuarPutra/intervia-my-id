import { NextRequest, NextResponse } from 'next/server';

import { buildPublicProfileHref } from '@/lib/profile/publicProfileLink';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  emptyGlobalSearchResponse,
  parseGlobalSearchState,
  rankGlobalSearchItems,
  type GlobalSearchGroup,
  type GlobalSearchGroupKey,
  type GlobalSearchItem,
  type GlobalSearchResponse,
  type GlobalSearchSide,
  type GlobalSearchTab,
} from '@/lib/search/globalSearch';
import {
  mapCommunityGroup,
  mapCommunityPost,
  mapVideo,
} from '@/lib/search/socialSearchMappers';
import { getExploreCategoryBySlug } from '@/lib/discovery/lajukanCategories';
import { getInternalWwwOrigin } from '@/lib/server/internalWwwOrigin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonRecord = Record<string, unknown>;

const GROUP_KEYS: GlobalSearchGroupKey[] = [
  'products',
  'services',
  'businesses',
  'needs',
  'communities',
  'videos',
  'users',
];

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is JsonRecord => Boolean(item))
    : [];
}

function readString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['1', 'true', 'yes', 'verified'].includes(
    readString(value).toLowerCase(),
  );
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(readString).filter(Boolean);
  const text = readString(value);
  if (!text) return [];
  return text
    .split(/[,\n]/)
    .map(part => part.trim())
    .filter(Boolean);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = readString(value);
    if (text) return text;
  }
  return '';
}

function firstImage(
  item: JsonRecord,
  metadata?: JsonRecord | null,
): string | null {
  const direct = firstString(
    item.cover_image,
    item.image,
    item.image_url,
    item.thumbnail_url,
    item.avatar_url,
    metadata?.cover_image,
    metadata?.image,
    metadata?.image_url,
  );
  if (direct) return direct;

  for (const candidate of [
    item.image_urls,
    item.images,
    metadata?.image_urls,
    metadata?.gallery_images,
    metadata?.images,
  ]) {
    if (!Array.isArray(candidate)) continue;
    const image = candidate.map(readString).find(Boolean);
    if (image) return image;
  }

  return null;
}

function formatPrice(value: number | null, currency = 'IDR'): string {
  if (value === null) return '';
  const normalized =
    currency.toUpperCase() === 'IDR' ? value / 100 : value / 100;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: currency || 'IDR',
    maximumFractionDigits: 0,
  }).format(normalized);
}

function inferSide(item: JsonRecord, metadata: JsonRecord | null) {
  const token = [
    item.side,
    item.intent,
    item.listing_intent,
    item.pricing_mode,
    metadata?.side,
    metadata?.market_side,
    metadata?.listing_side,
    metadata?.intent,
    metadata?.pricing_mode,
    metadata?.offer_type,
  ]
    .map(readString)
    .join(' ')
    .toLowerCase();
  if (/request|demand|need|seeker|buyer|mencari|pencari|butuh/.test(token))
    return 'demand' as const;
  if (/provider|supply|offer|seller|penyedia|menawarkan/.test(token))
    return 'supply' as const;
  return 'supply' as const;
}

function contentKind(
  item: JsonRecord,
  metadata: JsonRecord | null,
): 'products' | 'services' | 'needs' {
  if (inferSide(item, metadata) === 'demand') return 'needs';
  const token = [item.content_type, item.type, item.category, metadata?.type]
    .map(readString)
    .join(' ')
    .toLowerCase();
  return token.includes('service') || token.includes('jasa')
    ? 'services'
    : 'products';
}

function mapContentItem(item: JsonRecord): GlobalSearchItem | null {
  const id = readString(item.id);
  if (!id) return null;
  const metadata = asRecord(item.metadata);
  const owner = asRecord(item.owner_profile);
  const kind = contentKind(item, metadata);
  const side = inferSide(item, metadata);
  const contentType = firstString(item.content_type, item.type, item.category);
  const price = readNumber(item.price_cents);
  const requestStatus = firstString(metadata?.request_status, metadata?.status);
  const quantity = firstString(
    metadata?.quantity,
    metadata?.required_quantity,
    metadata?.quantity_needed,
  );
  const quantityUnit = firstString(
    metadata?.unit,
    metadata?.quantity_unit,
    metadata?.unit_label,
  );
  const budgetLabel = firstString(
    metadata?.budget_label,
    metadata?.budget_range,
    metadata?.budget,
    metadata?.capital_range,
    metadata?.price_label,
  );
  const deadline = firstString(
    metadata?.needed_by,
    metadata?.target_done,
    metadata?.target_move,
    metadata?.target_date,
    metadata?.deadline,
  );
  const needFrequency = firstString(
    metadata?.need_frequency,
    metadata?.preferred_period,
    metadata?.buy_or_rent,
    metadata?.rent_or_buy,
    metadata?.partnership_type,
  );
  const location = firstString(
    metadata?.location,
    metadata?.city,
    metadata?.region,
    item.location,
    'Indonesia',
  );

  return {
    id,
    kind,
    title: firstString(item.title, item.summary, metadata?.name, 'Tanpa judul'),
    summary: firstString(item.summary, item.body, metadata?.description),
    href: `/content/${encodeURIComponent(id)}`,
    image: firstImage(item, metadata),
    label:
      kind === 'needs'
        ? 'Kebutuhan'
        : kind === 'services'
          ? 'Jasa'
          : contentType || 'Produk',
    location,
    priceLabel:
      kind === 'needs'
        ? budgetLabel
        : firstString(
            metadata?.price_label,
            metadata?.budget_range,
            formatPrice(price, firstString(item.currency, 'IDR')),
          ),
    ownerName: firstString(
      owner?.full_name,
      owner?.username,
      metadata?.seller_name,
      metadata?.owner_name,
    ),
    verified:
      readBoolean(owner?.identity_verified) ||
      readBoolean(owner?.transaction_eligible),
    side,
    memberCount: null,
    viewCount: readNumber(item.view_count) ?? readNumber(metadata?.view_count),
    durationLabel: kind === 'needs' ? deadline : '',
    metadata: {
      contentType,
      priceCents: price,
      budget_label: budgetLabel,
      budget: firstString(metadata?.budget),
      capital_range: firstString(metadata?.capital_range),
      quantity,
      required_quantity: firstString(metadata?.required_quantity),
      unit: quantityUnit,
      quantity_unit: quantityUnit,
      needed_by: deadline,
      target_done: firstString(metadata?.target_done),
      target_move: firstString(metadata?.target_move),
      target_date: firstString(metadata?.target_date),
      deadline: firstString(metadata?.deadline),
      need_frequency: needFrequency,
      preferred_period: firstString(metadata?.preferred_period),
      buy_or_rent: firstString(metadata?.buy_or_rent),
      rent_or_buy: firstString(metadata?.rent_or_buy),
      partnership_type: firstString(metadata?.partnership_type),
      required_certifications: readStringList(
        metadata?.required_certifications,
      ),
      required_facilities: readStringList(metadata?.required_facilities),
      output_needed: readStringList(metadata?.output_needed),
      support_needed: readStringList(metadata?.support_needed),
      provider_criteria: firstString(metadata?.provider_criteria),
      minimum_capacity: firstString(metadata?.minimum_capacity),
      traffic_note: firstString(metadata?.traffic_note),
      experience: firstString(metadata?.experience),
      priceUnit: firstString(item.price_unit, metadata?.price_unit),
      condition: firstString(metadata?.condition, metadata?.item_condition),
      serviceMode: firstString(metadata?.service_mode, metadata?.work_mode),
      imageAttribution: firstString(metadata?.image_attribution),
      imageSourceProvider: firstString(metadata?.image_source_provider),
      googleMapsUri: firstString(metadata?.google_maps_uri),
      requestStatus,
      updatedAt: firstString(item.updated_at, item.created_at),
    },
  };
}

function mapBusiness(item: JsonRecord): GlobalSearchItem | null {
  const id = readString(item.id);
  if (!id) return null;
  const metadata = asRecord(item.metadata);
  const slug = firstString(item.slug, id);

  return {
    id,
    kind: 'businesses',
    title: firstString(item.name, 'Usaha'),
    summary: firstString(item.description, metadata?.tagline, item.address),
    href: `/umkm/${encodeURIComponent(slug)}`,
    image: firstImage(item, metadata),
    label: firstString(metadata?.category_label, metadata?.category, 'Usaha'),
    location: firstString(item.city, item.address, 'Indonesia'),
    priceLabel: '',
    ownerName: '',
    verified: readBoolean(metadata?.verified) || readBoolean(item.verified),
    side: null,
    memberCount: null,
    viewCount: null,
    durationLabel: '',
    metadata: {
      onlineOrder: readBoolean(item.online_order_enabled),
      offlineOrder: readBoolean(item.offline_order_enabled),
      rating: readNumber(item.rating),
      imageAttribution: firstString(metadata?.image_attribution),
      imageSourceProvider: firstString(metadata?.image_source_provider),
      googleMapsUri: firstString(metadata?.google_maps_uri),
    },
  };
}

function mapUser(item: JsonRecord): GlobalSearchItem | null {
  const id = readString(item.id);
  if (!id) return null;
  const metadata = asRecord(item.metadata);

  return {
    id,
    kind: 'users',
    title: firstString(item.full_name, item.username, 'Pengguna Lajukan'),
    summary: firstString(item.headline, item.bio),
    href: buildPublicProfileHref({
      id,
      username: item.username,
      full_name: item.full_name,
      title: item.headline,
    }),
    image: firstImage(item, metadata),
    label: firstString(item.professional_title, item.headline, 'Profil'),
    location: firstString(item.location, metadata?.location),
    priceLabel: '',
    ownerName: '',
    verified:
      readBoolean(item.identity_verified) || readBoolean(item.email_verified),
    side: null,
    memberCount: null,
    viewCount: null,
    durationLabel: '',
    metadata: {
      rating: readNumber(item.rating),
      completedJobs: readNumber(item.completed_jobs),
    },
  };
}

type SearchSource =
  | 'content'
  | 'businesses'
  | 'communities'
  | 'videos'
  | 'users';

type SearchSourceResult = {
  ok: boolean;
  payload: unknown;
  status: number | null;
};

async function fetchJson(
  req: NextRequest,
  path: string,
  source: SearchSource,
): Promise<SearchSourceResult> {
  try {
    const target = new URL(path, getInternalWwwOrigin(req));
    const headers = new Headers();
    const cookie = req.headers.get('cookie');
    const authorization = req.headers.get('authorization');
    if (cookie) headers.set('cookie', cookie);
    if (authorization) headers.set('authorization', authorization);

    const response = await fetch(target, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.warn('[GLOBAL_SEARCH_SOURCE_UNAVAILABLE]', {
        source,
        status: response.status,
      });
    }
    return { ok: response.ok, payload, status: response.status };
  } catch (error) {
    console.warn('[GLOBAL_SEARCH_SOURCE_UNAVAILABLE]', {
      source,
      reason: error instanceof Error ? error.name : 'fetch_failed',
    });
    return { ok: false, payload: null, status: null };
  }
}

function group(
  items: Array<GlobalSearchItem | null>,
  available: boolean,
  error: string | null = null,
  relevanceQuery = '',
): GlobalSearchGroup {
  const unique = new Map<string, GlobalSearchItem>();
  for (const item of items) {
    if (item) unique.set(`${item.kind}:${item.id}`, item);
  }
  const normalized = rankGlobalSearchItems(
    Array.from(unique.values()),
    relevanceQuery,
  );
  return {
    items: normalized,
    total: normalized.length,
    nextCursor: null,
    available,
    error,
  };
}

function requestedGroupsForState(
  tab: GlobalSearchTab,
  side: GlobalSearchSide,
): Set<GlobalSearchGroupKey> {
  if (side === 'demand') return new Set(['needs']);
  if (side === 'supply') {
    if (['products', 'services', 'businesses'].includes(tab)) {
      return new Set([tab as GlobalSearchGroupKey]);
    }
    return new Set(['products', 'services', 'businesses']);
  }
  if (tab !== 'all') return new Set([tab]);
  return new Set(GROUP_KEYS);
}

export async function GET(req: NextRequest) {
  const rateLimit = await enforceRateLimit({
    key: `global-search:${getClientIp(req)}`,
    limit: 180,
    windowSeconds: 60,
    message: 'Too many search requests. Please retry shortly.',
  });
  if (!rateLimit.ok) return rateLimit.response;

  const state = parseGlobalSearchState(req.nextUrl.searchParams);
  const activeCategory = getExploreCategoryBySlug(state.category);
  const activeSubcategory = activeCategory?.subcategories.find(
    subcategory => subcategory.slug === state.subcategory,
  );
  const derivedQuery =
    activeSubcategory?.query || activeCategory?.searchQuery || '';
  const effectiveQuery = state.query.length >= 2 ? state.query : derivedQuery;
  if (effectiveQuery.length < 2) {
    return NextResponse.json(emptyGlobalSearchResponse(state.query), {
      headers: { 'Cache-Control': 'private, max-age=0' },
    });
  }

  const requested = requestedGroupsForState(state.tab, state.side);
  const contentNeeded = ['products', 'services', 'needs'].some(key =>
    requested.has(key as GlobalSearchGroupKey),
  );
  const params = new URLSearchParams({
    q: effectiveQuery,
    status: 'active',
    include_owner: '1',
    limit: state.side === 'all' ? '24' : '48',
  });
  if (state.category) params.set('category', state.category);
  if (state.subcategory) params.set('subcategory', state.subcategory);
  if (state.location) params.set('location', state.location);
  if (state.sort !== 'relevance')
    params.set('sort', state.sort === 'latest' ? 'newest' : state.sort);
  const condition = readString(req.nextUrl.searchParams.get('condition'));
  const serviceMode = readString(req.nextUrl.searchParams.get('service_mode'));
  const requestStatus = readString(
    req.nextUrl.searchParams.get('status'),
  ).toLowerCase();
  const minPrice = readNumber(req.nextUrl.searchParams.get('min_price'));
  const maxPrice = readNumber(req.nextUrl.searchParams.get('max_price'));
  const viewerLat = readNumber(req.nextUrl.searchParams.get('lat'));
  const viewerLng = readNumber(req.nextUrl.searchParams.get('lng'));
  if (condition && condition !== 'all') params.set('condition', condition);
  if (serviceMode && serviceMode !== 'all')
    params.set('work_mode', serviceMode);
  if (minPrice !== null) params.set('min_price', String(minPrice));
  if (maxPrice !== null) params.set('max_price', String(maxPrice));
  if (state.distanceKm !== null && viewerLat !== null && viewerLng !== null) {
    params.set('nearby', '1');
    params.set('viewer_lat', String(viewerLat));
    params.set('viewer_lng', String(viewerLng));
    params.set('distance', String(state.distanceKm));
  }
  if (state.side !== 'all') params.set('side', state.side);

  const [
    contentResult,
    businessesResult,
    communityResult,
    reelsResult,
    usersResult,
  ] = await Promise.all([
    contentNeeded
      ? fetchJson(req, `/api/content?${params.toString()}`, 'content')
      : Promise.resolve({ ok: true, payload: null, status: null }),
    requested.has('businesses')
      ? fetchJson(
          req,
          `/api/super-app/umkm/stores?${new URLSearchParams({
            q: effectiveQuery,
            ...(state.location ? { city: state.location } : {}),
            backend_only: '1',
            limit: '12',
          }).toString()}`,
          'businesses',
        )
      : Promise.resolve({ ok: true, payload: null, status: null }),
    requested.has('communities')
      ? fetchJson(
          req,
          `/api/community/search?${new URLSearchParams({
            q: effectiveQuery,
            kind: 'all',
            limit: '12',
          }).toString()}`,
          'communities',
        )
      : Promise.resolve({ ok: true, payload: null, status: null }),
    requested.has('videos')
      ? fetchJson(
          req,
          `/api/reels?${new URLSearchParams({
            q: effectiveQuery,
            limit: '12',
          }).toString()}`,
          'videos',
        )
      : Promise.resolve({ ok: true, payload: null, status: null }),
    requested.has('users')
      ? fetchJson(
          req,
          `/api/users/discover?${new URLSearchParams({
            q: effectiveQuery,
            ...(state.location ? { location: state.location } : {}),
            limit: '12',
          }).toString()}`,
          'users',
        )
      : Promise.resolve({ ok: true, payload: null, status: null }),
  ]);

  const requestedSourceResults = [
    contentNeeded ? contentResult : null,
    requested.has('businesses') ? businessesResult : null,
    requested.has('communities') ? communityResult : null,
    requested.has('videos') ? reelsResult : null,
    requested.has('users') ? usersResult : null,
  ].filter((result): result is SearchSourceResult => result !== null);
  const allRequestedSourcesFailed =
    requestedSourceResults.length > 0 &&
    requestedSourceResults.every(result => !result.ok);

  const response = emptyGlobalSearchResponse(state.query);
  const contentPayload = asRecord(contentResult.payload);
  const contentItems = asArray(contentPayload?.items)
    .map(mapContentItem)
    .filter((item): item is GlobalSearchItem => Boolean(item))
    .filter(item => state.side === 'all' || item.side === state.side)
    .filter(item => {
      const priceCents = readNumber(item.metadata.priceCents);
      if (
        minPrice !== null &&
        priceCents !== null &&
        priceCents < minPrice * 100
      )
        return false;
      if (
        maxPrice !== null &&
        priceCents !== null &&
        priceCents > maxPrice * 100
      )
        return false;
      if (condition && condition !== 'all') {
        const itemCondition = readString(item.metadata.condition).toLowerCase();
        if (itemCondition && itemCondition !== condition) return false;
      }
      if (serviceMode && serviceMode !== 'all' && item.kind === 'services') {
        const itemMode = readString(item.metadata.serviceMode).toLowerCase();
        if (itemMode && itemMode !== serviceMode) return false;
      }
      if (requestStatus && requestStatus !== 'all' && item.kind === 'needs') {
        const itemStatus = readString(item.metadata.requestStatus)
          .toLowerCase()
          .replace(/\s+/g, '_');
        if (requestStatus === 'open') {
          return (
            !itemStatus || ['open', 'active', 'published'].includes(itemStatus)
          );
        }
        return itemStatus === requestStatus;
      }
      return true;
    });
  const businessPayload = asRecord(asRecord(businessesResult.payload)?.data);
  const communityPayload = asRecord(communityResult.payload);
  const reelsPayload = asRecord(reelsResult.payload);
  const userPayload = asRecord(usersResult.payload);
  const relevanceQuery = state.sort === 'relevance' ? effectiveQuery : '';

  response.groups.products = group(
    contentItems.filter(item => item.kind === 'products'),
    requested.has('products'),
    contentNeeded && !contentResult.ok ? 'products_unavailable' : null,
    relevanceQuery,
  );
  response.groups.services = group(
    contentItems.filter(item => item.kind === 'services'),
    requested.has('services'),
    contentNeeded && !contentResult.ok ? 'services_unavailable' : null,
    relevanceQuery,
  );
  response.groups.needs = group(
    contentItems.filter(item => item.kind === 'needs'),
    requested.has('needs'),
    contentNeeded && !contentResult.ok ? 'needs_unavailable' : null,
    relevanceQuery,
  );
  const verifiedOnly = req.nextUrl.searchParams.get('verified') === '1';
  const privacy = readString(
    req.nextUrl.searchParams.get('privacy'),
  ).toLowerCase();
  response.groups.businesses = group(
    asArray(businessPayload?.items)
      .map(mapBusiness)
      .filter(item => !verifiedOnly || item?.verified),
    requested.has('businesses'),
    requested.has('businesses') && !businessesResult.ok
      ? 'businesses_unavailable'
      : null,
    relevanceQuery,
  );
  response.groups.communities = group(
    [
      ...asArray(communityPayload?.groups).map(mapCommunityGroup),
      ...asArray(communityPayload?.posts).map(mapCommunityPost),
    ].filter(item => {
      if (!item || !privacy || privacy === 'all') return true;
      return readString(item.metadata.privacy).toLowerCase() === privacy;
    }),
    requested.has('communities'),
    requested.has('communities') && !communityResult.ok
      ? 'communities_unavailable'
      : null,
    relevanceQuery,
  );
  response.groups.videos = group(
    asArray(reelsPayload?.items).map(mapVideo),
    requested.has('videos'),
    requested.has('videos') && !reelsResult.ok ? 'videos_unavailable' : null,
    relevanceQuery,
  );
  response.groups.users = group(
    asArray(userPayload?.data)
      .map(mapUser)
      .filter(item => !verifiedOnly || item?.verified),
    requested.has('users'),
    requested.has('users') && !usersResult.ok ? 'users_unavailable' : null,
    relevanceQuery,
  );

  response.total = GROUP_KEYS.reduce(
    (sum, key) => sum + response.groups[key].total,
    0,
  );
  const availableTabs = new Set<GlobalSearchTab>();
  if (state.side === 'demand') {
    availableTabs.add('needs');
  } else if (state.side === 'supply') {
    availableTabs.add('all');
  } else {
    availableTabs.add('all');
    if (state.tab !== 'all') availableTabs.add(state.tab);
  }
  const allowedTabs =
    state.side === 'demand'
      ? new Set<GlobalSearchTab>(['needs'])
      : state.side === 'supply'
        ? new Set<GlobalSearchTab>([
            'all',
            'products',
            'services',
            'businesses',
          ])
        : null;
  GROUP_KEYS.forEach(key => {
    if (allowedTabs && !allowedTabs.has(key)) return;
    if (response.groups[key].available && response.groups[key].total > 0) {
      availableTabs.add(key);
    }
  });
  const orderedTabs: GlobalSearchTab[] = ['all', ...GROUP_KEYS];
  response.availableTabs = orderedTabs.filter(tab => availableTabs.has(tab));

  return NextResponse.json(response satisfies GlobalSearchResponse, {
    status: allRequestedSourcesFailed ? 503 : 200,
    headers: {
      'Cache-Control': allRequestedSourcesFailed
        ? 'private, no-store'
        : 'private, max-age=15, stale-while-revalidate=30',
      ...(allRequestedSourcesFailed ? { 'Retry-After': '5' } : {}),
    },
  });
}
