import { NextRequest, NextResponse } from 'next/server';

import { buildPublicProfileHref } from '@/lib/profile/publicProfileLink';
import {
  enforceRateLimit,
  getClientIp,
} from '@/lib/rateLimit';
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
import type { ContentItem } from '@/lib/content/catalog';
import {
  isPublicReferenceMetadata,
  readPublicReference,
} from '@/lib/content/publicReference';
import { getInternalWwwOrigin } from '@/lib/server/internalWwwOrigin';
import { buildUmkmStorefrontPath } from '@/lib/umkmSurface';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonRecord = Record<string, unknown>;

type MarketplaceSide = 'supply' | 'demand';

const GROUP_KEYS: GlobalSearchGroupKey[] = [
  'products',
  'services',
  'businesses',
  'references',
  'needs',
  'communities',
  'videos',
  'users',
];

const SUPPLY_TABS = new Set([
  'all',
  'products',
  'services',
  'businesses',
]);

function asRecord(
  value: unknown,
): JsonRecord | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as JsonRecord;
}

function asArray(
  value: unknown,
): JsonRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(asRecord)
    .filter(
      (
        item,
      ): item is JsonRecord =>
        Boolean(item),
    );
}

function readString(
  value: unknown,
): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return '';
}

function readReferenceCursor(
  value: unknown,
): string {
  const cursor =
    readString(value);

  return cursor.length <= 96 &&
    /^\d{1,19}:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      cursor,
    )
    ? cursor
    : '';
}

function readNumber(
  value: unknown,
): number | null {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === 'string' &&
    value.trim()
  ) {
    const parsed =
      Number(value);

    if (
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return null;
}

function readBoolean(
  value: unknown,
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return [
    '1',
    'true',
    'yes',
    'verified',
  ].includes(
    readString(value).toLowerCase(),
  );
}

function readStringList(
  value: unknown,
): string[] {
  if (Array.isArray(value)) {
    return value
      .map(readString)
      .filter(Boolean);
  }

  const text =
    readString(value);

  if (!text) {
    return [];
  }

  return text
    .split(/[,\n]/)
    .map(part => part.trim())
    .filter(Boolean);
}

function firstString(
  ...values: unknown[]
): string {
  for (const value of values) {
    const text =
      readString(value);

    if (text) {
      return text;
    }
  }

  return '';
}

function firstImage(
  item: JsonRecord,
  metadata?: JsonRecord | null,
): string | null {
  const direct =
    firstString(
      item.cover_image,
      item.image,
      item.image_url,
      item.thumbnail_url,
      item.avatar_url,
      metadata?.cover_image,
      metadata?.image,
      metadata?.image_url,
    );

  if (direct) {
    return direct;
  }

  for (const candidate of [
    item.image_urls,
    item.images,
    metadata?.image_urls,
    metadata?.gallery_images,
    metadata?.images,
  ]) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    const image = candidate
      .map(readString)
      .find(Boolean);

    if (image) {
      return image;
    }
  }

  return null;
}

function formatPrice(
  value: number | null,
  currency = 'IDR',
): string {
  if (value === null) {
    return '';
  }

  const normalizedCurrency =
    currency.toUpperCase() || 'IDR';

  const normalizedValue =
    value / 100;

  return new Intl.NumberFormat(
    'id-ID',
    {
      style: 'currency',
      currency:
        normalizedCurrency,
      maximumFractionDigits: 0,
    },
  ).format(normalizedValue);
}

/**
 * Normalize one explicit marketplace-side token.
 *
 * IMPORTANT:
 * We only accept explicit values here.
 * We deliberately do NOT search arbitrary sentences/descriptions.
 */
function normalizeSideValue(
  value: unknown,
): MarketplaceSide | null {
  const normalized =
    readString(value)
      .toLowerCase()
      .replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'supply':
    case 'offer':
    case 'offering':
    case 'sell':
    case 'seller':
    case 'provider':
    case 'penyedia':
    case 'menawarkan':
      return 'supply';

    case 'demand':
    case 'need':
    case 'needs':
    case 'request':
    case 'looking_for':
    case 'seeker':
    case 'mencari':
    case 'pencari':
    case 'butuh':
    case 'membutuhkan':
      return 'demand';

    default:
      return null;
  }
}

/**
 * Resolve supply/demand safely.
 *
 * Priority:
 * 1. item.side
 * 2. item.listing_side
 * 3. item.market_side
 * 4. item.listing_intent
 * 5. item.market_intent
 * 6. item.intent
 * 7. metadata equivalents
 * 8. explicit kind/content_type fallback
 * 9. default supply
 *
 * We intentionally avoid inspecting arbitrary fields like:
 * - description
 * - summary
 * - pricing_mode
 * - offer_type
 *
 * because words such as "buyer", "request", or "need" can occur
 * in normal product descriptions and must never change marketplace side.
 */
