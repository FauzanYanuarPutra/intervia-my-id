import { NextRequest, NextResponse } from 'next/server';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(req: NextRequest) {
  try {
    if (PROMO_ONLY_MODE) {
      return NextResponse.json(
        { error: 'Transactions are disabled for now' },
        { status: 404 },
      );
    }
    const token =
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      req.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const upstreamUrl = new URL('/v1/transactions', MARKETPLACE_URL);
    const params = new URL(req.url).searchParams;
    const status = params.get('status');
    const dealKind = params.get('deal_kind');
    const fulfillment = params.get('fulfillment_mode');
    const counterpartyId = params.get('counterparty_id');
    const limit = params.get('limit');
    const offset = params.get('offset');
    if (status) upstreamUrl.searchParams.set('status', status);
    if (dealKind) upstreamUrl.searchParams.set('deal_kind', dealKind);
    if (fulfillment) upstreamUrl.searchParams.set('fulfillment_mode', fulfillment);
    if (counterpartyId) upstreamUrl.searchParams.set('counterparty_id', counterpartyId);
    if (limit) upstreamUrl.searchParams.set('limit', limit);
    if (offset) upstreamUrl.searchParams.set('offset', offset);

    const res = await fetch(upstreamUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => []);
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[TRANSACTIONS_LIST_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

