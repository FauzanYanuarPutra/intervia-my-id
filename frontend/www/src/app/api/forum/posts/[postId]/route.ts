import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { evaluateTrustSafety } from '@/lib/trustSafety';
import {
  addForumAuditLog,
  ensureForumUserForAuth,
  getForumStore,
  isForumModeratorRole,
  saveForumStore,
} from '@/lib/forum/store';
import {
  enrichPost,
  sanitizeForumMarkdownInput,
  sanitizeImageUrls,
  syncForumDerivedState,
} from '@/lib/forum/queries';

function collectDescendants(
  posts: { id: string; replyToPostId?: string | null }[],
  rootId: string,
): Set<string> {
  const childrenMap = new Map<string, string[]>();

  for (const post of posts) {
    if (!post.replyToPostId) continue;
    if (!childrenMap.has(post.replyToPostId)) {
      childrenMap.set(post.replyToPostId, []);
    }
    childrenMap.get(post.replyToPostId)?.push(post.id);
  }

  const visited = new Set<string>();
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const children = childrenMap.get(current) || [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        queue.push(childId);
      }
    }
  }

  return visited;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.res;
  }

  const ip = getClientIp(req);
  const ipRateLimit = await enforceRateLimit({
    key: `forum:post:update:ip:${ip}`,
    limit: 280,
    windowSeconds: 3600,
  });
  if (!ipRateLimit.ok) return ipRateLimit.response;

  const userRateLimit = await enforceRateLimit({
    key: `forum:post:update:user:${auth.ctx.userId}`,
    limit: 120,
    windowSeconds: 3600,
  });
  if (!userRateLimit.ok) return userRateLimit.response;

  const { postId } = await params;
  const store = getForumStore();
  syncForumDerivedState(store);

  const post = store.posts.find(item => item.id === postId);
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const actor = ensureForumUserForAuth(store, auth.ctx);
  const isModerator = isForumModeratorRole(auth.ctx.roles);
  const isOwner = post.authorId === actor.id;

  if (!isOwner && !isModerator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (body.content !== undefined) {
    const content = sanitizeForumMarkdownInput(body.content, 6000);
    if (!content) {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }

    const safety = evaluateTrustSafety(content, {
      maxLength: 6200,
      allowExternalLinks: false,
      enforceOffPlatformPayment: true,
    });
    if (!safety.ok) {
      return NextResponse.json(
        {
          error: 'Post blocked by trust safety policy',
          violations: safety.violations.map((item) => item.code),
        },
        { status: 422 },
      );
    }

    post.content = safety.sanitizedText;
    post.updatedAt = new Date().toISOString();
  }

  if (body.imageUrls !== undefined) {
    post.imageUrls = sanitizeImageUrls(body.imageUrls, 6);
    post.updatedAt = new Date().toISOString();
  }

  addForumAuditLog(store, {
    action: 'post.update',
    actorUserId: actor.id,
    targetType: 'post',
    targetId: post.id,
    metadata: {
      threadId: post.threadId,
    },
  });

  syncForumDerivedState(store);
  await saveForumStore();

  return NextResponse.json({
    post: enrichPost(post, store.users, store.votes, actor.id),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.res;
  }

  const ip = getClientIp(req);
  const ipRateLimit = await enforceRateLimit({
    key: `forum:post:delete:ip:${ip}`,
    limit: 80,
    windowSeconds: 3600,
  });
  if (!ipRateLimit.ok) return ipRateLimit.response;

  const userRateLimit = await enforceRateLimit({
    key: `forum:post:delete:user:${auth.ctx.userId}`,
    limit: 40,
    windowSeconds: 3600,
  });
  if (!userRateLimit.ok) return userRateLimit.response;

  const { postId } = await params;
  const store = getForumStore();
  syncForumDerivedState(store);

  const post = store.posts.find(item => item.id === postId);
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const actor = ensureForumUserForAuth(store, auth.ctx);
  const isModerator = isForumModeratorRole(auth.ctx.roles);
  const isOwner = post.authorId === actor.id;

  if (!isOwner && !isModerator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!post.replyToPostId) {
    return NextResponse.json(
      { error: 'Use thread delete endpoint for root post' },
      { status: 400 },
    );
  }

  const deletingIds = collectDescendants(store.posts, post.id);

  const thread = store.threads.find(item => item.id === post.threadId);
  if (thread && thread.solutionPostId && deletingIds.has(thread.solutionPostId)) {
    thread.solutionPostId = null;
  }

  store.posts = store.posts.filter(item => !deletingIds.has(item.id));
  store.votes = store.votes.filter(
    vote => vote.targetType !== 'post' || !deletingIds.has(vote.targetId),
  );

  addForumAuditLog(store, {
    action: 'post.delete',
    actorUserId: actor.id,
    targetType: 'post',
    targetId: post.id,
    metadata: {
      threadId: post.threadId,
      deletedCount: deletingIds.size,
    },
  });

  syncForumDerivedState(store);
  await saveForumStore();

  return NextResponse.json({ ok: true, deletedCount: deletingIds.size });
}

