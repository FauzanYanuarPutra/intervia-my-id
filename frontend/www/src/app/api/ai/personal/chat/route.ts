import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { runPersonalAi } from '@/lib/personal-ai/runtime';
import {
  appendPersonalAiMessages,
  buildThreadTitle,
  createPersonalAiThread,
  getPersonalAiAgentForUse,
  getPersonalAiMemory,
  getPersonalAiThreadWithMessages,
  updatePersonalAiMemory,
} from '@/lib/personal-ai/store';

export const runtime = 'nodejs';

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, maxLength);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const ip = getClientIp(req.headers);
  const rate = await enforceRateLimit({
    key: `rl:ai:personal-chat:${auth.ctx.userId}:${ip}`,
    limit: 36,
    windowSeconds: 60,
    message: 'Too many AI chat requests. Please retry shortly.',
  });
  if (!rate.ok) return rate.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const message = cleanText(body.message, 3500);
  if (!message) {
    return NextResponse.json(
      { error: 'Kirim pesan dulu.' },
      { status: 400 },
    );
  }

  const locale = body.locale === 'en' ? 'en' : 'id';
  const agentId = cleanText(body.agent_id, 120);
  const shareId = cleanText(body.share_id, 120);
  const threadId = cleanText(body.thread_id, 120);

  const agent = await getPersonalAiAgentForUse({
    userId: auth.ctx.userId,
    agentId: agentId || undefined,
    shareId: shareId || undefined,
  });
  if (!agent) {
    return NextResponse.json({ error: 'AI not found.' }, { status: 404 });
  }

  let threadData = threadId
    ? await getPersonalAiThreadWithMessages(auth.ctx.userId, threadId)
    : null;
  if (threadData && threadData.thread.agent_id !== agent.id) {
    threadData = null;
  }

  const thread =
    threadData?.thread ||
    (await createPersonalAiThread(auth.ctx.userId, agent.id, buildThreadTitle(message)));
  const history = threadData?.messages || [];
  const memory = await getPersonalAiMemory(agent.id, auth.ctx.userId);
  const ai = await runPersonalAi({
    agent,
    memory,
    message,
    history,
    locale,
  });

  const saved = await appendPersonalAiMessages({
    userId: auth.ctx.userId,
    agentId: agent.id,
    threadId: thread.id,
    userContent: message,
    assistantContent: ai.response,
    metadata: {
      provider: ai.provider,
      model: ai.model,
      provider_errors: ai.provider_errors,
      shared_agent_owner_id: agent.owner_id !== auth.ctx.userId ? agent.owner_id : undefined,
    },
  });
  await updatePersonalAiMemory({
    agent,
    userId: auth.ctx.userId,
    userMessage: message,
    assistantMessage: ai.response,
  });

  return NextResponse.json({
    data: {
      thread,
      messages: [saved.userMessage, saved.assistantMessage],
      response: ai.response,
      provider: ai.provider,
      model: ai.model,
      provider_errors: ai.provider_errors,
    },
  });
}
