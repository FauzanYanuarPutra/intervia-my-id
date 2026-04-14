import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { evaluateTrustSafety } from '@/lib/trustSafety';
import {
  addForumAuditLog,
  buildForumUserIdFromAuth,
  createForumId,
  ensureForumUserForAuth,
  getForumStore,
  isForumModeratorRole,
  saveForumStore,
} from '@/lib/forum/store';
import {
  enrichPost,
  getVoteStats,
  paginate,
  sanitizeForumMarkdownInput,
  sanitizeImageUrls,
  syncForumDerivedState,
} from '@/lib/forum/queries';

function parsePositiveNumber(input: string | null, fallback: number): number {
  const parsed = Number(input || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

async function mapViewerForumUserId(req: NextRequest): Promise<string | null> {
  const auth = await requireAuth(req);
  if (!auth.ok) return null;
  return buildForumUserIdFromAuth(auth.ctx.userId);
}

function getReplyDepth(posts: { id: string; replyToPostId?: string | null }[], postId: string): number {
  const postMap = new Map(posts.map(post => [post.id, post]));
  let depth = 0;
  let cursor: string | null = postId;
  const visited = new Set<string>();

  while (cursor) {
    if (visited.has(cursor)) {
      return 99;
    }
    visited.add(cursor);

    const node = postMap.get(cursor);
    if (!node) {
      break;
    }

    depth += 1;
    cursor = node.replyToPostId || null;
  }

  return depth;
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

  const url = new URL(req.url);
  const sort = (url.searchParams.get('sort') || 'oldest').toLowerCase();
  const page = parsePositiveNumber(url.searchParams.get('page'), 1);
  const pageSize = parsePositiveNumber(url.searchParams.get('page_size'), 20);

  let posts = store.posts.filter(post => post.threadId === threadId);

  posts = posts.sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();

    if (sort === 'top') {
      const aScore = getVoteStats(store.votes, 'post', a.id).score;
      const bScore = getVoteStats(store.votes, 'post', b.id).score;
      if (aScore !== bScore) return bScore - aScore;
      return aTime - bTime;
    }

    return sort === 'newest' ? bTime - aTime : aTime - bTime;
  });

  const paged = paginate(posts, page, pageSize);
  const viewerForumUserId = await mapViewerForumUserId(req);

  return NextResponse.json({
    ...paged,
    data: paged.data.map(post =>
      enrichPost(post, store.users, store.votes, viewerForumUserId || undefined),
    ),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.res;
  }

  const ip = getClientIp(req);
  const ipRateLimit = await enforceRateLimit({
    key: `forum:post:create:ip:${ip}`,
    limit: 260,
    windowSeconds: 3600,
  });
  if (!ipRateLimit.ok) return ipRateLimit.response;

  const userRateLimit = await enforceRateLimit({
    key: `forum:post:create:user:${auth.ctx.userId}`,
    limit: 120,
    windowSeconds: 3600,
  });
  if (!userRateLimit.ok) return userRateLimit.response;

  const { threadId } = await params;
  const store = getForumStore();
  syncForumDerivedState(store);

  const thread = store.threads.find(item => item.id === threadId);
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }

  const actor = ensureForumUserForAuth(store, auth.ctx);
  const isModerator = isForumModeratorRole(auth.ctx.roles);

  if ((thread.isLocked || thread.status !== 'open') && !isModerator) {
    return NextResponse.json(
      { error: 'Thread is locked or closed' },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const content = sanitizeForumMarkdownInput(body?.content, 6000);
  const imageUrls = sanitizeImageUrls(body?.imageUrls, 6);

  if (!content) {
    return NextResponse.json(
      { error: 'content is required' },
      { status: 400 },
    );
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

  const replyToPostId =
    typeof body?.replyToPostId === 'string' ? body.replyToPostId : null;

  if (replyToPostId) {
    const parent = store.posts.find(post => post.id === replyToPostId);
    if (!parent || parent.threadId !== thread.id) {
      return NextResponse.json(
        { error: 'Invalid reply target' },
        { status: 400 },
      );
    }

    const currentDepth = getReplyDepth(store.posts, replyToPostId);
    if (currentDepth >= 6) {
      return NextResponse.json(
        { error: 'Reply depth exceeded' },
        { status: 400 },
      );
    }
  }

  const now = new Date().toISOString();
  const post = {
    id: createForumId('p'),
    threadId: thread.id,
    authorId: actor.id,
    content: safety.sanitizedText,
    createdAt: now,
    updatedAt: null,
    likeCount: 0,
    replyToPostId,
    isAnswer: false,
    reactions: {},
    imageUrls,
  };

  store.posts.push(post);
  thread.lastActivityAt = now;

  addForumAuditLog(store, {
    action: 'post.create',
    actorUserId: actor.id,
    targetType: 'post',
    targetId: post.id,
    metadata: {
      threadId: thread.id,
      replyToPostId: replyToPostId || null,
      hasImages: imageUrls.length > 0,
    },
  });

  syncForumDerivedState(store);
  await saveForumStore();

  return NextResponse.json({
    post: enrichPost(post, store.users, store.votes, actor.id),
  });
}

