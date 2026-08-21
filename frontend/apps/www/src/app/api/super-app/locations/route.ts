import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/serverAuth';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import {
  listSavedLocations,
  saveLocation,
  type SavedLocation,
} from '@/lib/super-app/locations';

const LocationSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(2).max(80),
  address: z.string().min(3).max(240).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  kind: z.enum(['home', 'work', 'other']).optional(),
  notes: z.string().max(120).optional(),
  set_default_pickup: z.boolean().optional(),
  set_default_dropoff: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    return NextResponse.json({
      data: await listSavedLocations(auth.ctx.userId),
    });
  } catch (error) {
    console.error('[SUPER_APP_LOCATIONS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load saved locations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-locations',
      ipLimit: 120,
      deviceLimit: 90,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:locations:${auth.ctx.userId}:${security.ip}`,
      limit: 120,
      windowSeconds: 3600,
      message: 'Too many location updates. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const parsed = await parseJsonBodyWithSchema(req, LocationSchema);
    if (!parsed.ok) return parsed.response;

    const payload = parsed.data;
    if (payload.lat === undefined && payload.lng !== undefined) {
      return NextResponse.json({ error: 'lat and lng must be provided together' }, { status: 400 });
    }
    if (payload.lng === undefined && payload.lat !== undefined) {
      return NextResponse.json({ error: 'lat and lng must be provided together' }, { status: 400 });
    }

    const input: Partial<SavedLocation> = {
      id: payload.id,
      label: payload.label,
      address: payload.address,
      lat: payload.lat,
      lng: payload.lng,
      kind: payload.kind,
      notes: payload.notes,
      is_default_pickup: payload.set_default_pickup,
      is_default_dropoff: payload.set_default_dropoff,
    };

    const items = await saveLocation(auth.ctx.userId, input);
    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('[SUPER_APP_LOCATIONS_POST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to save location' }, { status: 500 });
  }
}