function inferSide(
  item: JsonRecord,
  metadata: JsonRecord | null,
): MarketplaceSide {
  const explicitCandidates: unknown[] = [
    item.side,
    item.listing_side,
    item.market_side,
    item.listing_intent,
    item.market_intent,
    item.intent,

    metadata?.side,
    metadata?.listing_side,
    metadata?.market_side,
    metadata?.listing_intent,
    metadata?.market_intent,
    metadata?.intent,
  ];

  for (const candidate of explicitCandidates) {
    const resolved =
      normalizeSideValue(
        candidate,
      );

    if (resolved) {
      return resolved;
    }
  }

  /**
   * Last fallback only:
   * explicit content kind can imply a demand record.
   */
  const kindToken = [
    item.content_type,
    item.type,
    metadata?.content_type,
    metadata?.type,
  ]
    .map(readString)
    .join(' ')
    .toLowerCase();

  if (
    /\bneed\b|\bneeds\b|\bdemand\b|\brequest\b/.test(
      kindToken,
    )
  ) {
    return 'demand';
  }

  /**
   * Normal marketplace content defaults to supply.
   */
  return 'supply';
}

function contentKind(
  item: JsonRecord,
  metadata: JsonRecord | null,
): 'products' | 'services' | 'needs' {
  const side =
    inferSide(
      item,
      metadata,
    );

  /**
   * Any explicit demand record belongs to `needs`.
   */
  if (side === 'demand') {
    return 'needs';
  }

  const token = [
    item.content_type,
    item.type,
    item.category,
    metadata?.content_type,
    metadata?.type,
    metadata?.category,
  ]
    .map(readString)
    .join(' ')
    .toLowerCase();

  if (
    token.includes('service') ||
    token.includes('jasa')
  ) {
    return 'services';
  }

  return 'products';
}

function mapContentItem(
  item: JsonRecord,
): GlobalSearchItem | null {
  const id =
    readString(item.id);

  if (!id) {
    return null;
  }

  const metadata =
    asRecord(item.metadata);

  if (
    isPublicReferenceMetadata(
      metadata,
    )
  ) {
    return null;
  }

  const owner =
    asRecord(
      item.owner_profile,
    );

  const kind =
    contentKind(
      item,
      metadata,
    );

  const side =
    inferSide(
      item,
      metadata,
    );

  const contentType =
    firstString(
      item.content_type,
      item.type,
      item.category,
    );

  const price =
    readNumber(
      item.price_cents,
    );

  const requestStatus =
    firstString(
      metadata?.request_status,
      metadata?.status,
    );

  const quantity =
    firstString(
      metadata?.quantity,
      metadata?.required_quantity,
      metadata?.quantity_needed,
    );

  const quantityUnit =
    firstString(
      metadata?.unit,
      metadata?.quantity_unit,
      metadata?.unit_label,
    );

  const budgetLabel =
    firstString(
      metadata?.budget_label,
      metadata?.budget_range,
      metadata?.budget,
      metadata?.capital_range,
      metadata?.price_label,
    );

  const deadline =
    firstString(
      metadata?.needed_by,
      metadata?.target_done,
      metadata?.target_move,
      metadata?.target_date,
      metadata?.deadline,
    );

  const needFrequency =
    firstString(
      metadata?.need_frequency,
      metadata?.preferred_period,
      metadata?.buy_or_rent,
      metadata?.rent_or_buy,
      metadata?.partnership_type,
    );

  const location =
    firstString(
      metadata?.location,
      metadata?.city,
      metadata?.region,
      item.location,
      'Indonesia',
    );

  const listingSide =
    firstString(
      item.listing_side,
      metadata?.listing_side,
    );

  const marketSide =
    firstString(
      item.market_side,
      metadata?.market_side,
    );

  const listingIntent =
    firstString(
      item.listing_intent,
      metadata?.listing_intent,
    );

  const marketIntent =
    firstString(
      item.market_intent,
      metadata?.market_intent,
    );

  const intent =
    firstString(
      item.intent,
      metadata?.intent,
    );

  return {
    id,
    kind,

    title: firstString(
      item.title,
      item.summary,
      metadata?.name,
      'Tanpa judul',
    ),

    summary: firstString(
      item.summary,
      item.body,
      metadata?.description,
    ),

    href: `/content/${encodeURIComponent(
      id,
    )}`,

    image:
      firstImage(
        item,
        metadata,
      ),

    label:
      kind === 'needs'
        ? 'Kebutuhan'
        : kind === 'services'
          ? 'Jasa'
          : contentType ||
            'Produk',

    location,

    priceLabel:
      kind === 'needs'
        ? budgetLabel
        : firstString(
            metadata?.price_label,
            metadata?.budget_range,
            formatPrice(
              price,
              firstString(
                item.currency,
                'IDR',
              ),
            ),
          ),

    ownerName:
      firstString(
        owner?.full_name,
        owner?.username,
        metadata?.seller_name,
        metadata?.owner_name,
      ),

    verified:
      readBoolean(
        owner?.identity_verified,
      ) ||
      readBoolean(
        owner?.transaction_eligible,
      ),

    /**
     * This is the normalized value that all frontend consumers
     * should rely upon.
     */
    side,

    memberCount: null,

    viewCount:
      readNumber(
        item.view_count,
      ) ??
      readNumber(
        metadata?.view_count,
      ),

    durationLabel:
      kind === 'needs'
        ? deadline
        : '',

    metadata: {
      contentType,

      priceCents: price,

      /**
       * Preserve the original backend fields for debugging,
       * analytics, and future UI mapping.
       */
      listingSide,
      marketSide,
      listingIntent,
      marketIntent,
      intent,

      budget_label:
        budgetLabel,

      budget: firstString(
        metadata?.budget,
      ),

      capital_range:
        firstString(
          metadata?.capital_range,
        ),

      quantity,

      required_quantity:
        firstString(
          metadata?.required_quantity,
        ),

      unit: quantityUnit,

      quantity_unit:
        quantityUnit,

      needed_by:
        deadline,

      target_done:
        firstString(
          metadata?.target_done,
        ),

      target_move:
        firstString(
          metadata?.target_move,
        ),

      target_date:
        firstString(
          metadata?.target_date,
        ),

      deadline:
        firstString(
          metadata?.deadline,
        ),

      need_frequency:
        needFrequency,

      preferred_period:
        firstString(
          metadata?.preferred_period,
        ),

      buy_or_rent:
        firstString(
          metadata?.buy_or_rent,
        ),

      rent_or_buy:
        firstString(
          metadata?.rent_or_buy,
        ),

      partnership_type:
        firstString(
          metadata?.partnership_type,
        ),

      required_certifications:
        readStringList(
          metadata?.required_certifications,
        ),

      required_facilities:
        readStringList(
          metadata?.required_facilities,
        ),

      output_needed:
        readStringList(
          metadata?.output_needed,
        ),

      support_needed:
        readStringList(
          metadata?.support_needed,
        ),

      provider_criteria:
        firstString(
          metadata?.provider_criteria,
        ),

      minimum_capacity:
        firstString(
          metadata?.minimum_capacity,
        ),

      traffic_note:
        firstString(
          metadata?.traffic_note,
        ),

      experience:
        firstString(
          metadata?.experience,
        ),

      priceUnit:
        firstString(
          item.price_unit,
          metadata?.price_unit,
        ),

      condition:
        firstString(
          metadata?.condition,
          metadata?.item_condition,
        ),

      serviceMode:
        firstString(
          metadata?.service_mode,
          metadata?.work_mode,
        ),

      imageAttribution:
        firstString(
          metadata?.image_attribution,
        ),

      imageSourceProvider:
        firstString(
          metadata?.image_source_provider,
        ),

      googleMapsUri:
        firstString(
          metadata?.google_maps_uri,
        ),

      requestStatus,

      updatedAt:
        firstString(
          item.updated_at,
          item.created_at,
        ),
    },
  };
}

