import { NextRequest, NextResponse } from 'next/server';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '') || null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const roomId = typeof body?.room_id === 'string' ? body.room_id.trim() : '';
    if (!roomId) {
      return NextResponse.json({ error: 'room_id is required' }, { status: 400 });
    }

    const payload = {
      room_id: roomId,
      room_name: typeof body?.room_name === 'string' ? body.room_name : undefined,
      member_ids: Array.isArray(body?.member_ids) ? body.member_ids : undefined,
    };

    const res = await fetch(`${CHAT_URL}/api/v1/support/rooms`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[CRM_CHAT_SUPPORT_ROOM_ERROR]', error);
    return NextResponse.json({ error: 'Chat service unavailable' }, { status: 503 });
  }
}
