import { NextRequest, NextResponse } from 'next/server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function POST(req: NextRequest) {
  try {
    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    const rawBody = await req.text();

    let body: Record<string, unknown> = {};
    if (contentType.includes('application/json')) {
      try {
        body = JSON.parse(rawBody || '{}') as Record<string, unknown>;
      } catch {
        body = {};
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      body = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
      try {
        body = JSON.parse(rawBody || '{}') as Record<string, unknown>;
      } catch {
        body = Object.fromEntries(new URLSearchParams(rawBody));
      }
    }

    const upstream = await fetch(`${MARKETPLACE_URL}/v1/wallet/providers/midtrans/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    console.error('[WALLET_MIDTRANS_NOTIFY_PROXY_ERROR]', error);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
