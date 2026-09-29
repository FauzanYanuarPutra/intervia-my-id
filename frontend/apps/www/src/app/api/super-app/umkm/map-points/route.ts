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

const QuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(1000),
  min_lat: z.coerce.number().min(-90).max(90).optional(),
  max_lat: z.coerce.number().min(-90).max(90).optional(),
  min_lng: z.coerce.number().min(-180).max(180).optional(),
  max_lng: z.coerce.number().min(-180).max(180).optional(),
  viewer_lat: z.coerce.number().min(-90).max(90).optional(),
  viewer_lng: z.coerce.number().min(-180).max(180).optional(),
});

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
    const hasAnyBounds =
      input.min_lat !== undefined ||
      input.max_lat !== undefined ||
      input.min_lng !== undefined ||
      input.max_lng !== undefined;
    if (
      hasAnyBounds &&
      [input.min_lat, input.max_lat, input.min_lng, input.max_lng].some(
        value => value === undefined,
      )
    ) {
      return NextResponse.json({ error: 'Complete map bounds are required' }, { status: 400 });
    }
    if (
      input.min_lat !== undefined &&
      input.max_lat !== undefined &&
      input.min_lat > input.max_lat
    ) {
      return NextResponse.json({ error: 'Invalid latitude bounds' }, { status: 400 });
    }
    if (
      input.min_lng !== undefined &&
      input.max_lng !== undefined &&
      input.min_lng > input.max_lng
    ) {
      return NextResponse.json({ error: 'Invalid longitude bounds' }, { status: 400 });
    }

    const hasViewer =
      input.viewer_lat !== undefined || input.viewer_lng !== undefined;
    if (
      hasViewer &&
      (input.viewer_lat === undefined ||
        input.viewer_lng === undefined ||
        !isCoordinateValid({
          lat: input.viewer_lat,
          lng: input.viewer_lng,
        }))
    ) {
      return NextResponse.json({ error: 'Invalid viewer coordinates' }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.set('limit', String(input.limit));
    if (input.q) params.set('q', input.q);
    if (input.city) params.set('city', input.city);
    if (input.category) params.set('category', input.category);
    if (input.min_lat !== undefined) params.set('min_lat', String(input.min_lat));
    if (input.max_lat !== undefined) params.set('max_lat', String(input.max_lat));
    if (input.min_lng !== undefined) params.set('min_lng', String(input.min_lng));
    if (input.max_lng !== undefined) params.set('max_lng', String(input.max_lng));
    if (hasViewer) {
      params.set('viewer_lat', String(input.viewer_lat));
      params.set('viewer_lng', String(input.viewer_lng));
    }

    const response = await fetch(
      `${MARKETPLACE_URL}/v1/map/places?${params.toString()}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(1800),
      },
    );
    if (!response.ok) {
      return NextResponse.json({ error: 'Map data source unavailable' }, { status: 502 });
    }

    const payload = (await response.json()) as { items?: MapPoint[] };
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

    return NextResponse.json(
      { data: { items, count: items.length } },
      {
        headers: {
          'Cache-Control': hasViewer
            ? 'private, no-store'
            : 'public, s-maxage=15, stale-while-revalidate=60',
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
