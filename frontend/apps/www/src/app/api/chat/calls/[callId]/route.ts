import { NextRequest, NextResponse } from 'next/server';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

function tokenFromRequest(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const cookie = req.cookies.get('access_token')?.value?.trim();
  return process.env.NODE_ENV === 'production'
    ? cookie || bearer
    : bearer || cookie;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> },
) {
  const token = tokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { callId } = await params;
  if (!callId?.trim()) {
    return NextResponse.json({ error: 'call_id_required' }, { status: 400 });
  }

  try {
    const upstream = new URL(
      `/api/v1/calls/${encodeURIComponent(callId.trim())}`,
      CHAT_URL,
    );
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
    console.error('[CHAT_CALL_DETAIL_PROXY_ERROR]', error);
    return NextResponse.json(
      { error: 'Call detail unavailable' },
      { status: 503 },
    );
  }
}
