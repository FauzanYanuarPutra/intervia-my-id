import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeChatReportInput,
  normalizeChatRoomId,
} from '@/lib/chatTrustSafety';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const ipLimit = await enforceRateLimit({
      key: `chat:report:ip:${getClientIp(req)}`,
      limit: 30,
      windowSeconds: 3600,
      message: 'Too many reports. Please retry later.',
    });
    if (!ipLimit.ok) return ipLimit.response;

    const userLimit = await enforceRateLimit({
      key: `chat:report:user:${auth.ctx.userId}`,
      limit: 10,
      windowSeconds: 3600,
      message: 'Too many reports. Please retry later.',
    });
    if (!userLimit.ok) return userLimit.response;

    const rawRoomId = (await context.params).id;
    const roomId = normalizeChatRoomId(safeDecode(rawRoomId));
    if (!roomId) {
      return NextResponse.json(
        { error: 'Invalid room id', code: 'invalid_room_id' },
        { status: 400 },
      );
    }

    const normalized = normalizeChatReportInput(await req.json().catch(() => null));
    if (!normalized.ok) {
      return NextResponse.json(
        { error: 'Invalid report', code: normalized.code },
        { status: 400 },
      );
    }

    const upstream = await fetch(
      `${CHAT_URL}/api/v1/rooms/${encodeURIComponent(roomId)}/reports`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(normalized.value),
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!upstream.ok) return safeReportError(upstream.status);
    const payload = (await upstream.json().catch(() => null)) as {
      data?: { report_id?: unknown; status?: unknown };
    } | null;
    const reportId = payload?.data?.report_id;
    if (typeof reportId !== 'string' || payload?.data?.status !== 'open') {
      return serviceUnavailable();
    }

    return NextResponse.json(
      { data: { report_id: reportId, status: 'open' } },
      { status: 201 },
    );
  } catch {
    console.error('[CHAT_REPORT_CREATE_ERROR] upstream request failed');
    return serviceUnavailable();
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function safeReportError(status: number): NextResponse {
  if (status === 400) {
    return NextResponse.json(
      { error: 'Invalid report', code: 'invalid_request' },
      { status: 400 },
    );
  }
  if (status === 404) {
    return NextResponse.json(
      { error: 'Room or message not found', code: 'report_target_not_found' },
      { status: 404 },
    );
  }
  if (status === 429) {
    return NextResponse.json(
      { error: 'Too many reports', code: 'rate_limited' },
      { status: 429 },
    );
  }
  return serviceUnavailable();
}

function serviceUnavailable(): NextResponse {
  return NextResponse.json(
    { error: 'Chat service unavailable', code: 'service_unavailable' },
    { status: 503 },
  );
}
