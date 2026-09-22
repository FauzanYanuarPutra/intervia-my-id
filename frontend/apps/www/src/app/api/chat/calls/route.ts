import { NextRequest, NextResponse } from 'next/server';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

function tokenFromRequest(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\\s+/i, '').trim();
  const cookie = req.cookies.get('access_token')?.value?.trim();
  return process.env.NODE_ENV === 'production'
    ? cookie || bearer
    : bearer || cookie;
}

export async function GET(req: NextRequest) {
  const token = tokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const upstream = new URL('/api/v1/calls', CHAT_URL);
    const limit = new URL(req.url).searchParams.get('limit');
    if (limit) upstream.searchParams.set('limit', limit);

    const response = await fetch(upstream.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[CHAT_CALLS_PROXY_ERROR]', error);
    return NextResponse.json(
      { error: 'Call history unavailable' },
      { status: 503 },
    );
  }
}