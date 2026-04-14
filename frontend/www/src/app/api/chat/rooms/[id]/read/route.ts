import { NextRequest, NextResponse } from 'next/server';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

function safeDecodeRoomId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const roomId = safeDecodeRoomId(id);
    const token =
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      req.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
