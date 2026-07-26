import { NextRequest, NextResponse } from 'next/server';
import { setPersonalAiMessageReaction } from '@/lib/personal-ai/store';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const ALLOWED_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '🙏']);

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  const rate = await enforceRateLimit({
    key: `rl:ai:personal-reaction:${auth.ctx.userId}:${getClientIp(req.headers)}`,
    limit: 120,
    windowSeconds: 60,
    message: 'Too many reactions. Please retry shortly.',
  });
  if (!rate.ok) return rate.response;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const reaction =
    typeof body.reaction === 'string' ? body.reaction.trim() : '';
  if (reaction && !ALLOWED_REACTIONS.has(reaction)) {
    return NextResponse.json(
      { error: 'Reaction is not supported.' },
      { status: 400 },
    );
  }
  const { messageId } = await ctx.params;
  const message = await setPersonalAiMessageReaction({
    userId: auth.ctx.userId,
    messageId,
    reaction,
  });
  if (!message) {
    return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
  }
  return NextResponse.json({ data: { message } });
}
