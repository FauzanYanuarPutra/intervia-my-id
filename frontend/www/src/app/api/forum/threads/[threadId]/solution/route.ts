import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import {
  addForumAuditLog,
  ensureForumUserForAuth,
  getForumStore,
  isForumModeratorRole,
  saveForumStore,
} from '@/lib/forum/store';
import { enrichPost, enrichThread, syncForumDerivedState } from '@/lib/forum/queries';

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
  const isModerator = isForumModeratorRole(auth.ctx.roles);
  const isOwner = thread.authorId === actor.id;

  if (!isOwner && !isModerator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const postId = typeof body?.postId === 'string' ? body.postId : null;

  if (postId) {
    const targetPost = store.posts.find(post => post.id === postId);
    if (!targetPost || targetPost.threadId !== thread.id) {
      return NextResponse.json(
        { error: 'Invalid solution post' },
        { status: 400 },
      );
    }

    thread.solutionPostId = targetPost.id;

    for (const post of store.posts) {
      if (post.threadId === thread.id) {
        post.isAnswer = post.id === targetPost.id;
      }
    }

    addForumAuditLog(store, {
      action: 'thread.mark_solution',
      actorUserId: actor.id,
      targetType: 'thread',
      targetId: thread.id,
      metadata: {
        postId: targetPost.id,
      },
    });
  } else {
    thread.solutionPostId = null;
    for (const post of store.posts) {
      if (post.threadId === thread.id) {
        post.isAnswer = false;
      }
    }

    addForumAuditLog(store, {
      action: 'thread.clear_solution',
      actorUserId: actor.id,
      targetType: 'thread',
      targetId: thread.id,
    });
  }

  syncForumDerivedState(store);
  await saveForumStore();

  const solutionPost =
    thread.solutionPostId
      ? store.posts.find(post => post.id === thread.solutionPostId) || null
      : null;

  return NextResponse.json({
    thread: enrichThread(thread, store.users, store.categories, store.tags, store.votes, actor.id),
    solutionPost: solutionPost
      ? enrichPost(solutionPost, store.users, store.votes, actor.id)
      : null,
  });
}

