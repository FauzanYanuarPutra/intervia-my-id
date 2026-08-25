import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { haversineKm, isCoordinateValid } from '@/lib/super-app/location-guard';
import { getUmkmBusinessCategoryLabel } from '@/lib/super-app/umkm-taxonomy';
import {
  ensureUmkmQrToken,
  getStoreRecommendedQr,
  listUmkmTables,
  listUmkmStoresForActor,
  listUmkmStores,
  type UmkmStore,
  upsertUmkmTables,
} from '@/lib/super-app/umkm-commerce';
import {
  getUmkmStoreCollectionSummary,
  projectPublicUmkmStore,
} from '@/lib/super-app/umkm-public-store';
import { isPublicUmkmStoreVisible } from '@/lib/super-app/umkm-public-discovery';
import { sanitizeOwnerWritableUmkmMetadata } from '@/lib/super-app/umkm-owner-metadata';
import {
  createDurableMarketplaceStore,
  ensureWorkspaceOrganization,
} from '@/lib/super-app/business-workspace';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

type JsonRecord = Record<string, unknown>;

type PublicReferenceContent = {
  id?: unknown;
  slug?: unknown;
  title?: unknown;
  summary?: unknown;
  body?: unknown;
  cover_image?: unknown;
  metadata?: unknown;
  updated_at?: unknown;
};

type PublicReferenceList = {
  items?: PublicReferenceContent[];
  has_more?: boolean;
  next_cursor?: string;
};

type PublicReferenceMapItem = {
  id: string;
  slug: string;
  public_path: string;
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  description: string | null;
  phone: null;
  metadata: JsonRecord;
  recommended_qr: null;
  distance_km: number | null;
  online_order_enabled: false;
  offline_order_enabled: false;
  reservation_enabled: false;
  table_count: 0;
  available_table_count: 0;
  max_table_capacity: 0;
  updated_at: string;
};

const PUBLIC_REFERENCE_METADATA_KEYS = [
  'record_kind',
  'marketplace_category_slug',
  'marketplace_subcategory_slug',
  'category',
  'category_label',
  'city',
  'location',
  'address',
  'latitude',
  'longitude',
  'external_id',
  'source_dataset',
  'source_url',
  'source_title',
  'source_license',
  'source_license_url',
  'source_accessed_at',
  'image_attribution',
  'image_source_provider',
  'media_kind',
  'media_is_place_specific',
  'media_storage',
  'cover_image',
  'image_url',
  'gallery_images',
] as const;

const PUBLIC_REFERENCE_IMAGE_CREDIT_KEYS = [
  'provider',
  'author',
  'license',
  'license_name',
  'license_url',
  'source_url',
  'original_url',
  'attribution',
] as const;

const PUBLIC_REFERENCE_CURSOR_PATTERN =
  /^\d{1,19}:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function safeHttpUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.length > 2048) return '';
  try {
    const parsed = new URL(raw);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      !parsed.username &&
      !parsed.password
      ? parsed.toString()
      : '';
  } catch {
    return '';
  }
}

function safeOpenStreetMapSourceUrl(value: unknown): string {
  const safeUrl = safeHttpUrl(value);
  if (!safeUrl) return '';
  const parsed = new URL(safeUrl);
  const hostname = parsed.hostname.toLowerCase();
  return (hostname === 'openstreetmap.org' ||
    hostname === 'www.openstreetmap.org') &&
    /^\/(node|way|relation)\/\d+\/?$/.test(parsed.pathname)
    ? safeUrl
    : '';
}

function safeOdblLicenseUrl(value: unknown): string {
  const safeUrl = safeHttpUrl(value);
  if (!safeUrl) return '';
  const parsed = new URL(safeUrl);
  const hostname = parsed.hostname.toLowerCase();
  return (hostname === 'opendatacommons.org' ||
    hostname === 'www.opendatacommons.org') &&
    parsed.pathname.toLowerCase().startsWith('/licenses/odbl/1-0')
    ? safeUrl
    : '';
}

function safeInternalMediaUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw.length <= 2048 && raw.startsWith('/') && !raw.startsWith('//')
    ? raw
    : '';
}

