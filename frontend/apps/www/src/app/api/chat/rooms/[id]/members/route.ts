import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

function safeDecodeRoomId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const roomId = safeDecodeRoomId(id);
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const pathSegment = encodeURIComponent(roomId);
    const url = new URL(`/api/v1/rooms/${pathSegment}/members`, CHAT_URL);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.ctx.token}` },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[CHAT_ROOM_MEMBERS_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Chat service unavailable' },
      { status: 503 },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const roomId = safeDecodeRoomId(id);
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const ip = getClientIp(req);
    const ipRateLimit = await enforceRateLimit({
      key: `chat:room-members:ip:${ip}`,
      limit: 120,
      windowSeconds: 900,
    });
    if (!ipRateLimit.ok) return ipRateLimit.response;

    const userRateLimit = await enforceRateLimit({
      key: `chat:room-members:user:${auth.ctx.userId}`,
      limit: 80,
      windowSeconds: 900,
    });
    if (!userRateLimit.ok) return userRateLimit.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const memberIds = Array.isArray(payload.member_ids)
      ? payload.member_ids.filter((value) => typeof value === 'string')
      : [];
    if (memberIds.length === 0) {
      return NextResponse.json(
        { error: 'member_ids is required' },
        { status: 400 },
      );
    }

    const pathSegment = encodeURIComponent(roomId);
    const res = await fetch(`${CHAT_URL}/api/v1/rooms/${pathSegment}/members`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.ctx.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ member_ids: memberIds }),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[CHAT_ROOM_MEMBERS_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'Chat service unavailable' },
      { status: 503 },
    );
  }
}
