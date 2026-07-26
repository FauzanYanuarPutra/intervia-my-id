import { NextRequest, NextResponse } from 'next/server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(req: NextRequest) {
  const upstream = new URL('/v1/industries', MARKETPLACE_URL);
  req.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  const response = await fetch(upstream, { cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? { error: 'Invalid response' }, {
    status: response.status,
  });
}
