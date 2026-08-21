import { NextRequest, NextResponse } from 'next/server';

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
    const token = req.headers.get('authorization')?.replace('Bearer ', '') || null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pathSegment = encodeURIComponent(roomId);
    const url = new URL(`/api/v1/rooms/${pathSegment}/messages`, CHAT_URL);
    url.search = new URL(req.url).search;

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const data = (await res.json().catch(() => ({}))) as {
      data?: Array<{
        message_id?: string;
        sender_id?: string;
        content?: string;
        message_type?: string;
        attachments?: string[];
        sent_at?: string;
      }>;
      room_name?: string;
    };

    if (res.ok && Array.isArray(data.data)) {
      const ordered = [...data.data].reverse();
      const messages = ordered.map((m) => ({
        id: m.message_id ?? m.sent_at ?? '',
        content: m.content ?? '',
        sender_id: m.sender_id ?? '',
        message_type: m.message_type ?? 'text',
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
        created_at: m.sent_at ?? '',
      }));
      const roomName = (data as { room_name?: string }).room_name ?? roomId;
      return NextResponse.json({ messages, room_name: roomName }, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[CRM_CHAT_ROOM_MESSAGES_GET_ERROR]', error);
    return NextResponse.json({ error: 'Chat service unavailable' }, { status: 503 });
  }
}
