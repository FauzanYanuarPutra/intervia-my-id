import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

type LatLng = { lat: number; lng: number };

const QuerySchema = z.object({
  origin_lat: z.coerce.number().min(-90).max(90),
  origin_lng: z.coerce.number().min(-180).max(180),
  destination_lat: z.coerce.number().min(-90).max(90),
  destination_lng: z.coerce.number().min(-180).max(180),
  via_lat: z.coerce.number().min(-90).max(90).optional(),
  via_lng: z.coerce.number().min(-180).max(180).optional(),
  profile: z.enum(['driving', 'cycling', 'walking']).default('driving'),
});

type OsrmRouteResponse = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      coordinates?: number[][];
    };
  }>;
};

function hasPair(lat: number | undefined, lng: number | undefined): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function toLatLngPair(value: number[]): LatLng | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lng = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

function fallbackPath(origin: LatLng, destination: LatLng, via?: LatLng): LatLng[] {
  if (via) {
    return [origin, via, destination];
  }
  return [origin, destination];
}

function getOsrmBaseUrl(): string {
  const raw = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
  return raw.replace(/\/+$/, '');
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      origin_lat: url.searchParams.get('origin_lat'),
      origin_lng: url.searchParams.get('origin_lng'),
      destination_lat: url.searchParams.get('destination_lat'),
      destination_lng: url.searchParams.get('destination_lng'),
      via_lat: url.searchParams.get('via_lat') || undefined,
      via_lng: url.searchParams.get('via_lng') || undefined,
      profile: url.searchParams.get('profile') || 'driving',
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid routing query' }, { status: 400 });
    }

    const query = parsed.data;
    if (hasPair(query.via_lat, query.via_lng) !== (query.via_lat !== undefined || query.via_lng !== undefined)) {
      return NextResponse.json({ error: 'via_lat and via_lng must be provided together' }, { status: 400 });
    }

    const requesterKey = auth.ok ? `user:${auth.ctx.userId}` : `ip:${getClientIp(req.headers)}`;
    const rl = await enforceRateLimit({
      key: `superapp:routing:${requesterKey}:${query.profile}:${query.origin_lat}:${query.origin_lng}:${query.destination_lat}:${query.destination_lng}`,
      limit: 1200,
      windowSeconds: 3600,
      message: 'Too many route calculations',
    });
    if (!rl.ok) return rl.response;

    const origin: LatLng = { lat: query.origin_lat, lng: query.origin_lng };
    const destination: LatLng = { lat: query.destination_lat, lng: query.destination_lng };
    const via = hasPair(query.via_lat, query.via_lng)
      ? { lat: query.via_lat!, lng: query.via_lng! }
      : undefined;

    const coords = [
      `${query.origin_lng},${query.origin_lat}`,
      ...(via ? [`${query.via_lng},${query.via_lat}`] : []),
      `${query.destination_lng},${query.destination_lat}`,
    ];

    const osrmUrl = `${getOsrmBaseUrl()}/route/v1/${query.profile}/${coords.join(';')}?overview=full&geometries=geojson&steps=false`;
    const osrmRes = await fetch(osrmUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!osrmRes.ok) {
      return NextResponse.json(
        {
          data: {
            points: fallbackPath(origin, destination, via),
            distance_m: null,
            duration_s: null,
            used_fallback: true,
            provider: 'fallback',
          },
        },
        { status: 200 },
      );
    }

    const osrmData = (await osrmRes.json().catch(() => ({}))) as OsrmRouteResponse;
    const topRoute = osrmData.routes?.[0];
    const coordinates = Array.isArray(topRoute?.geometry?.coordinates)
      ? topRoute!.geometry!.coordinates!
      : [];

    const points = coordinates
      .map((coord) => toLatLngPair(coord))
      .filter((item): item is LatLng => Boolean(item));

    if (points.length === 0) {
      return NextResponse.json(
        {
          data: {
            points: fallbackPath(origin, destination, via),
            distance_m: null,
            duration_s: null,
            used_fallback: true,
            provider: 'fallback',
          },
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        data: {
          points,
          distance_m: Number.isFinite(topRoute?.distance) ? Math.round(topRoute!.distance!) : null,
          duration_s: Number.isFinite(topRoute?.duration) ? Math.round(topRoute!.duration!) : null,
          used_fallback: false,
          provider: 'osrm',
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[SUPER_APP_ROUTING_ERROR]', error);
    return NextResponse.json({ error: 'Failed to calculate route' }, { status: 500 });
  }
}
