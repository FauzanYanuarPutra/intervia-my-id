import { NextRequest, NextResponse } from 'next/server';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

function safeDecodeRoomId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

function isSafeRoomId(value: string): boolean {
  return Boolean(value) && value.length <= 180 && !/[\u0000-\u001F\u007F]/.test(value);
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const roomId = safeDecodeRoomId(id);
    const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    const cookieToken = req.cookies.get('access_token')?.value?.trim();
    const preferCookie = process.env.NODE_ENV === 'production';
    const token = preferCookie
      ? cookieToken || bearerToken
      : bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isSafeRoomId(roomId)) {
      return NextResponse.json({ error: 'Invalid room id' }, { status: 400 });
    }

    const pathSegment = encodeURIComponent(roomId);
    const url = new URL(`/api/v1/rooms/${pathSegment}/read`, CHAT_URL);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[CHAT_ROOM_READ_ERROR]', error);
    return NextResponse.json(
      { error: 'Chat service unavailable' },
      { status: 503 },
    );
  }
}
