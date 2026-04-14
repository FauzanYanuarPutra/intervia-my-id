import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import {
  addForumAuditLog,
  ensureForumUserForAuth,
  getForumStore,
  saveForumStore,
} from '@/lib/forum/store';
import { enrichThread, syncForumDerivedState, upsertVote } from '@/lib/forum/queries';

function parseVoteValue(input: unknown): -1 | 1 | null {
  if (input === -1 || input === '-1') return -1;
  if (input === 1 || input === '1') return 1;
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.res;
  }

  const { threadId } = await params;
  const store = getForumStore();
  syncForumDerivedState(store);

  const thread = store.threads.find(item => item.id === threadId);
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }

  const actor = ensureForumUserForAuth(store, auth.ctx);
  const body = await req.json().catch(() => null);
  const value = parseVoteValue(body?.value);

  if (!value) {
    return NextResponse.json({ error: 'Invalid vote value' }, { status: 400 });
  }

  if (thread.authorId === actor.id) {
    return NextResponse.json({ error: 'Cannot vote your own thread' }, { status: 400 });
  }

  const result = upsertVote(store, {
    targetType: 'thread',
    targetId: thread.id,
    userId: actor.id,
    value,
  });

  addForumAuditLog(store, {
    action: 'vote.thread',
    actorUserId: actor.id,
    targetType: 'thread',
    targetId: thread.id,
    metadata: {
      previous: result.previous,
      next: result.next,
    },
  });

  syncForumDerivedState(store);
  await saveForumStore();

  return NextResponse.json({
    thread: enrichThread(thread, store.users, store.categories, store.tags, store.votes, actor.id),
    previousVote: result.previous,
    currentVote: result.next,
  });
}