function projectPublicReferenceMetadata(metadata: JsonRecord): JsonRecord {
  const projected: JsonRecord = {};
  for (const key of PUBLIC_REFERENCE_METADATA_KEYS) {
    const value = metadata[key];
    if (
      value === null ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      projected[key] = value;
    } else if (typeof value === 'string') {
      if (key === 'source_url' || key === 'source_license_url') {
        const safeUrl = safeHttpUrl(value);
        if (safeUrl) projected[key] = safeUrl;
      } else {
        projected[key] = value.slice(0, 4096);
      }
    } else if (Array.isArray(value)) {
      projected[key] = value
        .slice(0, 12)
        .filter(item => typeof item === 'string')
        .map(item => item.slice(0, 2048));
    }
  }
  const imageCredit = asRecord(metadata.image_credit);
  const projectedImageCredit: JsonRecord = {};
  for (const key of PUBLIC_REFERENCE_IMAGE_CREDIT_KEYS) {
    const value = imageCredit[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    if (key.endsWith('_url')) {
      const safeUrl = safeHttpUrl(value);
      if (safeUrl) projectedImageCredit[key] = safeUrl;
    } else {
      projectedImageCredit[key] = value.trim().slice(0, 512);
    }
  }
  if (Object.keys(projectedImageCredit).length > 0) {
    projected.image_credit = projectedImageCredit;
  }
  return projected;
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function readText(value: unknown): string {
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

function slugifyReferenceTitle(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72) || 'referensi'
  );
}

function referenceBusinessType(categorySlug: string): string {
  if (categorySlug === 'services') return 'jasa';
  if (categorySlug === 'machines-tools') return 'manufaktur';
  if (categorySlug === 'business-places') return 'toko';
  return 'ritel';
}

function mapPublicReference(
  item: PublicReferenceContent,
  viewer: { lat: number; lng: number } | null,
): PublicReferenceMapItem | null {
  const id = readText(item.id);
  const title = readText(item.title);
  const metadata = asRecord(item.metadata);
  const lat = readNumber(metadata.latitude ?? metadata.lat);
  const lng = readNumber(metadata.longitude ?? metadata.lng ?? metadata.lon);
  const sourceTitle = readText(metadata.source_title).slice(0, 160);
  const sourceLicense = readText(metadata.source_license).slice(0, 160);
  const sourceDataset = readText(metadata.source_dataset).toLowerCase();
  const sourceUrl = safeOpenStreetMapSourceUrl(metadata.source_url);
  const sourceLicenseUrl = safeOdblLicenseUrl(metadata.source_license_url);
  if (
    !id ||
    !title ||
    !sourceTitle ||
    !sourceTitle.toLowerCase().includes('openstreetmap') ||
    sourceDataset !== 'openstreetmap' ||
    !sourceLicense ||
    !/(odbl|open database license)/i.test(sourceLicense) ||
    !sourceUrl ||
    !sourceLicenseUrl ||
    lat === null ||
    lng === null ||
    !isCoordinateValid({ lat, lng })
  ) {
    return null;
  }

  const city =
    readText(metadata.city) || readText(metadata.location) || 'Indonesia';
  const address = readText(metadata.address) || city;
  const categorySlug = readText(metadata.marketplace_category_slug);
  const projectedMetadata = projectPublicReferenceMetadata(metadata);
  const coverImage =
    safeInternalMediaUrl(item.cover_image) ||
    safeInternalMediaUrl(projectedMetadata.cover_image) ||
    '/images/placeholders/business-default.svg';
  const projectedGallery = Array.isArray(projectedMetadata.gallery_images)
    ? projectedMetadata.gallery_images
        .map(safeInternalMediaUrl)
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const publicPath = `/content/${slugifyReferenceTitle(title)}-${encodeURIComponent(id)}`;
  const distanceKm = viewer ? haversineKm(viewer, { lat, lng }) : null;

  return {
    id: `reference:${id}`,
    slug: readText(item.slug) || `reference-${id}`,
    public_path: publicPath,
    name: title,
    city,
    address,
    lat,
    lng,
    description:
      readText(item.summary) ||
      readText(item.body) ||
      'Referensi lokasi publik dari OpenStreetMap.',
    phone: null,
    metadata: {
      ...projectedMetadata,
      source_title: sourceTitle,
      source_dataset: sourceDataset,
      source_url: sourceUrl,
      source_license: sourceLicense,
      source_license_url: sourceLicenseUrl,
      record_kind:
        readText(metadata.record_kind) || 'real_openstreetmap_reference',
      market_side: 'reference',
      is_public_reference: true,
      is_transactional: false,
      public_path: publicPath,
      cover_image: coverImage,
      image_url: coverImage,
      gallery_images:
        projectedGallery.length > 0 ? projectedGallery : [coverImage],
      umkm_category: referenceBusinessType(categorySlug),
      business_type: referenceBusinessType(categorySlug),
    },
    recommended_qr: null,
    distance_km: distanceKm === null ? null : Number(distanceKm.toFixed(2)),
    online_order_enabled: false,
    offline_order_enabled: false,
    reservation_enabled: false,
    table_count: 0,
    available_table_count: 0,
    max_table_capacity: 0,
    updated_at: readText(item.updated_at) || new Date(0).toISOString(),
  };
}

async function listPublicMapReferences(options: {
  query?: string;
  city?: string;
  limit: number;
  viewer: { lat: number; lng: number } | null;
  bounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  cursor?: string;
}): Promise<{
  items: PublicReferenceMapItem[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const params = new URLSearchParams({ limit: String(options.limit) });
  if (options.query) params.set('q', options.query);
  if (options.city) params.set('city', options.city);
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.viewer) {
    params.set('viewer_lat', String(options.viewer.lat));
    params.set('viewer_lng', String(options.viewer.lng));
  }
  if (options.bounds) {
    params.set('min_lat', String(options.bounds.minLat));
    params.set('max_lat', String(options.bounds.maxLat));
    params.set('min_lng', String(options.bounds.minLng));
    params.set('max_lng', String(options.bounds.maxLng));
  }

  const response = await fetch(
    `${MARKETPLACE_URL}/v1/map/references?${params.toString()}`,
    { cache: 'no-store', signal: AbortSignal.timeout(1500) },
  );
  if (!response.ok) {
    throw new Error(`reference source unavailable (${response.status})`);
  }
  const payload = (await response.json()) as PublicReferenceList;
  const items = (payload.items || [])
    .map(item => mapPublicReference(item, options.viewer))
    .filter((item): item is PublicReferenceMapItem => Boolean(item));
  const nextCursor =
    typeof payload.next_cursor === 'string' ? payload.next_cursor.trim() : '';
  return {
    items: items.slice(0, options.limit),
    hasMore: payload.has_more === true,
    nextCursor:
      nextCursor.length <= 96 &&
      PUBLIC_REFERENCE_CURSOR_PATTERN.test(nextCursor)
        ? nextCursor
        : null,
  };
}

function parseCoord(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRadiusKm(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, 200);
}

const PublicStoreQuerySchema = z.object({
  q: z.string().trim().max(120),
  city: z.string().trim().max(80),
  slug: z.string().trim().max(80),
  limit: z.coerce.number().int().min(1).max(500),
  offset: z.coerce.number().int().min(0).max(490),
  cursor: z
    .string()
    .trim()
    .max(96)
    .regex(PUBLIC_REFERENCE_CURSOR_PATTERN)
    .optional(),
  min_lat: z.coerce.number().min(-90).max(90).optional(),
  max_lat: z.coerce.number().min(-90).max(90).optional(),
  min_lng: z.coerce.number().min(-180).max(180).optional(),
  max_lng: z.coerce.number().min(-180).max(180).optional(),
});

function parseMapBounds(url: URL) {
  const parsed = PublicStoreQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    city: url.searchParams.get('city') ?? '',
    slug: url.searchParams.get('slug') ?? '',
    limit: url.searchParams.get('limit') ?? '10',
    offset: url.searchParams.get('offset') ?? '0',
    cursor: url.searchParams.get('cursor') ?? undefined,
    min_lat: url.searchParams.get('min_lat') ?? undefined,
    max_lat: url.searchParams.get('max_lat') ?? undefined,
    min_lng: url.searchParams.get('min_lng') ?? undefined,
    max_lng: url.searchParams.get('max_lng') ?? undefined,
  });
  if (!parsed.success) return null;
  const values = [parsed.data.min_lat, parsed.data.max_lat, parsed.data.min_lng, parsed.data.max_lng];
  const hasAny = values.some(value => value !== undefined);
  if (!hasAny) return { query: parsed.data, bounds: undefined };
  if (values.some(value => value === undefined)) return null;
  const bounds = {
    minLat: parsed.data.min_lat as number,
    maxLat: parsed.data.max_lat as number,
    minLng: parsed.data.min_lng as number,
    maxLng: parsed.data.max_lng as number,
  };
  if (bounds.minLat > bounds.maxLat || bounds.minLng > bounds.maxLng) return null;
  return { query: parsed.data, bounds };
}

