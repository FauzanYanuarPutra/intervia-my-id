import { NextRequest, NextResponse } from 'next/server';
import { readAccessToken } from '@/lib/auth-session';

const IDENTITY_URL =
  process.env.INTERNAL_API_URL ||
  process.env.INTERNAL_IDENTITY_URL ||
  'http://identity_service:8080';

export async function GET(request: NextRequest) {
  const token = await readAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Sesi login sudah berakhir.' }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get('q') || '')
    .trim()
    .replace(/^@/, '');
  if (q.length < 2) {
    return NextResponse.json({ data: { items: [] } });
  }

  const upstream = await fetch(
    `${IDENTITY_URL}/users/discover?q=${encodeURIComponent(q)}&limit=6`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  const payload = await upstream.text();

  if (!upstream.ok) {
    return NextResponse.json(
      { error: 'Pencarian akun Lajukan belum tersedia.' },
      { status: upstream.status },
    );
  }

  return new NextResponse(payload, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
