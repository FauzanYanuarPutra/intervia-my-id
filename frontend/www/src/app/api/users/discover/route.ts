import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';

export async function GET(req: NextRequest) {
  try {
    const token =
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      req.cookies.get('access_token')?.value;

    const url = new URL('/users/discover', API_URL);
    const searchParams = new URL(req.url).searchParams;
    const q = searchParams.get('q');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const location = searchParams.get('location');
    const intent = searchParams.get('intent');
    const type = searchParams.get('type');
    if (q != null) url.searchParams.set('q', q);
    if (limit != null) url.searchParams.set('limit', limit);
    if (offset != null) url.searchParams.set('offset', offset);
    if (location != null) url.searchParams.set('location', location);
    if (intent != null) url.searchParams.set('intent', intent);
    if (type != null) url.searchParams.set('type', type);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url.toString(), {
      headers,
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[USERS_DISCOVER_ERROR]', error);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
