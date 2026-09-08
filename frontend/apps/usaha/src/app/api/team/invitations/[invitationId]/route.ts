import { NextResponse } from 'next/server';
import { readAccessToken } from '@/lib/auth-session';

const IDENTITY_URL =
  process.env.INTERNAL_API_URL ||
  process.env.INTERNAL_IDENTITY_URL ||
  'http://identity_service:8080';

export async function POST(
  request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  const token = await readAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Sesi login sudah berakhir.' }, { status: 401 });
  }

  const { invitationId } = await context.params;
  const body = (await request.json()) as { action?: 'accept' | 'reject' };
  const action = body.action;
  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: 'Aksi undangan tidak valid.' }, { status: 400 });
  }

  const upstream = await fetch(
    `${IDENTITY_URL}/organization-invitations/${encodeURIComponent(invitationId)}/${action}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  const payload = await upstream.text();

  return new NextResponse(payload, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
