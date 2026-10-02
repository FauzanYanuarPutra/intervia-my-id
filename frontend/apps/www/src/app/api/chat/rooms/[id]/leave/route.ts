import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const roomId = decodeURIComponent(id);
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;
    const res = await fetch(
      `${CHAT_URL}/api/v1/rooms/${encodeURIComponent(roomId)}/leave`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.ctx.token}` },
      },
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[CHAT_ROOM_LEAVE_ERROR]', error);
    return NextResponse.json({ error: 'Chat service unavailable' }, { status: 503 });
  }
}
