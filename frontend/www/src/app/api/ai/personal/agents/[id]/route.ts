import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import {
  deletePersonalAiAgent,
  getPersonalAiAgentForUse,
  updatePersonalAiAgent,
} from '@/lib/personal-ai/store';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function readId(ctx: RouteContext) {
  const params = await ctx.params;
  return params.id;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  const agent = await getPersonalAiAgentForUse({
    userId: auth.ctx.userId,
    agentId: await readId(ctx),
  });
  if (!agent) {
    return NextResponse.json({ error: 'AI not found.' }, { status: 404 });
  }
  return NextResponse.json({ data: { agent } });
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const ip = getClientIp(req.headers);
  const rate = await enforceRateLimit({
    key: `rl:ai:personal-agent:update:${auth.ctx.userId}:${ip}`,
    limit: 80,
    windowSeconds: 3600,
    message: 'Too many AI agent changes. Please retry later.',
  });
  if (!rate.ok) return rate.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const agent = await updatePersonalAiAgent(auth.ctx.userId, await readId(ctx), body);
  if (!agent) {
    return NextResponse.json({ error: 'AI not found or not editable.' }, { status: 404 });
  }
  return NextResponse.json({ data: { agent } });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  const ok = await deletePersonalAiAgent(auth.ctx.userId, await readId(ctx));
  if (!ok) {
    return NextResponse.json(
      { error: 'AI not found or cannot delete your last AI.' },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
