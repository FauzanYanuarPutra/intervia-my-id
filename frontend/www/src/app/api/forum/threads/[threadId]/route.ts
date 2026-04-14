import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import {
  addForumAuditLog,
  buildForumUserIdFromAuth,
  ensureForumUserForAuth,
  getForumStore,
  isForumModeratorRole,
  saveForumStore,
} from '@/lib/forum/store';
import {
  enrichPost,
  enrichThread,
  matchCategory,
  normalizeTagSlugs,
  sanitizeForumMarkdownInput,
  sanitizeForumTitle,
  sanitizeImageUrls,
  syncForumDerivedState,
} from '@/lib/forum/queries';

async function mapViewerForumUserId(req: NextRequest): Promise<string | null> {
  const auth = await requireAuth(req);
  if (!auth.ok) return null;
  return buildForumUserIdFromAuth(auth.ctx.userId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const store = getForumStore();
  syncForumDerivedState(store);

  const thread = store.threads.find(item => item.id === threadId);
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }

  thread.views += 1;
  await saveForumStore();

  const viewerForumUserId = await mapViewerForumUserId(req);

  return NextResponse.json(
    enrichThread(
      thread,
      store.users,
      store.categories,
      store.tags,
      store.votes,
      viewerForumUserId || undefined,
    ),
  );
}

export async function PATCH(
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
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (body.title !== undefined) {
    const title = sanitizeForumTitle(body.title);
    if (!title) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    }
    thread.title = title;
  }

  if (body.category !== undefined) {
    if (typeof body.category !== 'string') {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const category = store.categories.find(item => matchCategory(item, body.category));
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 400 });
    }
    thread.categoryId = category.id;
  }

  if (body.tags !== undefined) {
    thread.tags = normalizeTagSlugs(body.tags, store.tags, 6);
  }

  if (body.imageUrls !== undefined) {
    thread.imageUrls = sanitizeImageUrls(body.imageUrls, 6);
  }

  if (body.status !== undefined) {
    if (!isModerator) {
      return NextResponse.json(
        { error: 'Only moderator can change status' },
        { status: 403 },
      );
    }

    if (body.status !== 'open' && body.status !== 'closed' && body.status !== 'archived') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    thread.status = body.status;
  }

  if (body.isLocked !== undefined) {
    if (!isModerator) {
      return NextResponse.json(
        { error: 'Only moderator can lock thread' },
        { status: 403 },
      );
    }
    thread.isLocked = Boolean(body.isLocked);
  }

  if (body.content !== undefined) {
    const content = sanitizeForumMarkdownInput(body.content, 6000);
    if (!content) {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }

    const rootPost = store.posts.find(
      post => post.threadId === thread.id && !post.replyToPostId,
    );
    if (rootPost) {
      rootPost.content = content;
      rootPost.updatedAt = now;
    }
  }

  thread.lastActivityAt = now;

  addForumAuditLog(store, {
    action: 'thread.update',
    actorUserId: actor.id,
    targetType: 'thread',
    targetId: thread.id,
  });

  syncForumDerivedState(store);
  await saveForumStore();

  const rootPost = store.posts.find(
    post => post.threadId === thread.id && !post.replyToPostId,
  );

  return NextResponse.json({
    thread: enrichThread(thread, store.users, store.categories, store.tags, store.votes, actor.id),
    rootPost: rootPost ? enrichPost(rootPost, store.users, store.votes, actor.id) : null,
  });
}

export async function DELETE(
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

  const postIds = new Set(
    store.posts.filter(post => post.threadId === thread.id).map(post => post.id),
  );

  store.threads = store.threads.filter(item => item.id !== thread.id);
  store.posts = store.posts.filter(post => !postIds.has(post.id));
  store.votes = store.votes.filter(vote => {
    if (vote.targetType === 'thread') {
      return vote.targetId !== thread.id;
    }
    return !postIds.has(vote.targetId);
  });

  addForumAuditLog(store, {
    action: 'thread.delete',
    actorUserId: actor.id,
    targetType: 'thread',
    targetId: thread.id,
  });

  syncForumDerivedState(store);
  await saveForumStore();

  return NextResponse.json({ ok: true });
}

