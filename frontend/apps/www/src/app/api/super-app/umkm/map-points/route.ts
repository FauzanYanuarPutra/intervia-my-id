import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { isCoordinateValid } from '@/lib/super-app/location-guard';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

const optionalNumber = (schema: z.ZodTypeAny) =>
  z.preprocess(
    value =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    schema,
  );

const QuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  limit: z.coerce.number().finite().int().min(1).max(1800).default(600),
  min_lat: optionalNumber(z.coerce.number().finite().min(-90).max(90).optional()),
  max_lat: optionalNumber(z.coerce.number().finite().min(-90).max(90).optional()),
  min_lng: optionalNumber(z.coerce.number().finite().min(-180).max(180).optional()),
  max_lng: optionalNumber(z.coerce.number().finite().min(-180).max(180).optional()),
  viewer_lat: optionalNumber(z.coerce.number().finite().min(-90).max(90).optional()),
  viewer_lng: optionalNumber(z.coerce.number().finite().min(-180).max(180).optional()),
  radius_km: optionalNumber(z.coerce.number().finite().positive().max(1000).optional()),
});

type MapPoint = {
  id: string;
  slug: string;
  public_path?: string | null;
  name: string;
  city: string;
  lat: number;
  lng: number;
  category: string;
  source_kind: string;
  metadata?: Record<string, unknown>;
};

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
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid map point query' }, { status: 400 });
    }

    const input = parsed.data;

    // Map viewport requests are transient and can race with Leaflet resize,
    // world-wrap, and filter updates. Normalize malformed optional values
    // instead of turning a temporary viewport state into a visible 400 error.
    const hasCompleteBounds =
      input.min_lat !== undefined &&
      input.max_lat !== undefined &&
      input.min_lng !== undefined &&
      input.max_lng !== undefined &&
      Number.isFinite(input.min_lat) &&
      Number.isFinite(input.max_lat) &&
      Number.isFinite(input.min_lng) &&
      Number.isFinite(input.max_lng);

    let minLat = hasCompleteBounds ? input.min_lat : undefined;
    let maxLat = hasCompleteBounds ? input.max_lat : undefined;
    let minLng = hasCompleteBounds ? input.min_lng : undefined;
    let maxLng = hasCompleteBounds ? input.max_lng : undefined;

    if (hasCompleteBounds) {
      if (minLat! > maxLat!) [minLat, maxLat] = [maxLat!, minLat!];
      if (minLng! > maxLng!) [minLng, maxLng] = [maxLng!, minLng!];
    } else {
      // Never accidentally request the entire dataset at high volume because
      // only one side of a transient viewport was available.
      minLat = maxLat = minLng = maxLng = undefined;
    }

    const normalizedQ =
      input.q && input.q.trim().length >= 2 ? input.q.trim() : undefined;
    const normalizedCity =
      input.city && input.city.trim().length >= 2
        ? input.city.trim()
        : undefined;

    const hasViewer =
      input.viewer_lat !== undefined &&
      input.viewer_lng !== undefined &&
      isCoordinateValid({
        lat: input.viewer_lat,
        lng: input.viewer_lng,
      });

    const normalizedViewerLat = hasViewer ? input.viewer_lat : undefined;
    const normalizedViewerLng = hasViewer ? input.viewer_lng : undefined;
    const normalizedRadius =
      hasViewer && input.radius_km !== undefined
        ? input.radius_km
        : undefined;

    const params = new URLSearchParams();
    params.set('limit', String(input.limit));
    if (normalizedQ) params.set('q', normalizedQ);
    if (normalizedCity) params.set('city', normalizedCity);
    if (input.category && input.category.trim().length >= 2) {
      params.set('category', input.category.trim());
    }
    if (minLat !== undefined) params.set('min_lat', String(minLat));
    if (maxLat !== undefined) params.set('max_lat', String(maxLat));
    if (minLng !== undefined) params.set('min_lng', String(minLng));
    if (maxLng !== undefined) params.set('max_lng', String(maxLng));
    if (hasViewer) {
      params.set('viewer_lat', String(normalizedViewerLat));
      params.set('viewer_lng', String(normalizedViewerLng));
    }
    if (normalizedRadius !== undefined) {
      params.set('radius_km', String(normalizedRadius));
    }

      const response = await fetch(
      `${MARKETPLACE_URL}/v1/map/places?${params.toString()}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!response.ok) {
      return NextResponse.json({ error: 'Map data source unavailable' }, { status: 502 });
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

    const totalCount =
      typeof payload.total_count === 'number' &&
      Number.isFinite(payload.total_count) &&
      payload.total_count >= 0
        ? Math.floor(payload.total_count)
        : items.length;

    return NextResponse.json(
      {
        data: {
          items,
          count: items.length,
          total_count: totalCount,
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
