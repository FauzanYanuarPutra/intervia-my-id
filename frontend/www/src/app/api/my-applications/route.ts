import { NextRequest, NextResponse } from 'next/server';

const MARKETPLACE_URL = process.env.INTERNAL_MARKETPLACE_URL || process.env.MARKETPLACE_URL || 'http://localhost:8081';

/**
 * My applications = user's transactions (as buyer or seller) from marketplace.
 * Backend: GET /v1/transactions returns list where buyer_id = user OR seller_id = user.
 */
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.cookies.get('access_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const upstream = new URL('/v1/transactions', MARKETPLACE_URL);
    const status = request.nextUrl.searchParams.get('status');
    const dealKind = request.nextUrl.searchParams.get('deal_kind');
    const fulfillmentMode = request.nextUrl.searchParams.get('fulfillment_mode');
    if (status) upstream.searchParams.set('status', status);
    if (dealKind) upstream.searchParams.set('deal_kind', dealKind);
    if (fulfillmentMode) upstream.searchParams.set('fulfillment_mode', fulfillmentMode);

    const res = await fetch(upstream.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => []);
    const list = Array.isArray(data) ? data : data?.data ?? data ?? [];
    const results = list;
    return NextResponse.json({ results, total: results.length });
  } catch (e) {
    console.error('[my-applications]', e);
    return NextResponse.json(
      { results: [], total: 0, error: 'Service unavailable' },
      { status: 503 }
    );
  }
}

