import { NextResponse } from 'next/server';
import { readAccessToken } from '@/lib/auth-session';

const IDENTITY_URL =
  process.env.INTERNAL_API_URL ||
  process.env.INTERNAL_IDENTITY_URL ||
  'http://identity_service:8080';

export async function GET() {
  const token = await readAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Sesi login sudah berakhir.' }, { status: 401 });
  }

  const upstream = await fetch(`${IDENTITY_URL}/organization-invitations`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  const payload = await upstream.text();

  return new NextResponse(payload, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
