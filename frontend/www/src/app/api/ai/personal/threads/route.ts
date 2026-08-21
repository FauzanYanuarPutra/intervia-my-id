import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import {
  createPersonalAiThread,
  getPersonalAiAgentForUse,
  listPersonalAiThreads,
  PersonalAiQuotaExceededError,
} from '@/lib/personal-ai/store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const agentId = req.nextUrl.searchParams.get('agent_id') || undefined;
  const threads = await listPersonalAiThreads(auth.ctx.userId, agentId);
  return NextResponse.json({ data: { threads } });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const agentId = typeof body.agent_id === 'string' ? body.agent_id.trim() : '';
  const shareId = typeof body.share_id === 'string' ? body.share_id.trim() : '';
  const agent = await getPersonalAiAgentForUse({
    userId: auth.ctx.userId,
    agentId: agentId || undefined,
    shareId: shareId || undefined,
  });
  if (!agent) {
    return NextResponse.json({ error: 'AI not found.' }, { status: 404 });
  }
  const title =
    typeof body.title === 'string' ? body.title.trim() : 'Chat baru';
  try {
    const thread = await createPersonalAiThread(
      auth.ctx.userId,
      agent.id,
      title,
    );
    return NextResponse.json({ data: { thread } }, { status: 201 });
  } catch (error) {
    if (error instanceof PersonalAiQuotaExceededError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          quota: { resource: error.resource, limit: error.limit },
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