function boundedText(
  value: unknown,
  maxLength: number,
): string {
  return readString(value)
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function safeContentHref(
  value: unknown,
  fallbackId: string,
): string {
  const candidate =
    readString(value);

  if (
    candidate.startsWith(
      '/content/',
    ) &&
    !candidate.startsWith('//')
  ) {
    try {
      const parsed =
        new URL(
          candidate,
          'https://www.lajukan.com',
        );

      if (
        parsed.origin ===
          'https://www.lajukan.com' &&
        parsed.pathname.startsWith(
          '/content/',
        )
      ) {
        return `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      // Fall through.
    }
  }

  return `/content/${encodeURIComponent(
    fallbackId,
  )}`;
}

function safeInternalReferenceImage(
  item: JsonRecord,
  metadata: JsonRecord,
): string | null {
  const image =
    firstImage(
      item,
      metadata,
    );

  if (
    !image ||
    image.length > 2048
  ) {
    return null;
  }

  return image.startsWith('/') &&
    !image.startsWith('//')
    ? image
    : null;
}

function mapPublicReferenceItem(
  item: JsonRecord,
): GlobalSearchItem | null {
  const id =
    readString(item.id);

  const metadata =
    asRecord(item.metadata);

  if (
    !id ||
    !metadata
  ) {
    return null;
  }

  const source =
    asRecord(
      metadata.source,
    );

  const declaredSourceTitle =
    firstString(
      source?.title,
      metadata.source_title,
    );

  const reference =
    readPublicReference({
      id,
      metadata,
    } as ContentItem);

  if (
    !reference ||
    !declaredSourceTitle ||
    !reference.sourceLicense ||
    !reference.sourceLicenseUrl ||
    reference.sourceUrl.length >
      2048 ||
    reference.sourceLicenseUrl.length >
      2048
  ) {
    return null;
  }

  const contentId =
    id.startsWith(
      'reference:',
    )
      ? id.slice(
          'reference:'.length,
        )
      : id;

  const distanceKm =
    readNumber(
      item.distance_km,
    );

  const imageAttribution =
    firstString(
      metadata.image_attribution,
      metadata.image_source_provider,
      reference.imageAttribution,
    );

  return {
    id,
    kind: 'references',

    title: boundedText(
      firstString(
        item.name,
        item.title,
        'Referensi lokasi',
      ),
      180,
    ),

    summary: boundedText(
      firstString(
        item.description,
        item.summary,
        'Referensi lokasi publik.',
      ),
      320,
    ),

    href: safeContentHref(
      item.public_path,
      contentId,
    ),

    image:
      safeInternalReferenceImage(
        item,
        metadata,
      ),

    label: boundedText(
      firstString(
        metadata.category_label,
        metadata.category,
        'Referensi lokasi',
      ),
      100,
    ),

    location: boundedText(
      firstString(
        item.address,
        item.city,
        metadata.location,
        'Indonesia',
      ),
      180,
    ),

    priceLabel: '',
    ownerName: '',
    verified: false,
    side: null,
    memberCount: null,
    viewCount: null,
    durationLabel: '',

    metadata: {
      recordKind:
        boundedText(
          reference.recordKind,
          80,
        ),

      sourceTitle:
        boundedText(
          declaredSourceTitle,
          140,
        ),

      sourceUrl:
        reference.sourceUrl,

      sourceLicense:
        boundedText(
          reference.sourceLicense,
          180,
        ),

      sourceLicenseUrl:
        reference.sourceLicenseUrl,

      trustNote:
        boundedText(
          reference.trustNote,
          320,
        ),

      imageAttribution:
        boundedText(
          imageAttribution,
          220,
        ),

      imageSourceUrl:
        reference.imageSourceUrl
          .length <= 2048
          ? reference.imageSourceUrl
          : '',

      imageLicense:
        boundedText(
          reference.imageLicense,
          160,
        ),

      imageLicenseUrl:
        reference.imageLicenseUrl
          .length <= 2048
          ? reference.imageLicenseUrl
          : '',

      distanceKm,

      isTransactional:
        false,

      updatedAt:
        boundedText(
          item.updated_at,
          64,
        ),
    },
  };
}

function mapBusiness(
  item: JsonRecord,
): GlobalSearchItem | null {
  const id =
    readString(item.id);

  if (!id) {
    return null;
  }

  const metadata =
    asRecord(item.metadata);

  const slug =
    firstString(
      item.slug,
      id,
    );

  return {
    id,
    kind: 'businesses',

    title: firstString(
      item.name,
      'Usaha',
    ),

    summary: firstString(
      item.description,
      metadata?.tagline,
      item.address,
    ),

    href:
      buildUmkmStorefrontPath(
        slug,
      ),

    image:
      firstImage(
        item,
        metadata,
      ),

    label: firstString(
      metadata?.category_label,
      metadata?.category,
      'Usaha',
    ),

    location: firstString(
      item.city,
      item.address,
      'Indonesia',
    ),

    priceLabel: '',
    ownerName: '',

    verified:
      readBoolean(
        metadata?.verified,
      ) ||
      readBoolean(
        item.verified,
      ),

    side: null,
    memberCount: null,
    viewCount: null,
    durationLabel: '',

    metadata: {
      onlineOrder:
        readBoolean(
          item.online_order_enabled,
        ),

      offlineOrder:
        readBoolean(
          item.offline_order_enabled,
        ),

      rating:
        readNumber(
          item.rating,
        ),

      imageAttribution:
        firstString(
          metadata?.image_attribution,
        ),

      imageSourceProvider:
        firstString(
          metadata?.image_source_provider,
        ),

      googleMapsUri:
        firstString(
          metadata?.google_maps_uri,
        ),
    },
  };
}

function mapUser(
  item: JsonRecord,
): GlobalSearchItem | null {
  const id =
    readString(item.id);

  if (!id) {
    return null;
  }

  const metadata =
    asRecord(item.metadata);

  return {
    id,
    kind: 'users',

    title: firstString(
      item.full_name,
      item.username,
      'Pengguna Lajukan',
    ),

    summary: firstString(
      item.headline,
      item.bio,
    ),

    href:
      buildPublicProfileHref({
        id,
        username:
          item.username,
        full_name:
          item.full_name,
        title:
          item.headline,
      }),

    image:
      firstImage(
        item,
        metadata,
      ),

    label: firstString(
      item.professional_title,
      item.headline,
      'Profil',
    ),

    location: firstString(
      item.location,
      metadata?.location,
    ),

    priceLabel: '',
    ownerName: '',

    verified:
      readBoolean(
        item.identity_verified,
      ) ||
      readBoolean(
        item.email_verified,
      ),

    side: null,
    memberCount: null,
    viewCount: null,
    durationLabel: '',

    metadata: {
      rating:
        readNumber(
          item.rating,
        ),

      completedJobs:
        readNumber(
          item.completed_jobs,
        ),
    },
  };
}

type SearchSource =
  | 'content'
  | 'businesses'
  | 'references'
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
    const target =
      new URL(
        path,
        getInternalWwwOrigin(req),
      );

    const headers =
      new Headers();

    const cookie =
      req.headers.get(
        'cookie',
      );

    const authorization =
      req.headers.get(
        'authorization',
      );

    if (cookie) {
      headers.set(
        'cookie',
        cookie,
      );
    }

    if (authorization) {
      headers.set(
        'authorization',
        authorization,
      );
    }

    const response =
      await fetch(
        target,
        {
          headers,
          cache: 'no-store',
          signal:
            AbortSignal.timeout(
              12000,
            ),
        },
      );

    const payload =
      await response
        .json()
        .catch(
          () => null,
        );

    if (!response.ok) {
      console.warn(
        '[GLOBAL_SEARCH_SOURCE_UNAVAILABLE]',
        {
          source,
          status:
            response.status,
        },
      );
    }

    return {
      ok: response.ok,
      payload,
      status:
        response.status,
    };
  } catch (error) {
    console.warn(
      '[GLOBAL_SEARCH_SOURCE_UNAVAILABLE]',
      {
        source,
        reason:
          error instanceof Error
            ? error.name
            : 'fetch_failed',
      },
    );

    return {
      ok: false,
      payload: null,
      status: null,
    };
  }
}

function group(
  items: Array<
    GlobalSearchItem | null
  >,
  available: boolean,
  error: string | null = null,
  relevanceQuery = '',
): GlobalSearchGroup {
  const unique =
    new Map<
      string,
      GlobalSearchItem
    >();

  for (const item of items) {
    if (!item) {
      continue;
    }

    unique.set(
      `${item.kind}:${item.id}`,
      item,
    );
  }

  const normalized =
    rankGlobalSearchItems(
      Array.from(
        unique.values(),
      ),
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
  if (
    tab ===
    'references'
  ) {
    return new Set([
      'references',
    ]);
  }

  if (side === 'demand') {
    return new Set([
      'needs',
    ]);
  }

  if (side === 'supply') {
    if (
      [
        'products',
        'services',
        'businesses',
      ].includes(tab)
    ) {
      return new Set([
        tab as GlobalSearchGroupKey,
      ]);
    }

    return new Set([
      'products',
      'services',
      'businesses',
    ]);
  }

  if (tab !== 'all') {
    return new Set([
      tab,
    ]);
  }

  return new Set(
    GROUP_KEYS.filter(
      key =>
        key !==
        'references',
    ),
  );
}

export async function GET(
  req: NextRequest,
) {
  const rateLimit =
    await enforceRateLimit(
      {
        key: `global-search:${getClientIp(
          req,
        )}`,
        limit: 180,
        windowSeconds: 60,
        message:
          'Too many search requests. Please retry shortly.',
      },
    );

  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const state =
    parseGlobalSearchState(
      req.nextUrl.searchParams,
    );

  const activeCategory =
    getExploreCategoryBySlug(
      state.category,
    );

  const activeSubcategory =
    activeCategory?.subcategories.find(
      subcategory =>
        subcategory.slug ===
        state.subcategory,
    );

  const derivedQuery =
    activeSubcategory?.query ||
    activeCategory?.searchQuery ||
    '';

  const effectiveQuery =
    state.query.length >= 2
      ? state.query
      : derivedQuery;

  const isReferenceBrowse =
    state.tab ===
    'references';

  const isPeopleBrowse =
    state.tab === 'users';

  if (
    effectiveQuery.length < 2 &&
    !isReferenceBrowse &&
    !isPeopleBrowse
  ) {
    return NextResponse.json(
      emptyGlobalSearchResponse(
        state.query,
      ),
      {
        headers: {
          'Cache-Control':
            'private, max-age=0',
        },
      },
    );
  }

  const requested =
    requestedGroupsForState(
      state.tab,
      state.side,
    );

  const contentNeeded = [
    'products',
    'services',
    'needs',
  ].some(key =>
    requested.has(
      key as GlobalSearchGroupKey,
    ),
  );

  const params =
    new URLSearchParams({
      status: 'active',
      include_owner: '1',
      limit:
        state.side === 'all'
          ? '24'
          : '48',
    });

  if (effectiveQuery) {
    params.set(
      'q',
      effectiveQuery,
    );
  }

  if (state.category) {
    params.set(
      'category',
      state.category,
    );
  }

  if (state.subcategory) {
    params.set(
      'subcategory',
      state.subcategory,
    );
  }

  if (state.location) {
    params.set(
      'location',
      state.location,
    );
  }

  if (
    state.sort !==
    'relevance'
  ) {
    params.set(
      'sort',
      state.sort ===
        'latest'
        ? 'newest'
        : state.sort,
    );
  }

  const condition =
    readString(
      req.nextUrl.searchParams.get(
        'condition',
      ),
    );

  const serviceMode =
    readString(
      req.nextUrl.searchParams.get(
        'service_mode',
      ),
    );

  const requestStatus =
    readString(
      req.nextUrl.searchParams.get(
        'status',
      ),
    ).toLowerCase();

  const minPrice =
    readNumber(
      req.nextUrl.searchParams.get(
        'min_price',
      ),
    );

  const maxPrice =
    readNumber(
      req.nextUrl.searchParams.get(
        'max_price',
      ),
    );

  const viewerLat =
    readNumber(
      req.nextUrl.searchParams.get(
        'lat',
      ),
    );

  const viewerLng =
    readNumber(
      req.nextUrl.searchParams.get(
        'lng',
      ),
    );

  if (
    condition &&
    condition !== 'all'
  ) {
    params.set(
      'condition',
      condition,
    );
  }

  if (
    serviceMode &&
    serviceMode !== 'all'
  ) {
    params.set(
      'work_mode',
      serviceMode,
    );
  }

  if (minPrice !== null) {
    params.set(
      'min_price',
      String(minPrice),
    );
  }

  if (maxPrice !== null) {
    params.set(
      'max_price',
      String(maxPrice),
    );
  }

  if (
    state.distanceKm !== null &&
    viewerLat !== null &&
    viewerLng !== null
  ) {
    params.set(
      'nearby',
      '1',
    );

    params.set(
      'viewer_lat',
      String(viewerLat),
    );

    params.set(
      'viewer_lng',
      String(viewerLng),
    );

    params.set(
      'distance',
      String(
        state.distanceKm,
      ),
    );
  }

  /**
   * Always pass explicit side whenever the search is
   * in a marketplace mode.
   */
  if (
    state.side !== 'all'
  ) {
    params.set(
      'side',
      state.side,
    );
  }

  const referenceParams =
    new URLSearchParams({
      references_only:
        '1',
      limit: '10',
    });

  if (effectiveQuery) {
    referenceParams.set(
      'q',
      effectiveQuery,
    );
  }

  if (state.location) {
    referenceParams.set(
      'city',
      state.location,
    );
  }

  const canUseReferenceCursor =
    !effectiveQuery &&
    !(
      state.distanceKm !==
        null &&
      viewerLat !== null &&
      viewerLng !== null
    );

  const referenceCursor =
    readReferenceCursor(
      state.cursor,
    );

  if (
    referenceCursor &&
    canUseReferenceCursor
  ) {
    referenceParams.set(
      'cursor',
      referenceCursor,
    );
  }

  if (
    state.distanceKm !==
      null &&
    viewerLat !== null &&
    viewerLng !== null
  ) {
    referenceParams.set(
      'viewer_lat',
      viewerLat.toFixed(3),
    );

    referenceParams.set(
      'viewer_lng',
      viewerLng.toFixed(3),
    );

    referenceParams.set(
      'radius_km',
      String(
        state.distanceKm,
      ),
    );
  }

  const [
    contentResult,
    businessesResult,
    referencesResult,
    communityResult,
    reelsResult,
    usersResult,
  ] = await Promise.all([
    contentNeeded
      ? fetchJson(
          req,
          `/api/content?${params.toString()}`,
          'content',
        )
      : Promise.resolve(
          {
            ok: true,
            payload: null,
            status: null,
          },
        ),

    requested.has(
      'businesses',
    )
      ? fetchJson(
          req,
          `/api/super-app/umkm/stores?${new URLSearchParams(
            {
              q: effectiveQuery,
              ...(state.location
                ? {
                    city:
                      state.location,
                  }
                : {}),
              backend_only: '1',
              limit: '12',
            },
          ).toString()}`,
          'businesses',
        )
      : Promise.resolve(
          {
            ok: true,
            payload: null,
            status: null,
          },
        ),

    requested.has(
      'references',
    )
      ? fetchJson(
          req,
          `/api/super-app/umkm/stores?${referenceParams.toString()}`,
          'references',
        )
      : Promise.resolve(
          {
            ok: true,
            payload: null,
            status: null,
          },
        ),

    requested.has(
      'communities',
    )
      ? fetchJson(
          req,
          `/api/community/search?${new URLSearchParams(
            {
              q: effectiveQuery,
              kind: 'all',
              limit: '12',
            },
          ).toString()}`,
          'communities',
        )
      : Promise.resolve(
          {
            ok: true,
            payload: null,
            status: null,
          },
        ),

    requested.has('videos')
      ? fetchJson(
          req,
          `/api/reels?${new URLSearchParams(
            {
              q: effectiveQuery,
              limit: '12',
            },
          ).toString()}`,
          'videos',
        )
      : Promise.resolve(
          {
            ok: true,
            payload: null,
            status: null,
          },
        ),

    requested.has('users')
      ? fetchJson(
          req,
          `/api/users/discover?${new URLSearchParams(
            {
              q: effectiveQuery,
              ...(state.location
                ? {
                    location:
                      state.location,
                  }
                : {}),
              limit:
                isPeopleBrowse &&
                !effectiveQuery
                  ? '24'
                  : '12',
            },
          ).toString()}`,
          'users',
        )
      : Promise.resolve(
          {
            ok: true,
            payload: null,
            status: null,
          },
        ),
  ]);

  const requestedSourceResults =
    [
      contentNeeded
        ? contentResult
        : null,

      requested.has(
        'businesses',
      )
        ? businessesResult
        : null,

      requested.has(
        'references',
      )
        ? referencesResult
        : null,

      requested.has(
        'communities',
      )
        ? communityResult
        : null,

      requested.has(
        'videos',
      )
        ? reelsResult
        : null,

      requested.has('users')
        ? usersResult
        : null,
    ].filter(
      (
        result,
      ): result is SearchSourceResult =>
        result !== null,
    );

  const allRequestedSourcesFailed =
    requestedSourceResults.length >
      0 &&
    requestedSourceResults.every(
      result =>
        !result.ok,
    );

  const response =
    emptyGlobalSearchResponse(
      state.query,
    );

  const contentPayload =
    asRecord(
      contentResult.payload,
    );

  const rawContentItems =
    asArray(
      contentPayload?.items,
    );

  const contentItems =
    rawContentItems
      .map(mapContentItem)
      .filter(
        (
          item,
        ): item is GlobalSearchItem =>
          Boolean(item),
      )
      /**
       * The server-side normalized side is authoritative.
       */
      .filter(
        item =>
          state.side ===
            'all' ||
          item.side ===
            state.side,
      )
      .filter(item => {
        const priceCents =
          readNumber(
            item.metadata
              .priceCents,
          );

        if (
          minPrice !==
            null &&
          priceCents !==
            null &&
          priceCents <
            minPrice * 100
        ) {
          return false;
        }

        if (
          maxPrice !==
            null &&
          priceCents !==
            null &&
          priceCents >
            maxPrice * 100
        ) {
          return false;
        }

        if (
          condition &&
          condition !== 'all'
        ) {
          const itemCondition =
            readString(
              item.metadata
                .condition,
            ).toLowerCase();

          if (
            itemCondition &&
            itemCondition !==
              condition
          ) {
            return false;
          }
        }

        if (
          serviceMode &&
          serviceMode !== 'all' &&
          item.kind ===
            'services'
        ) {
          const itemMode =
            readString(
              item.metadata
                .serviceMode,
            ).toLowerCase();

          if (
            itemMode &&
            itemMode !==
              serviceMode
          ) {
            return false;
          }
        }

        if (
          requestStatus &&
          requestStatus !== 'all' &&
          item.kind ===
            'needs'
        ) {
          const itemStatus =
            readString(
              item.metadata
                .requestStatus,
            )
              .toLowerCase()
              .replace(
                /\s+/g,
                '_',
              );

          if (
            requestStatus ===
            'open'
          ) {
            return (
              !itemStatus ||
              [
                'open',
                'active',
                'published',
              ].includes(
                itemStatus,
              )
            );
          }

          return (
            itemStatus ===
            requestStatus
          );
        }

        return true;
      });

  const businessPayload =
    asRecord(
      asRecord(
        businessesResult.payload,
      )?.data,
    );

  const referencePayload =
    asRecord(
      asRecord(
        referencesResult.payload,
      )?.data,
    );

  const communityPayload =
    asRecord(
      communityResult.payload,
    );

  const reelsPayload =
    asRecord(
      reelsResult.payload,
    );

  const userPayload =
    asRecord(
      usersResult.payload,
    );

  const relevanceQuery =
    state.sort ===
    'relevance'
      ? effectiveQuery
      : '';

  /**
   * Supply = products.
   *
   * The side was already normalized in mapContentItem().
   */
  response.groups.products =
    group(
      contentItems.filter(
        item =>
          item.kind ===
            'products' &&
          item.side ===
            'supply',
      ),
      requested.has(
        'products',
      ),
      contentNeeded &&
        !contentResult.ok
        ? 'products_unavailable'
        : null,
      relevanceQuery,
    );

  /**
   * Supply = services.
   */
  response.groups.services =
    group(
      contentItems.filter(
        item =>
          item.kind ===
            'services' &&
          item.side ===
            'supply',
      ),
      requested.has(
        'services',
      ),
      contentNeeded &&
        !contentResult.ok
        ? 'services_unavailable'
        : null,
      relevanceQuery,
    );

  /**
   * Demand = needs.
   */
  response.groups.needs =
    group(
      contentItems.filter(
        item =>
          item.kind ===
            'needs' &&
          item.side ===
            'demand',
      ),
      requested.has(
        'needs',
      ),
      contentNeeded &&
        !contentResult.ok
        ? 'needs_unavailable'
        : null,
      relevanceQuery,
    );

  response.groups.references =
    group(
      requested.has(
        'references',
      )
        ? asArray(
            referencePayload?.items,
          ).map(
            mapPublicReferenceItem,
          )
        : [],
      requested.has(
        'references',
      ),
      requested.has(
        'references',
      ) &&
        !referencesResult.ok
        ? 'references_unavailable'
        : null,
      relevanceQuery,
    );

  const referenceNextCursor =
    readReferenceCursor(
      referencePayload?.next_cursor,
    );

  response.groups.references.nextCursor =
    requested.has(
      'references',
    ) &&
    referenceNextCursor
      ? referenceNextCursor
      : null;

  const verifiedOnly =
    req.nextUrl.searchParams.get(
      'verified',
    ) === '1';

  const privacy =
    readString(
      req.nextUrl.searchParams.get(
        'privacy',
      ),
    ).toLowerCase();

  response.groups.businesses =
    group(
      asArray(
        businessPayload?.items,
      )
        .map(mapBusiness)
        .filter(
          item =>
            !verifiedOnly ||
            item?.verified,
        ),
      requested.has(
        'businesses',
      ),
      requested.has(
        'businesses',
      ) &&
        !businessesResult.ok
        ? 'businesses_unavailable'
        : null,
      relevanceQuery,
    );

  response.groups.communities =
    group(
      [
        ...asArray(
          communityPayload?.groups,
        ).map(
          mapCommunityGroup,
        ),

        ...asArray(
          communityPayload?.posts,
        ).map(
          mapCommunityPost,
        ),
      ].filter(item => {
        if (
          !item ||
          !privacy ||
          privacy === 'all'
        ) {
          return true;
        }

        return (
          readString(
            item.metadata
              .privacy,
          ).toLowerCase() ===
          privacy
        );
      }),
      requested.has(
        'communities',
      ),
      requested.has(
        'communities',
      ) &&
        !communityResult.ok
        ? 'communities_unavailable'
        : null,
      relevanceQuery,
    );

  response.groups.videos =
    group(
      asArray(
        reelsPayload?.items,
      ).map(mapVideo),
      requested.has(
        'videos',
      ),
      requested.has(
        'videos',
      ) &&
        !reelsResult.ok
        ? 'videos_unavailable'
        : null,
      relevanceQuery,
    );

  response.groups.users =
    group(
      asArray(
        userPayload?.data,
      )
        .map(mapUser)
        .filter(
          item =>
            !verifiedOnly ||
            item?.verified,
        ),
      requested.has(
        'users',
      ),
      requested.has(
        'users',
      ) &&
        !usersResult.ok
        ? 'users_unavailable'
        : null,
      relevanceQuery,
    );

  response.total =
    GROUP_KEYS.reduce(
      (sum, key) =>
        sum +
        response.groups[key]
          .total,
      0,
    );

  /**
   * Available tabs are derived from the current side.
   */
  const availableTabs =
    new Set<GlobalSearchTab>();

  if (
    requested.has(
      'references',
    )
  ) {
    availableTabs.add(
      'references',
    );
  } else if (
    state.side === 'demand'
  ) {
    availableTabs.add(
      'needs',
    );
  } else {
    availableTabs.add(
      'all',
    );
  }

  const allowedTabs =
    requested.has(
      'references',
    )
      ? new Set<GlobalSearchTab>(
          ['references'],
        )
      : state.side ===
          'demand'
        ? new Set<GlobalSearchTab>(
            ['needs'],
          )
        : state.side ===
            'supply'
          ? new Set<GlobalSearchTab>(
              [
                'all',
                'products',
                'services',
                'businesses',
              ],
            )
          : null;

  GROUP_KEYS.forEach(
    key => {
      if (
        allowedTabs &&
        !allowedTabs.has(
          key,
        )
      ) {
        return;
      }

      if (
        response.groups[key]
          .available &&
        response.groups[key]
          .total > 0
      ) {
        availableTabs.add(
          key,
        );
      }
    },
  );

  const orderedTabs: GlobalSearchTab[] =
    [
      'all',
      ...GROUP_KEYS,
    ];

  response.availableTabs =
    orderedTabs.filter(
      tab =>
        availableTabs.has(
          tab,
        ),
    );

  return NextResponse.json(
    response satisfies GlobalSearchResponse,
    {
      status:
        allRequestedSourcesFailed
          ? 503
          : 200,

      headers: {
        'Cache-Control':
          allRequestedSourcesFailed
            ? 'private, no-store'
            : 'private, max-age=15, stale-while-revalidate=30',

        ...(allRequestedSourcesFailed
          ? {
              'Retry-After':
                '5',
            }
          : {}),
      },
    },
  );
}