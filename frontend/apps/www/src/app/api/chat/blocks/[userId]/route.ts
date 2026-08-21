import { NextRequest, NextResponse } from 'next/server';
import { isChatUserId } from '@/lib/chatTrustSafety';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;
    const userId = (await context.params).userId.trim();
    const invalid = validateTarget(userId, auth.ctx.userId);
    if (invalid) return invalid;

    const limit = await enforceRateLimit({
      key: `chat:block:status:user:${auth.ctx.userId}`,
      limit: 120,
      windowSeconds: 900,
    });
    if (!limit.ok) return limit.response;

    const upstream = await fetch(
      `${CHAT_URL}/api/v1/blocks/${encodeURIComponent(userId)}`,
      {
        headers: { Authorization: `Bearer ${auth.ctx.token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!upstream.ok) return safeBlockError(upstream.status);

    const payload = (await upstream.json().catch(() => null)) as {
      data?: { blocked?: unknown };
    } | null;
    if (typeof payload?.data?.blocked !== 'boolean') return serviceUnavailable();

    return NextResponse.json({
      data: { blocked_user_id: userId, blocked: payload.data.blocked },
    });
  } catch {
    console.error('[CHAT_BLOCK_STATUS_ERROR] upstream request failed');
    return serviceUnavailable();
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;
    const userId = (await context.params).userId.trim();
    const invalid = validateTarget(userId, auth.ctx.userId);
    if (invalid) return invalid;

    const ipLimit = await enforceRateLimit({
      key: `chat:block:mutation:ip:${getClientIp(req)}`,
      limit: 50,
      windowSeconds: 900,
      message: 'Too many block actions. Please retry later.',
    });
    if (!ipLimit.ok) return ipLimit.response;

    const userLimit = await enforceRateLimit({
      key: `chat:block:mutation:user:${auth.ctx.userId}`,
      limit: 30,
      windowSeconds: 900,
      message: 'Too many block actions. Please retry later.',
    });
    if (!userLimit.ok) return userLimit.response;

    const upstream = await fetch(
      `${CHAT_URL}/api/v1/blocks/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.ctx.token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!upstream.ok) return safeBlockError(upstream.status);

    return NextResponse.json({
      data: { blocked_user_id: userId, blocked: false },
    });
  } catch {
    console.error('[CHAT_BLOCK_DELETE_ERROR] upstream request failed');
    return serviceUnavailable();
  }
}

function validateTarget(userId: string, currentUserId: string): NextResponse | null {
  if (!isChatUserId(userId)) {
    return NextResponse.json(
      { error: 'Invalid user id', code: 'invalid_user_id' },
      { status: 400 },
    );
  }
  if (userId.toLowerCase() === currentUserId.toLowerCase()) {
    return NextResponse.json(
      { error: 'Cannot block yourself', code: 'self_block_not_allowed' },
      { status: 400 },
    );
  }
  return null;
}

function safeBlockError(status: number): NextResponse {
  if (status === 400) {
    return NextResponse.json(
      { error: 'Invalid block request', code: 'invalid_request' },
      { status: 400 },
    );
  }
  if (status === 429) {
    return NextResponse.json(
      { error: 'Too many block actions', code: 'rate_limited' },
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
