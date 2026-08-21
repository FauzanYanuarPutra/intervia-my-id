import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import {
  deletePersonalAiThread,
  getPersonalAiThreadWithMessages,
  renamePersonalAiThread,
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
  const data = await getPersonalAiThreadWithMessages(auth.ctx.userId, await readId(ctx));
  if (!data) {
    return NextResponse.json({ error: 'Chat tab not found.' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title : '';
  const thread = await renamePersonalAiThread(auth.ctx.userId, await readId(ctx), title);
  if (!thread) {
    return NextResponse.json({ error: 'Chat tab not found.' }, { status: 404 });
  }
  return NextResponse.json({ data: { thread } });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  await deletePersonalAiThread(auth.ctx.userId, await readId(ctx));
  return NextResponse.json({ ok: true });
}
