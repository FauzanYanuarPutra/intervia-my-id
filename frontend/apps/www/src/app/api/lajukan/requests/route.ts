import { NextRequest, NextResponse } from 'next/server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

function getForwardToken(request: NextRequest): string | null {
  const bearer = request.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    return bearer.slice('Bearer '.length).trim();
  }

  return request.cookies.get('access_token')?.value?.trim() || null;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.toString();
    const upstream = query
      ? `${MARKETPLACE_URL}/v1/lajukan/requests?${query}`
      : `${MARKETPLACE_URL}/v1/lajukan/requests`;

    const token = getForwardToken(request);
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(upstream, {
      cache: 'no-store',
      headers,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            (payload as { error?: string }).error ||
            'Failed to load Lajukan requests',
        },
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
