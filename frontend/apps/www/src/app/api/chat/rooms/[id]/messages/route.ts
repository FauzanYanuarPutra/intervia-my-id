import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { evaluateTrustSafety } from '@/lib/trustSafety';
import {
  normalizeChatAttachments,
  safeStoredChatAttachments,
  type ChatAttachmentPolicyOptions,
} from '@/lib/chatAttachments';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';
const MAX_MESSAGE_LENGTH = 4000;
const MAX_CLIENT_REF_LENGTH = 128;
const CLIENT_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function safeDecodeRoomId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

function attachmentPolicyOptions(req: NextRequest): ChatAttachmentPolicyOptions {
  const configuredOrigins = [
    req.nextUrl.origin,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_WWW_URL,
    ...(process.env.CHAT_MEDIA_ALLOWED_ORIGINS || '').split(','),
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean);

  return {
    appOrigins: configuredOrigins,
    minioPublicUrl: process.env.MINIO_PUBLIC_URL || null,
  };
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
      const attachmentOptions = attachmentPolicyOptions(req);
      // Backend returns newest-first; urutkan oldest-first (terbaru di bawah)
      const ordered = [...data.data].reverse();
      const messages = ordered.map((m) => {
        const messageType = m.message_type ?? 'text';
        return {
          id: m.message_id ?? m.sent_at ?? '',
          content: m.content ?? '',
          sender_id: m.sender_id ?? '',
          message_type: messageType,
          attachments: safeStoredChatAttachments(
            messageType,
            m.attachments,
            attachmentOptions,
          ),
          created_at: m.sent_at ?? '',
        };
      });
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

    const rawClientRef = clientPayload.client_ref;
    let clientRef: string;
    if (rawClientRef === undefined || rawClientRef === null) {
      // Compatibility for callers deployed before idempotent message sends.
      clientRef = randomUUID();
    } else if (typeof rawClientRef === 'string') {
      clientRef = rawClientRef.trim();
      if (
        !clientRef ||
        clientRef.length > MAX_CLIENT_REF_LENGTH ||
        !CLIENT_REF_PATTERN.test(clientRef)
      ) {
        return NextResponse.json(
          { error: 'client_ref must be 1-128 safe ASCII characters' },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { error: 'client_ref must be a string' },
        { status: 400 },
      );
    }

    const contentRaw =
      typeof clientPayload.content === 'string' ? clientPayload.content : '';
    const hasContent = contentRaw.trim().length > 0;

    const rawType =
      typeof clientPayload.type === 'string'
        ? clientPayload.type.trim().toLowerCase()
        : 'text';
    const messageType = /^[a-z0-9_-]{2,24}$/.test(rawType) ? rawType : 'text';

    const attachmentResult = normalizeChatAttachments(
      messageType,
      clientPayload.attachments,
      attachmentPolicyOptions(req),
    );
    if (!attachmentResult.ok) {
      return NextResponse.json(
        { error: 'Attachments are invalid or are not hosted by Lajukan' },
        { status: 400 },
      );
    }
    const attachments = attachmentResult.attachments;

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
        client_ref: clientRef,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      data?: {
        room_id?: string;
        message_id?: string;
        client_ref?: string;
        sender_id?: string;
        content?: string;
        message_type?: string;
        attachments?: string[];
        sent_at?: string;
        deduplicated?: boolean;
      };
    };
    if (res.ok && data.data) {
      const message_type = data.data.message_type ?? 'text';
      const responseAttachments = safeStoredChatAttachments(
        message_type,
        data.data.attachments ?? attachments,
        attachmentPolicyOptions(req),
      );
      const msg = {
        id: data.data.message_id ?? data.data.sent_at ?? `msg-${Date.now()}`,
        client_ref: data.data.client_ref ?? clientRef,
        content: data.data.content ?? '',
        sender_id: data.data.sender_id ?? '',
        message_type,
        attachments: responseAttachments,
        created_at: data.data.sent_at ?? new Date().toISOString(),
        deduplicated: data.data.deduplicated === true,
      };
      const dataPayload = {
        ...data.data,
        client_ref: data.data.client_ref ?? clientRef,
        message_type,
        attachments: responseAttachments,
      };
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

