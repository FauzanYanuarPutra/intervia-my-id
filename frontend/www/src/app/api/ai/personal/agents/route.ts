import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import {
  createPersonalAiAgent,
  listPersonalAiAgents,
  personalAiLimits,
} from '@/lib/personal-ai/store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const shareId = req.nextUrl.searchParams.get('share_id') || undefined;
  const data = await listPersonalAiAgents(auth.ctx.userId, shareId);
  return NextResponse.json({
    data: {
      ...data,
      limits: personalAiLimits,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const ip = getClientIp(req.headers);
  const rate = await enforceRateLimit({
    key: `rl:ai:personal-agent:create:${auth.ctx.userId}:${ip}`,
    limit: 20,
    windowSeconds: 3600,
    message: 'Too many AI agent changes. Please retry later.',
  });
  if (!rate.ok) return rate.response;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const agent = await createPersonalAiAgent(auth.ctx.userId, body);
    return NextResponse.json({ data: { agent } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Gagal membuat AI pribadi.',
      },
      { status: 400 },
    );
  }
}
