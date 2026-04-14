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
  saveForumStore,
} from '@/lib/forum/store';
import {
  buildSlug,
  enrichPost,
  enrichThread,
  matchCategory,
  matchTag,
  normalizeTagSlugs,
  paginate,
  sanitizeForumMarkdownInput,
  sanitizeForumTitle,
  sanitizeImageUrls,
  sortThreads,
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

export async function GET(req: NextRequest) {
  const store = getForumStore();
  syncForumDerivedState(store);

  const url = new URL(req.url);
  const categoryParam = (url.searchParams.get('category') || '').trim();
  const tagParam = (url.searchParams.get('tag') || '').trim();
  const sort = (url.searchParams.get('sort') || 'hot').toLowerCase();
  const status = (url.searchParams.get('status') || '').trim();
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const page = parsePositiveNumber(url.searchParams.get('page'), 1);
  const pageSize = parsePositiveNumber(url.searchParams.get('page_size'), 12);

  const category = categoryParam
    ? store.categories.find(item => matchCategory(item, categoryParam))
    : null;

  const tag = tagParam
    ? store.tags.find(item => matchTag(item, tagParam))
    : null;

  const threadRootPost = new Map<string, string>();
  for (const post of store.posts) {
    if (post.replyToPostId) continue;
    if (!threadRootPost.has(post.threadId)) {
      threadRootPost.set(post.threadId, post.content.toLowerCase());
    }
  }

  let threads = store.threads.filter(thread => {
    const matchesCategory = category ? thread.categoryId === category.id : true;
    const matchesTag = tag ? thread.tags.includes(tag.slug) : true;
    const matchesStatus = status
      ? thread.status === status
      : true;

    if (!matchesCategory || !matchesTag || !matchesStatus) {
      return false;
    }

    if (!q) {
      return true;
    }

    const author = store.users.find(user => user.id === thread.authorId);
    const categoryName = store.categories.find(item => item.id === thread.categoryId)?.name || '';
    const tagNames = thread.tags.join(' ');
    const rootContent = threadRootPost.get(thread.id) || '';

    const haystack = [
      thread.title,
      author?.name || '',
      categoryName,
      tagNames,
      rootContent,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });

  threads = sortThreads(threads, sort, store.votes);

  const paged = paginate(threads, page, pageSize);
  const viewerForumUserId = await mapViewerForumUserId(req);

  const data = paged.data.map(thread =>
    enrichThread(
      thread,
      store.users,
      store.categories,
      store.tags,
      store.votes,
      viewerForumUserId || undefined,
    ),
  );

  return NextResponse.json({
    ...paged,
    data,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.res;
  }

  const ip = getClientIp(req);
  const ipRateLimit = await enforceRateLimit({
    key: `forum:thread:create:ip:${ip}`,
    limit: 80,
    windowSeconds: 3600,
  });
  if (!ipRateLimit.ok) return ipRateLimit.response;

  const userRateLimit = await enforceRateLimit({
    key: `forum:thread:create:user:${auth.ctx.userId}`,
    limit: 24,
    windowSeconds: 3600,
  });
  if (!userRateLimit.ok) return userRateLimit.response;

  const store = getForumStore();
  const body = await req.json().catch(() => null);

  const title = sanitizeForumTitle(body?.title);
  const content = sanitizeForumMarkdownInput(body?.content, 6000);
  const imageUrls = sanitizeImageUrls(body?.imageUrls, 6);

  if (!title || !content) {
    return NextResponse.json(
      { error: 'title and content are required' },
      { status: 400 },
    );
  }

  const titleSafety = evaluateTrustSafety(title, {
    maxLength: 140,
    allowExternalLinks: false,
    enforceOffPlatformPayment: true,
  });
  if (!titleSafety.ok) {
    return NextResponse.json(
      {
        error: 'Thread blocked by trust safety policy',
        violations: titleSafety.violations.map((item) => item.code),
      },
      { status: 422 },
    );
  }

  const contentSafety = evaluateTrustSafety(content, {
    maxLength: 6200,
    allowExternalLinks: false,
    enforceOffPlatformPayment: true,
  });
  if (!contentSafety.ok) {
    return NextResponse.json(
      {
        error: 'Thread blocked by trust safety policy',
        violations: contentSafety.violations.map((item) => item.code),
      },
      { status: 422 },
    );
  }

  const categoryInput = typeof body?.category === 'string' ? body.category : '';
  const category = store.categories.find(item => matchCategory(item, categoryInput));

  if (!category) {
    return NextResponse.json(
      { error: 'Invalid category' },
      { status: 400 },
    );
  }

  const tagSlugs = normalizeTagSlugs(body?.tags, store.tags, 6);
  const actor = ensureForumUserForAuth(store, auth.ctx);

  const now = new Date().toISOString();
  const threadId = createForumId('th');
  const postId = createForumId('p');

  const thread = {
    id: threadId,
    title: titleSafety.sanitizedText,
    slug: buildSlug(titleSafety.sanitizedText),
    categoryId: category.id,
    authorId: actor.id,
    createdAt: now,
    lastActivityAt: now,
    views: 0,
    replyCount: 0,
    likeCount: 0,
    bookmarkCount: 0,
    isPinned: false,
    isLocked: false,
    isSolved: false,
    solutionPostId: null,
    status: 'open' as const,
    tags: tagSlugs,
    imageUrls,
  };

  const post = {
    id: postId,
    threadId,
    authorId: actor.id,
    content: contentSafety.sanitizedText,
    createdAt: now,
    updatedAt: null,
    likeCount: 0,
    replyToPostId: null,
    isAnswer: false,
    reactions: {},
    imageUrls,
  };

  store.threads.push(thread);
  store.posts.push(post);

  addForumAuditLog(store, {
    action: 'thread.create',
    actorUserId: actor.id,
    targetType: 'thread',
    targetId: thread.id,
    metadata: {
      categoryId: category.id,
      tagCount: tagSlugs.length,
      hasImages: imageUrls.length > 0,
    },
  });

  syncForumDerivedState(store);
  await saveForumStore();

  return NextResponse.json({
    thread: enrichThread(
      thread,
      store.users,
      store.categories,
      store.tags,
      store.votes,
      actor.id,
    ),
    post: enrichPost(post, store.users, store.votes, actor.id),
  });
}

