import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { getLocationProvider } from '@/lib/location/providers';

function readNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = await enforceRateLimit({
      key: `locations:reverse:${ip}`,
      limit: 180,
      windowSeconds: 3600,
      message: 'Too many reverse geocode requests. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const url = new URL(req.url);
    const lat = readNumber(url.searchParams.get('lat'));
    const lng = readNumber(url.searchParams.get('lng'));
    const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'id';

    if (lat === null || lng === null) {
      return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
    }

    const data = await getLocationProvider().reverseGeocode({ lat, lng, locale });
    return NextResponse.json({ data, provider: 'osm' });
  } catch (error) {
    console.error('[LOCATIONS_REVERSE_GEOCODE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to reverse geocode location' }, { status: 500 });
  }
}
