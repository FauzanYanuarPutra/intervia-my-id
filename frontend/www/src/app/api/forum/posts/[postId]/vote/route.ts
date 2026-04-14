import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import {
  addForumAuditLog,
  ensureForumUserForAuth,
  getForumStore,
  saveForumStore,
} from '@/lib/forum/store';
import { enrichPost, syncForumDerivedState, upsertVote } from '@/lib/forum/queries';

function parseVoteValue(input: unknown): -1 | 1 | null {
  if (input === -1 || input === '-1') return -1;
  if (input === 1 || input === '1') return 1;
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.res;
  }

  const { postId } = await params;
  const store = getForumStore();
  syncForumDerivedState(store);

  const post = store.posts.find(item => item.id === postId);
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const actor = ensureForumUserForAuth(store, auth.ctx);
  const body = await req.json().catch(() => null);
  const value = parseVoteValue(body?.value);

  if (!value) {
    return NextResponse.json({ error: 'Invalid vote value' }, { status: 400 });
  }

  if (post.authorId === actor.id) {
    return NextResponse.json({ error: 'Cannot vote your own post' }, { status: 400 });
  }

  const result = upsertVote(store, {
    targetType: 'post',
    targetId: post.id,
    userId: actor.id,
    value,
  });

  addForumAuditLog(store, {
    action: 'vote.post',
    actorUserId: actor.id,
    targetType: 'post',
    targetId: post.id,
    metadata: {
      previous: result.previous,
      next: result.next,
      threadId: post.threadId,
    },
  });

  syncForumDerivedState(store);
  await saveForumStore();

  return NextResponse.json({
    post: enrichPost(post, store.users, store.votes, actor.id),
    previousVote: result.previous,
    currentVote: result.next,
  });
}

