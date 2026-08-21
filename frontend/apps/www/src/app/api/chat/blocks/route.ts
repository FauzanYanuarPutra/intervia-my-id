import { NextRequest, NextResponse } from 'next/server';
import { isChatUserId } from '@/lib/chatTrustSafety';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const limited = await applyMutationLimits(req, auth.ctx.userId);
    if (limited) return limited;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const blockedUserId =
      typeof body?.blocked_user_id === 'string' ? body.blocked_user_id.trim() : '';

    if (!isChatUserId(blockedUserId)) {
      return NextResponse.json(
        { error: 'Invalid blocked_user_id', code: 'invalid_user_id' },
        { status: 400 },
      );
    }
    if (blockedUserId.toLowerCase() === auth.ctx.userId.toLowerCase()) {
      return NextResponse.json(
        { error: 'Cannot block yourself', code: 'self_block_not_allowed' },
        { status: 400 },
      );
    }

    const upstream = await fetch(`${CHAT_URL}/api/v1/blocks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.ctx.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ blocked_user_id: blockedUserId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    if (!upstream.ok) return safeBlockError(upstream.status);

    const payload = (await upstream.json().catch(() => null)) as {
      data?: { blocked_user_id?: unknown; blocked?: unknown };
    } | null;
    if (payload?.data?.blocked !== true) return serviceUnavailable();

    return NextResponse.json({
      data: { blocked_user_id: blockedUserId, blocked: true },
    });
  } catch {
    console.error('[CHAT_BLOCK_CREATE_ERROR] upstream request failed');
    return serviceUnavailable();
  }
}

async function applyMutationLimits(
  req: NextRequest,
  userId: string,
): Promise<NextResponse | null> {
  const ipLimit = await enforceRateLimit({
    key: `chat:block:mutation:ip:${getClientIp(req)}`,
    limit: 50,
    windowSeconds: 900,
    message: 'Too many block actions. Please retry later.',
  });
  if (!ipLimit.ok) return ipLimit.response;

  const userLimit = await enforceRateLimit({
    key: `chat:block:mutation:user:${userId}`,
    limit: 30,
    windowSeconds: 900,
    message: 'Too many block actions. Please retry later.',
  });
  return userLimit.ok ? null : userLimit.response;
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
