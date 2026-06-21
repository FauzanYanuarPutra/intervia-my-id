import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import nodePath from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';
import { requireAuth, type AuthContext } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ reelId: string }>;
};

type ReelComment = {
  id: string;
  reelId: string;
  parentCommentId?: string | null;
  authorUserId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  body: string;
  replyCount?: number;
  createdAt: string;
};

type ReelCommentsResponse = {
  items: ReelComment[];
  nextCursor: number | null;
  hasMore: boolean;
};

type LocalCommentStore = Record<string, ReelComment[]>;

const LOCAL_STORE_PATH = nodePath.join(
  process.cwd(),
  '.tmp',
  'reel-comments.local.json',
);

function reelCommentsPath(reelId: string) {
  return `/v1/reels/${encodeURIComponent(reelId)}/comments`;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { reelId } = await context.params;
  const proxied = await proxyCommunityBackend(req, reelCommentsPath(reelId));
  if (proxied.status < 500) return proxied;
  return readLocalComments(req, reelId);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { reelId } = await context.params;
  const proxyReq = Object.assign(req.clone(), {
    nextUrl: req.nextUrl,
    cookies: req.cookies,
  });
  const proxied = await proxyCommunityBackend(
    proxyReq,
    reelCommentsPath(reelId),
    { method: 'POST' },
  );
  if (proxied.status < 500) return proxied;
  return createLocalComment(req, reelId);
}

async function readLocalComments(req: NextRequest, reelId: string) {
  try {
    const url = req.nextUrl;
    const cursor = Math.max(0, Number(url.searchParams.get('cursor') || '0') || 0);
    const limit = Math.min(
      20,
      Math.max(1, Number(url.searchParams.get('limit') || '20') || 20),
    );
    const store = await readLocalStore();
    const comments = flattenCommentsForUi(store[reelId] || []);
    const slice = comments.slice(cursor, cursor + limit + 1);
    const hasMore = slice.length > limit;
    if (hasMore) slice.pop();

    const body: ReelCommentsResponse = {
      items: slice,
      nextCursor: hasMore ? cursor + slice.length : null,
      hasMore,
    };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[REEL_COMMENTS_LOCAL_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 },
    );
  }
}

async function createLocalComment(req: NextRequest, reelId: string) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  try {
    const payload = (await req.json().catch(() => ({}))) as {
      body?: unknown;
      content?: unknown;
      message?: unknown;
      parentCommentId?: unknown;
      replyToPostId?: unknown;
    };
    const body =
      normalizeCommentBody(payload.body) ||
      normalizeCommentBody(payload.content) ||
      normalizeCommentBody(payload.message);
    if (!body) {
      return NextResponse.json(
        { error: 'Comment body is required' },
        { status: 400 },
      );
    }

    const parentCommentId =
      typeof payload.parentCommentId === 'string' &&
      payload.parentCommentId.trim()
        ? payload.parentCommentId.trim()
        : typeof payload.replyToPostId === 'string' &&
            payload.replyToPostId.trim()
          ? payload.replyToPostId.trim()
        : null;
    const comment = await appendLocalComment(reelId, auth.ctx, body, parentCommentId);

    return NextResponse.json(
      { comment },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    console.error('[REEL_COMMENTS_LOCAL_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 },
    );
  }
}

function normalizeCommentBody(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toAuthorName(auth: AuthContext) {
  const email = typeof auth.email === 'string' ? auth.email.trim() : '';
  if (email) return email.split('@')[0] || email;
  return `User ${auth.userId.slice(0, 8)}`;
}

async function appendLocalComment(
  reelId: string,
  authCtx: AuthContext,
  body: string,
  parentCommentId: string | null,
): Promise<ReelComment> {
  const store = await readLocalStore();
  const existing = store[reelId] || [];

  if (parentCommentId) {
    const parent = existing.find(comment => comment.id === parentCommentId);
    if (!parent) {
      throw new Error('Parent comment not found');
    }
    if (parent.parentCommentId) {
      throw new Error('Replies can only target top-level comments');
    }
  }

  const createdAt = new Date().toISOString();
  const comment: ReelComment = {
    id: `local-comment-${Date.now()}-${randomUUID().slice(0, 8)}`,
    reelId,
    parentCommentId,
    authorUserId: authCtx.userId,
    authorName: toAuthorName(authCtx),
    authorAvatarUrl: null,
    body,
    replyCount: 0,
    createdAt,
  };

  const nextExisting = existing.map(item =>
    item.id === parentCommentId
      ? { ...item, replyCount: (item.replyCount || 0) + 1 }
      : item,
  );
  nextExisting.push(comment);
  store[reelId] = nextExisting;
  await writeLocalStore(store);
  return comment;
}

function flattenCommentsForUi(comments: ReelComment[]): ReelComment[] {
  const roots: ReelComment[] = [];
  const repliesByParent = new Map<string, ReelComment[]>();

  comments.forEach(comment => {
    if (comment.parentCommentId) {
      const current = repliesByParent.get(comment.parentCommentId) ?? [];
      current.push(comment);
      repliesByParent.set(comment.parentCommentId, current);
    } else {
      roots.push(comment);
    }
  });

  roots.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const flattened: ReelComment[] = [];

  for (const root of roots) {
    flattened.push(root);
    const replies = repliesByParent.get(root.id) ?? [];
    replies.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    flattened.push(...replies);
  }

  return flattened;
}

async function readLocalStore(): Promise<LocalCommentStore> {
  try {
    const raw = await readFile(LOCAL_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as LocalCommentStore;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).map(([reelId, comments]) => [
        reelId,
        Array.isArray(comments)
          ? comments
              .filter((comment): comment is ReelComment => isReelComment(comment))
              .map(comment => ({
                ...comment,
                replyCount: comment.replyCount || 0,
              }))
          : [],
      ]),
    );
  } catch {
    return {};
  }
}

async function writeLocalStore(store: LocalCommentStore): Promise<void> {
  await mkdir(nodePath.dirname(LOCAL_STORE_PATH), { recursive: true });
  await writeFile(LOCAL_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function isReelComment(value: unknown): value is ReelComment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.reelId === 'string' &&
    typeof record.authorUserId === 'string' &&
    typeof record.authorName === 'string' &&
    typeof record.body === 'string' &&
    typeof record.createdAt === 'string'
  );
}
