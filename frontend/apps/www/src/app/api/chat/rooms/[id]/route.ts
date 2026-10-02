import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

function safeDecodeRoomId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const roomId = safeDecodeRoomId(id);
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;
    const body = await req.json().catch(() => ({}));
    const roomName = typeof body?.room_name === 'string' ? body.room_name.trim() : '';
    if (!roomName) return NextResponse.json({ error: 'room_name is required' }, { status: 400 });

    const res = await fetch(
      `${CHAT_URL}/api/v1/rooms/${encodeURIComponent(roomId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ room_name: roomName }),
      },
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[CHAT_ROOM_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Chat service unavailable' }, { status: 503 });
  }
}
