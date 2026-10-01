import { NextRequest, NextResponse } from 'next/server';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { isCoordinateValid } from '@/lib/super-app/location-guard';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

function readOptionalNumber(params: URLSearchParams, key: string, min: number, max: number): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return undefined;
  return value;
}

function normalizeMapFilterText(value: string, maxLength: number): string {
  return value
    .replace(/\\p{C}/gu, ' ')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function readOptionalInteger(params: URLSearchParams, key: string, min: number, max: number, fallback: number): number {
  const value = readOptionalNumber(params, key, min, max);
  if (value === undefined) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

async function fetchMapDataWithRetry(url: string): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (response.ok || (response.status < 500 && response.status !== 429) || attempt === 2) return response;
      await response.body?.cancel();
      const retryAfter = Number(response.headers.get('retry-after') || 0);
      await new Promise(resolve => setTimeout(resolve, retryAfter > 0 && retryAfter <= 2 ? retryAfter * 1000 : 180 * 2 ** attempt));
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 180 * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error('Map upstream request failed');
}

type MapPoint = {
  id: string;
  slug: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  category: string;
  source_kind: string;
  metadata?: Record<string, unknown>;
};

type MapPointsPayload = {
  items: MapPoint[];
  total_count: number;
};

type MapPointsCacheEntry = {
  freshUntil: number;
  staleUntil: number;
  payload: MapPointsPayload;
};

const MAP_POINTS_FRESH_MS = 45_000;
const MAP_POINTS_STALE_MS = 5 * 60_000;
const MAP_POINTS_CACHE = new Map<string, MapPointsCacheEntry>();

function mapPointsCacheKey(params: URLSearchParams): string {
  return params.toString();
}

function normalizeMapPointsPayload(payload: {
  items?: MapPoint[];
  total_count?: number;
}): MapPointsPayload {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const totalCount =
    typeof payload.total_count === 'number' &&
    Number.isFinite(payload.total_count) &&
    payload.total_count >= 0
      ? Math.floor(payload.total_count)
      : items.length;

  return {
    items,
    total_count: Math.max(totalCount, items.length),
  };
}

function cacheMapPoints(key: string, payload: MapPointsPayload): void {
  const now = Date.now();
  MAP_POINTS_CACHE.delete(key);
  MAP_POINTS_CACHE.set(key, {
    freshUntil: now + MAP_POINTS_FRESH_MS,
    staleUntil: now + MAP_POINTS_STALE_MS,
    payload,
  });

  while (MAP_POINTS_CACHE.size > 32) {
    const oldestKey = MAP_POINTS_CACHE.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    MAP_POINTS_CACHE.delete(oldestKey);
  }
}

function getCachedMapPoints(
  key: string,
  allowStale = false,
): MapPointsCacheEntry | null {
  const entry = MAP_POINTS_CACHE.get(key);
  if (!entry) return null;
  const now = Date.now();

  if (entry.freshUntil > now) {
    MAP_POINTS_CACHE.delete(key);
    MAP_POINTS_CACHE.set(key, entry);
    return entry;
  }

  if (allowStale && entry.staleUntil > now) return entry;

  MAP_POINTS_CACHE.delete(key);
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-map-points',
      ipLimit: 600,
      deviceLimit: 500,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:map-points:${security.ip}`,
      limit: 300,
      windowSeconds: 3600,
      message: 'Too many map point requests. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const url = new URL(req.url);
    const paramsInput = url.searchParams;
    const limit = readOptionalInteger(paramsInput, 'limit', 1, 3000, 1000);
    const minLatInput = readOptionalNumber(paramsInput, 'min_lat', -90, 90);
    const maxLatInput = readOptionalNumber(paramsInput, 'max_lat', -90, 90);
    const minLngInput = readOptionalNumber(paramsInput, 'min_lng', -180, 180);
    const maxLngInput = readOptionalNumber(paramsInput, 'max_lng', -180, 180);
    const hasAnyBounds = paramsInput.has('min_lat') || paramsInput.has('max_lat') || paramsInput.has('min_lng') || paramsInput.has('max_lng');
    const hasCompleteBounds = minLatInput !== undefined && maxLatInput !== undefined && minLngInput !== undefined && maxLngInput !== undefined;
    if (hasAnyBounds && !hasCompleteBounds) {
      return NextResponse.json({ data: { items: [], count: 0, total_count: 0, transient: true } }, { headers: { 'Cache-Control': 'no-store' } });
    }
    let minLat = minLatInput, maxLat = maxLatInput, minLng = minLngInput, maxLng = maxLngInput;
    if (hasCompleteBounds) {
      if (minLat! > maxLat!) [minLat, maxLat] = [maxLat!, minLat!];
      if (minLng! > maxLng!) [minLng, maxLng] = [maxLng!, minLng!];
    }
    const normalizedQValue = normalizeMapFilterText(paramsInput.get('q') || '', 120);
    const normalizedCityValue = normalizeMapFilterText(paramsInput.get('city') || '', 80);
    const normalizedCategoryValue = normalizeMapFilterText(paramsInput.get('category') || '', 80);
    const normalizedQ = normalizedQValue.length >= 2 ? normalizedQValue : undefined;
    const normalizedCity = normalizedCityValue.length >= 2 ? normalizedCityValue : undefined;
    const normalizedCategory = normalizedCategoryValue.length >= 2 ? normalizedCategoryValue : undefined;
    const viewerLat = readOptionalNumber(paramsInput, 'viewer_lat', -90, 90);
    const viewerLng = readOptionalNumber(paramsInput, 'viewer_lng', -180, 180);
    const radiusInput = readOptionalNumber(paramsInput, 'radius_km', 0.0001, 1000);
    const hasViewer = viewerLat !== undefined && viewerLng !== undefined && isCoordinateValid({ lat: viewerLat, lng: viewerLng });
    const normalizedRadius = hasViewer ? radiusInput : undefined;
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (normalizedQ) params.set('q', normalizedQ);
    if (normalizedCity) params.set('city', normalizedCity);
    if (normalizedCategory) params.set('category', normalizedCategory);
    if (minLat !== undefined) params.set('min_lat', String(minLat));
    if (maxLat !== undefined) params.set('max_lat', String(maxLat));
    if (minLng !== undefined) params.set('min_lng', String(minLng));
    if (maxLng !== undefined) params.set('max_lng', String(maxLng));
    if (hasViewer) { params.set('viewer_lat', String(viewerLat)); params.set('viewer_lng', String(viewerLng)); }
    if (normalizedRadius !== undefined) params.set('radius_km', String(normalizedRadius));

    const canUseServerCache = !hasViewer;
    const cacheKey = mapPointsCacheKey(params);
    const cached = canUseServerCache ? getCachedMapPoints(cacheKey) : null;
    if (cached) {
      return NextResponse.json(
        { data: cached.payload },
        {
          headers: {
            'Cache-Control': hasViewer
              ? 'private, no-store'
              : 'public, s-maxage=45, stale-while-revalidate=180',
            'X-Lajukan-Map-Cache': 'hit',
          },
        },
      );
    }

    let response: Response;
    try {
      response = await fetchMapDataWithRetry(
        `${MARKETPLACE_URL}/v1/map/places?${params.toString()}`,
      );
    } catch (fetchError) {
      const stale = canUseServerCache
        ? getCachedMapPoints(cacheKey, true)
        : null;
      if (stale) {
        console.warn('[UMKM_MAP_POINTS_STALE]', fetchError);
        return NextResponse.json(
          { data: stale.payload, transient: true },
          {
            headers: {
              'Cache-Control': hasViewer
                ? 'private, no-store'
                : 'public, s-maxage=15, stale-while-revalidate=60',
              'X-Lajukan-Map-Cache': 'stale',
            },
          },
        );
      }
      throw fetchError;
    }

    if (!response.ok) {
      const stale = canUseServerCache
        ? getCachedMapPoints(cacheKey, true)
        : null;
      if (stale) {
        return NextResponse.json(
          { data: stale.payload, transient: true },
          {
            headers: {
              'Cache-Control': hasViewer
                ? 'private, no-store'
                : 'public, s-maxage=15, stale-while-revalidate=60',
              'X-Lajukan-Map-Cache': 'stale',
            },
          },
        );
      }
      return NextResponse.json(
        { error: 'Map data source unavailable' },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as {
      items?: MapPoint[];
      total_count?: number;
    };
    const items = Array.isArray(payload.items)
      ? payload.items.filter(
          item =>
            typeof item?.id === 'string' &&
            typeof item?.slug === 'string' &&
            typeof item?.name === 'string' &&
            Number.isFinite(item?.lat) &&
            Number.isFinite(item?.lng) &&
            isCoordinateValid({ lat: item.lat, lng: item.lng }),
        )
      : [];

    const normalizedPayload = normalizeMapPointsPayload({
      items,
      total_count: payload.total_count,
    });
    if (canUseServerCache) {
      cacheMapPoints(cacheKey, normalizedPayload);
    }

    return NextResponse.json(
      {
        data: {
          items: normalizedPayload.items,
          count: normalizedPayload.items.length,
          total_count: normalizedPayload.total_count,
        },
      },
      {
        headers: {
          'Cache-Control': hasViewer
            ? 'private, no-store'
            : 'public, s-maxage=45, stale-while-revalidate=180',
        },
      },
    );
  } catch (error) {
    console.warn('[UMKM_MAP_POINTS_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to load map points' },
      { status: 502 },
    );
  }
}