async function resolveCollectionSummary(
  store: UmkmStore,
  includeLiveTables: boolean,
) {
  if (!includeLiveTables) return getUmkmStoreCollectionSummary(store);

  const tables = await listUmkmTables(store.id);
  const availableTables = tables.filter(table => table.status === 'available');
  const maxTableCapacity =
    tables.length > 0 ? Math.max(...tables.map(table => table.capacity)) : 0;

  return {
    table_count: tables.length,
    available_table_count: availableTables.length,
    max_table_capacity: maxTableCapacity,
    reservation_enabled: store.offline_order_enabled && tables.length > 0,
  };
}

const CreateStoreSchema = z.object({
  name: z.string().min(3).max(120),
  slug: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  business_category: z.string().min(2).max(64).optional(),
  city: z.string().min(2).max(80),
  address: z.string().min(3).max(240),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: z.string().max(40).optional(),
  online_order_enabled: z.boolean().optional(),
  offline_order_enabled: z.boolean().optional(),
  table_count: z.number().int().min(0).max(200).optional(),
  table_prefix: z.string().min(1).max(8).optional(),
  default_capacity: z.number().int().min(1).max(40).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-stores',
      ipLimit: 400,
      deviceLimit: 300,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:stores:${security.ip}`,
      limit: 360,
      windowSeconds: 3600,
      message: 'Too many UMKM store list requests. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const url = new URL(req.url);
    const parsedPublicQuery = parseMapBounds(url);
    if (!parsedPublicQuery) {
      return NextResponse.json({ error: 'Invalid UMKM map query' }, { status: 400 });
    }
    const mine =
      url.searchParams.get('mine') === '1' ||
      url.searchParams.get('mine') === 'true';
    if (!mine && parsedPublicQuery.query.limit > 50) {
      return NextResponse.json(
        { error: 'Public UMKM batches are limited to 50 items' },
        { status: 400 },
      );
    }
    if (!mine && parsedPublicQuery.query.offset + parsedPublicQuery.query.limit > 500) {
      return NextResponse.json(
        { error: 'Public UMKM pagination window cannot exceed 500 items' },
        { status: 400 },
      );
    }
    let actorUserId: string | undefined;
    let actorEmail: string | undefined;
    if (mine) {
      const auth = await requireAuth(req);
      if (!auth.ok) return auth.res;
      actorUserId = auth.ctx.userId;
      actorEmail = auth.ctx.email;
    }

    const query = parsedPublicQuery.query.q;
    const city = parsedPublicQuery.query.city;
    const slug = parsedPublicQuery.query.slug;
    const backendOnly =
      url.searchParams.get('backend_only') === '1' ||
      url.searchParams.get('backend_only') === 'true';
    const referencesOnly =
      !mine &&
      !slug &&
      (url.searchParams.get('references_only') === '1' ||
        url.searchParams.get('references_only') === 'true');
    const includeReferences =
      !mine &&
      !slug &&
      (referencesOnly ||
        url.searchParams.get('include_references') === '1' ||
        url.searchParams.get('include_references') === 'true');
    if (referencesOnly && query.length === 1) {
      return NextResponse.json(
        { error: 'Reference search requires at least 2 characters' },
        { status: 400 },
      );
    }
    const limit = parsedPublicQuery.query.limit;
    const offset = parsedPublicQuery.query.offset;
    const referenceCursor = parsedPublicQuery.query.cursor || undefined;
    if (referenceCursor && (!referencesOnly || offset !== 0)) {
      return NextResponse.json(
        { error: 'Reference cursor requires references_only=1 and offset=0' },
        { status: 400 },
      );
    }
    const viewerLatParam = url.searchParams.get('viewer_lat');
    const viewerLngParam = url.searchParams.get('viewer_lng');
    const radiusParam = url.searchParams.get('radius_km');
    if ((viewerLatParam === null) !== (viewerLngParam === null)) {
      return NextResponse.json(
        { error: 'Viewer coordinates must be provided together' },
        { status: 400 },
      );
    }
    const viewerLat = parseCoord(viewerLatParam);
    const viewerLng = parseCoord(viewerLngParam);
    const radiusKm = parseRadiusKm(radiusParam);
    const hasViewer =
      viewerLat !== null &&
      viewerLng !== null &&
      isCoordinateValid({ lat: viewerLat, lng: viewerLng });
    if (viewerLatParam !== null && !hasViewer) {
      return NextResponse.json(
        { error: 'Invalid viewer coordinates' },
        { status: 400 },
      );
    }
    if (radiusParam !== null && (radiusKm === null || !hasViewer)) {
      return NextResponse.json(
        { error: 'A valid viewer location is required for radius filtering' },
        { status: 400 },
      );
    }
    if (
      referenceCursor &&
      (query || parsedPublicQuery.bounds || hasViewer || radiusKm !== null)
    ) {
      return NextResponse.json(
        {
          error:
            'Reference cursor is only supported for newest-first browsing',
        },
        { status: 400 },
      );
    }
    const rankingOrigin = hasViewer
      ? { lat: viewerLat as number, lng: viewerLng as number }
      : parsedPublicQuery.bounds
        ? {
            lat:
              (parsedPublicQuery.bounds.minLat +
                parsedPublicQuery.bounds.maxLat) /
              2,
            lng:
              (parsedPublicQuery.bounds.minLng +
                parsedPublicQuery.bounds.maxLng) /
              2,
          }
        : null;
    const candidateLimit = mine
      ? limit
      : Math.min(500, offset + limit + 1);
    const referencesPromise = includeReferences
      ? listPublicMapReferences({
          query: query || undefined,
          city: city || undefined,
          limit: Math.min(
            50,
            referencesOnly && offset === 0 ? limit : candidateLimit,
          ),
          viewer: hasViewer
            ? { lat: viewerLat as number, lng: viewerLng as number }
            : null,
          bounds: parsedPublicQuery.bounds,
          cursor: referenceCursor,
        }).catch(error => {
          console.warn('[UMKM_PUBLIC_REFERENCES_UNAVAILABLE]', {
            message: error instanceof Error ? error.message : 'unknown error',
          });
          return { items: [], hasMore: false, nextCursor: null };
        })
      : Promise.resolve({ items: [], hasMore: false, nextCursor: null });

    const stores = referencesOnly
      ? []
      : mine
      ? await listUmkmStoresForActor({
          actorUserId: actorUserId as string,
          actorEmail,
          query: query || undefined,
          city: city || undefined,
          slug: slug || undefined,
          limit: candidateLimit,
        })
      : await listUmkmStores({
          query: query || undefined,
          city: city || undefined,
          slug: slug || undefined,
          backendOnly,
          activeOnly: true,
          limit: candidateLimit,
          ...(parsedPublicQuery.bounds
            ? { bounds: parsedPublicQuery.bounds }
            : {}),
          ...(rankingOrigin ? { viewer: rankingOrigin } : {}),
        });

    const visibleStores = mine
      ? stores
      : stores.filter(isPublicUmkmStoreVisible);

    const items = await Promise.all(
      visibleStores.map(async store => {
        const distanceKm = hasViewer
          ? haversineKm(
              { lat: viewerLat as number, lng: viewerLng as number },
              { lat: store.lat, lng: store.lng },
            )
          : null;
        const collectionSummary = await resolveCollectionSummary(store, mine);
        return {
          ...(mine ? store : projectPublicUmkmStore(store)),
          distance_km:
            distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
          recommended_qr: getStoreRecommendedQr(store),
          ...collectionSummary,
        };
      }),
    );
    const references = await referencesPromise;
    const referenceItems: PublicReferenceMapItem[] = references.items;
    const referenceHasMore = references.hasMore;
    const referenceNextCursor = references.nextCursor;

    const combinedItems = [...items, ...referenceItems];
    const filteredItems = combinedItems.filter(item => {
      const bounds = parsedPublicQuery.bounds;
      if (
        bounds &&
        (item.lat < bounds.minLat ||
          item.lat > bounds.maxLat ||
          item.lng < bounds.minLng ||
          item.lng > bounds.maxLng)
      ) {
        return false;
      }
      if (!hasViewer || radiusKm === null) return true;
      if (
        typeof item.distance_km !== 'number' ||
        !Number.isFinite(item.distance_km)
      )
        return false;
      return item.distance_km <= radiusKm;
    });

    const sortedItems = hasViewer
      ? [...filteredItems].sort((a, b) => {
          if (a.distance_km !== null && b.distance_km !== null) {
            return a.distance_km - b.distance_km;
          }
          if (a.distance_km !== null) return -1;
          if (b.distance_km !== null) return 1;
          return b.updated_at.localeCompare(a.updated_at);
        })
      : filteredItems;
    const rankedItems =
      includeReferences && !hasViewer && referenceItems.length > 0
        ? (() => {
            const storesOnly = sortedItems.filter(
              item => !item.id.startsWith('reference:'),
            );
            const referencesOnly = sortedItems.filter(item =>
              item.id.startsWith('reference:'),
            );
            const interleaved: typeof sortedItems = [];
            const length = Math.max(storesOnly.length, referencesOnly.length);
            for (let index = 0; index < length; index += 1) {
              if (storesOnly[index]) interleaved.push(storesOnly[index]);
              if (referencesOnly[index]) interleaved.push(referencesOnly[index]);
            }
            return interleaved;
          })()
        : sortedItems;
    const limitedItems = rankedItems.slice(offset, offset + limit);
    const withinPublicWindow = mine || offset + limitedItems.length < 500;
    const hasMore =
      limitedItems.length > 0 &&
      withinPublicWindow &&
      (rankedItems.length > offset + limit ||
        (!mine && stores.length >= candidateLimit) ||
        referenceHasMore);
    const nextOffset = hasMore ? offset + limitedItems.length : null;

    return NextResponse.json(
      {
        data: {
          items: limitedItems,
          count: sortedItems.length,
          reference_count: referenceItems.length,
          reference_has_more: referenceHasMore,
          next_cursor: referencesOnly ? referenceNextCursor : null,
          loaded_count: offset + limitedItems.length,
          has_more: hasMore,
          next_offset: nextOffset,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control':
            referencesOnly && !hasViewer && !parsedPublicQuery.bounds
              ? 'public, s-maxage=15, stale-while-revalidate=60'
              : 'private, no-store',
        },
      },
    );
  } catch (error) {
    console.error('[UMKM_STORES_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to load UMKM stores' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-stores-create',
      ipLimit: 120,
      deviceLimit: 90,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:stores:create:${auth.ctx.userId}:${security.ip}`,
      limit: 40,
      windowSeconds: 3600,
      message: 'Too many UMKM registration attempts. Please retry later.',
    });
    if (!rl.ok) return rl.response;

    const parsed = await parseJsonBodyWithSchema(req, CreateStoreSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    const organizationId = await ensureWorkspaceOrganization({
      token: auth.ctx.token,
      name: payload.name,
    });

    const store = await createDurableMarketplaceStore({
      token: auth.ctx.token,
      ownerUserId: auth.ctx.userId,
      organizationId,
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      city: payload.city,
      address: payload.address,
      lat: payload.lat,
      lng: payload.lng,
      phone: payload.phone,
      onlineOrderEnabled: payload.online_order_enabled,
      offlineOrderEnabled: payload.offline_order_enabled,
      metadata: {
        ...(payload.business_category
          ? {
              umkm_category: payload.business_category,
              business_type: payload.business_category,
              segment: getUmkmBusinessCategoryLabel(
                payload.business_category,
                true,
              ),
            }
          : {}),
        recommended_qr: (payload.table_count || 0) > 0 ? 'offline' : 'online',
        ...(sanitizeOwnerWritableUmkmMetadata(payload.metadata) || {}),
      },
    });

    let tables = [] as Awaited<ReturnType<typeof upsertUmkmTables>>;
    if ((payload.table_count || 0) > 0) {
      const prefix = (payload.table_prefix || 'T').toUpperCase();
      const tableRows = Array.from({ length: payload.table_count || 0 }).map(
        (_, idx) => {
          const number = String(idx + 1).padStart(2, '0');
          return {
            table_code: `${prefix}${number}`,
            capacity: payload.default_capacity || 2,
            status: 'available' as const,
            metadata: {},
          };
        },
      );
      tables = await upsertUmkmTables({
        storeId: store.id,
        tables: tableRows,
      });
      await Promise.all(
        tables.map(table =>
          ensureUmkmQrToken({
            storeId: store.id,
            mode: 'offline',
            tableId: table.id,
          }),
        ),
      );
    }

    const onlineQr = await ensureUmkmQrToken({
      storeId: store.id,
      mode: 'online',
    });

    return NextResponse.json(
      {
        data: {
          store,
          tables,
          qr: {
            online: onlineQr,
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[UMKM_STORES_CREATE_ERROR]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create UMKM store',
      },
      { status: 400 },
    );
  }
}