import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import {
  getNearbyDrivers,
  type SuperAppService,
} from '@/lib/super-app/dispatch';

const QuerySchema = z.object({
  service: z.enum(['ride', 'car', 'food', 'send', 'mart', 'services']),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_m: z.coerce.number().min(50).max(10000).default(1000),
  limit: z.coerce.number().min(1).max(50).default(12),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      service: url.searchParams.get('service'),
      lat: url.searchParams.get('lat'),
      lng: url.searchParams.get('lng'),
      radius_m: url.searchParams.get('radius_m') || '1000',
      limit: url.searchParams.get('limit') || '12',
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    const query = parsed.data;
    const rl = await enforceRateLimit({
      key: `superapp:nearby:${auth.ctx.userId}:${query.service}:${query.lat}:${query.lng}`,
      limit: 500,
      windowSeconds: 3600,
      message: 'Too many nearby checks',
    });
    if (!rl.ok) return rl.response;

    const drivers = await getNearbyDrivers({
      service: query.service as SuperAppService,
      lat: query.lat,
      lng: query.lng,
      radiusM: query.radius_m,
      limit: query.limit,
    });

    return NextResponse.json(
      {
        data: drivers,
        meta: {
          radius_m: query.radius_m,
          total: drivers.length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[SUPER_APP_DRIVERS_NEARBY_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch nearby drivers' }, { status: 500 });
  }
}
