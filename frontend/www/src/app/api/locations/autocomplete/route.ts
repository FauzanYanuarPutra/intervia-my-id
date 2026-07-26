import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { getLocationProvider } from '@/lib/location/providers';

function readText(value: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function readNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = await enforceRateLimit({
      key: `locations:autocomplete:${ip}`,
      limit: 240,
      windowSeconds: 3600,
      message: 'Too many location searches. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const url = new URL(req.url);
    const query = readText(url.searchParams.get('q')).slice(0, 160);
    const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'id';
    const countryCode =
      readText(url.searchParams.get('countryCode') || 'ID') || 'ID';
    const lat = readNumber(url.searchParams.get('lat'));
    const lng = readNumber(url.searchParams.get('lng'));

    if (query.length < 2) {
      return NextResponse.json({ data: [], provider: 'osm' });
    }

    const provider = getLocationProvider();
    const data = await provider.autocomplete({
      query,
      locale,
      countryCode,
      limit: 10,
      bias:
        lat !== null && lng !== null
          ? {
              lat,
              lng,
            }
          : null,
    });

    return NextResponse.json({ data, provider: 'osm' });
  } catch (error) {
    console.error('[LOCATIONS_AUTOCOMPLETE_ERROR]', error);
    return NextResponse.json({ data: [], provider: 'osm' }, { status: 200 });
  }
}
