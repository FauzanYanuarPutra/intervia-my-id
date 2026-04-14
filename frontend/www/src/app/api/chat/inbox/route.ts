import { NextRequest, NextResponse } from 'next/server';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

export async function GET(req: NextRequest) {
  try {
    const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    const cookieToken = req.cookies.get('access_token')?.value?.trim();
    const preferCookie = process.env.NODE_ENV === 'production';
    const token = preferCookie
      ? cookieToken || bearerToken
      : bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL('/api/v1/inbox', CHAT_URL);
    url.search = new URL(req.url).search;

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const data = (await res.json().catch(() => ({}))) as { data?: Array<Record<string, unknown>> };
    if (res.ok && Array.isArray(data.data)) {
      const rooms = data.data.map((r) => ({
        ...r,
        id: (r.room_id as string) ?? (r.id as string),
      }));
      return NextResponse.json({ data: rooms }, { status: res.status });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[CHAT_INBOX_PROXY_ERROR]', e);
    return NextResponse.json(
      { error: 'Chat service unavailable' },
      { status: 503 },
    );
  }
}

