import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;
    const { token, roles } = auth.ctx;

    if (!roles.includes('admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL('/users', API_URL);
    const searchParams = new URL(req.url).searchParams;

    // Forward query params (search, limit, offset, etc.)
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[USERS_API_ERROR]', error);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
