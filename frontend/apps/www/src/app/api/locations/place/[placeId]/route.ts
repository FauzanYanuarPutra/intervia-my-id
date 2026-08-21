import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { getLocationProvider } from '@/lib/location/providers';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ placeId: string }> },
) {
  try {
    const ip = getClientIp(req);
    const rl = await enforceRateLimit({
      key: `locations:place:${ip}`,
      limit: 300,
      windowSeconds: 3600,
      message: 'Too many location detail requests. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const { placeId } = await context.params;
    const url = new URL(req.url);
    const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'id';
    const decodedPlaceId = decodeURIComponent(placeId || '').trim();
    if (!decodedPlaceId) {
      return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
    }

    const data = await getLocationProvider().place(decodedPlaceId, locale);
    return NextResponse.json({ data, provider: 'osm' });
  } catch (error) {
    console.error('[LOCATIONS_PLACE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load location detail' }, { status: 500 });
  }
}
