import { NextResponse } from 'next/server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.toString();
    const upstream = query
      ? `${MARKETPLACE_URL}/v1/lajukan/requests?${query}`
      : `${MARKETPLACE_URL}/v1/lajukan/requests`;

    const response = await fetch(upstream, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: (payload as { error?: string }).error || 'Failed to load Lajukan requests' },
        { status: response.status },
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error('[LAJUKAN_REQUESTS_ROUTE_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to load Lajukan requests' },
      { status: 500 },
    );
  }
}
