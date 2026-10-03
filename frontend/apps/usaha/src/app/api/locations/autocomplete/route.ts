import { NextRequest, NextResponse } from 'next/server';

const WWW_URL =
  process.env.INTERNAL_WWW_URL ||
  process.env.NEXT_PUBLIC_WWW_URL ||
  'http://localhost:3000';

export async function GET(request: NextRequest) {
  const incoming = new URL(request.url);
  const q = (incoming.searchParams.get('q') || '').trim().slice(0, 160);
  if (q.length < 2) {
    return NextResponse.json({ data: [], provider: 'lajukan' });
  }

  const params = new URLSearchParams({
    q,
    locale: incoming.searchParams.get('locale') === 'en' ? 'en' : 'id',
    countryCode: 'ID',
  });
  const lat = incoming.searchParams.get('lat');
  const lng = incoming.searchParams.get('lng');
  if (lat && lng) {
    params.set('lat', lat);
    params.set('lng', lng);
  }

  try {
    const response = await fetch(
      `${WWW_URL.replace(/\/+$/, '')}/api/locations/autocomplete?${params.toString()}`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!response.ok) {
      return NextResponse.json({ data: [], provider: 'lajukan' }, { status: 200 });
    }
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  } catch {
    return NextResponse.json({ data: [], provider: 'lajukan' }, { status: 200 });
  }
}
