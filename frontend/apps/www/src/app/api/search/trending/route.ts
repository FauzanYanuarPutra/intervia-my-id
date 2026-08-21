import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(
      new URL('/api/home/trending-searches', req.nextUrl.origin),
      { cache: 'no-store', signal: AbortSignal.timeout(8000) },
    );
    const payload = await response.json().catch(() => null);
    const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    return NextResponse.json(
      { items },
      {
        status: response.ok ? 200 : response.status,
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      },
    );
  } catch {
    return NextResponse.json({ items: [] });
  }
}
