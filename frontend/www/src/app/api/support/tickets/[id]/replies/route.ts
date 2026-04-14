import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { evaluateTrustSafety } from '@/lib/trustSafety';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const ip = getClientIp(req);
    const ipRateLimit = await enforceRateLimit({
      key: `support:reply:ip:${ip}`,
      limit: 100,
      windowSeconds: 3600,
    });
    if (!ipRateLimit.ok) return ipRateLimit.response;

    const userRateLimit = await enforceRateLimit({
      key: `support:reply:user:${auth.ctx.userId}`,
      limit: 90,
      windowSeconds: 3600,
    });
    if (!userRateLimit.ok) return userRateLimit.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const rawMessage =
      typeof payload.message === 'string' ? payload.message : '';

    const attachments = Array.isArray(payload.attachments)
      ? payload.attachments
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter((item) => item.length > 0 && item.length <= 2048)
          .slice(0, 8)
      : [];

    if (rawMessage.trim().length === 0 && attachments.length === 0) {
      return NextResponse.json(
        { error: 'message or attachments is required' },
        { status: 400 },
      );
    }

    const safety = evaluateTrustSafety(rawMessage, {
      maxLength: 5000,
      allowExternalLinks: false,
      enforceOffPlatformPayment: true,
    });
    if (!safety.ok) {
      return NextResponse.json(
        {
          error: 'Reply blocked by trust safety policy',
          violations: safety.violations.map((item) => item.code),
        },
        { status: 422 },
      );
    }

    const forwardPayload: Record<string, unknown> = {
      ...payload,
      message: safety.sanitizedText,
      attachments,
    };

    const res = await fetch(`${MARKETPLACE_URL}/v1/support/tickets/${id}/replies`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.ctx.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(forwardPayload),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[SUPPORT_TICKET_REPLY_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
