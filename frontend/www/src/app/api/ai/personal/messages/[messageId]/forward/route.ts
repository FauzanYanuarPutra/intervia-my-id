import { NextRequest, NextResponse } from 'next/server';
import { forwardPersonalAiMessage } from '@/lib/personal-ai/store';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value
        .replace(/\u0000/g, '')
        .trim()
        .slice(0, maxLength)
    : '';
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  const rate = await enforceRateLimit({
    key: `rl:ai:personal-forward:${auth.ctx.userId}:${getClientIp(req.headers)}`,
    limit: 40,
    windowSeconds: 60,
    message: 'Too many forwarded messages. Please retry shortly.',
  });
  if (!rate.ok) return rate.response;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const targetThreadId = cleanText(
    body.target_thread_id || body.targetThreadId,
    160,
  );
  if (!targetThreadId) {
    return NextResponse.json(
      { error: 'Target chat is required.' },
      { status: 400 },
    );
  }
  const { messageId } = await ctx.params;
  const result = await forwardPersonalAiMessage({
    userId: auth.ctx.userId,
    messageId,
    targetThreadId,
  });
  if (!result) {
    return NextResponse.json(
      { error: 'Message or target chat was not found.' },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: result }, { status: 201 });
}
