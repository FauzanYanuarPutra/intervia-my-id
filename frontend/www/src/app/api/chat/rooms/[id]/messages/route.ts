import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { evaluateTrustSafety } from '@/lib/trustSafety';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';
const MAX_MESSAGE_LENGTH = 4000;
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_URL_LENGTH = 2048;
const MAX_STRUCTURED_ATTACHMENT_LENGTH = 32 * 1024;

function safeDecodeRoomId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

function normalizeAttachment(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;

  const isStructuredPayload = value.startsWith('{') || value.startsWith('[');
  if (isStructuredPayload) {
    if (value.length > MAX_STRUCTURED_ATTACHMENT_LENGTH) return null;
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      return JSON.stringify(parsed);
    } catch {
      return null;
    }
  }

  if (value.length > MAX_ATTACHMENT_URL_LENGTH) return null;
  return value;
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
    const url = new URL(`/api/v1/rooms/${pathSegment}/messages`, CHAT_URL);
    url.search = new URL(req.url).search;

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.ctx.token}` },
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
      // Backend returns newest-first; urutkan oldest-first (terbaru di bawah)
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
    console.error('[CHAT_ROOM_MESSAGES_GET_ERROR]', error);
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
  let clientPayload: Record<string, unknown> | null = null;
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const ip = getClientIp(req);
    const ipRateLimit = await enforceRateLimit({
      key: `chat:message:ip:${ip}`,
      limit: 240,
      windowSeconds: 900,
    });
    if (!ipRateLimit.ok) return ipRateLimit.response;

    const userRateLimit = await enforceRateLimit({
      key: `chat:message:user:${auth.ctx.userId}`,
      limit: 180,
      windowSeconds: 900,
    });
    if (!userRateLimit.ok) return userRateLimit.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    clientPayload = body as Record<string, unknown>;

    const contentRaw =
      typeof clientPayload.content === 'string' ? clientPayload.content : '';
    const hasContent = contentRaw.trim().length > 0;

    const attachments = Array.isArray(clientPayload.attachments)
      ? clientPayload.attachments
          .map((item) => normalizeAttachment(item))
          .filter((item): item is string => Boolean(item))
          .slice(0, MAX_ATTACHMENTS)
      : [];

    const hasAttachments = attachments.length > 0;

    if (!hasContent && !hasAttachments) {
      return NextResponse.json(
        { error: 'content or attachments is required' },
        { status: 400 },
      );
    }
    if (contentRaw.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `content max length is ${MAX_MESSAGE_LENGTH}` },
        { status: 400 },
      );
    }

    const safety = evaluateTrustSafety(contentRaw, {
      maxLength: MAX_MESSAGE_LENGTH,
      allowExternalLinks: false,
      enforceOffPlatformPayment: true,
    });
    if (!safety.ok) {
      return NextResponse.json(
        {
          error: 'Message blocked by trust safety policy',
          violations: safety.violations.map((item) => item.code),
        },
        { status: 422 },
      );
    }

    const rawType =
      typeof clientPayload.type === 'string'
        ? clientPayload.type.trim().toLowerCase()
        : 'text';
    const messageType = /^[a-z0-9_-]{2,24}$/.test(rawType) ? rawType : 'text';

    const pathSegment = encodeURIComponent(roomId);
    const res = await fetch(`${CHAT_URL}/api/v1/rooms/${pathSegment}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.ctx.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: safety.sanitizedText,
        type: messageType,
        attachments,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      data?: {
        room_id?: string;
        sender_id?: string;
        content?: string;
        message_type?: string;
        attachments?: string[];
        sent_at?: string;
      };
    };
    if (res.ok && data.data) {
      const serverType = data.data.message_type ?? 'text';
      const clientType = messageType;
      const message_type = clientType !== 'text' ? clientType : serverType;
      const msg = {
        id: (data.data as { message_id?: string }).message_id ?? data.data.sent_at ?? `msg-${Date.now()}`,
        content: data.data.content ?? '',
        sender_id: data.data.sender_id ?? '',
        message_type,
        attachments: Array.isArray(data.data.attachments)
          ? data.data.attachments
          : attachments,
        created_at: data.data.sent_at ?? new Date().toISOString(),
      };
      const dataPayload = { ...data.data, message_type };
      return NextResponse.json({ message: msg, data: dataPayload }, { status: res.status });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[CHAT_ROOM_MESSAGES_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'Chat service unavailable' },
      { status: 503 },
    );
  }
}

