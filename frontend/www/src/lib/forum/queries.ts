import { createForumId } from './store';
import type {
  ForumCategory,
  ForumPost,
  ForumStore,
  ForumTag,
  ForumThread,
  ForumUser,
  ForumVote,
} from './store';

type PageResult<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

type VoteStats = {
  score: number;
  upvotes: number;
  downvotes: number;
};

type SortMode = 'hot' | 'top' | 'new' | 'latest' | 'active' | 'trending';

type EnrichedThread = Omit<ForumThread, 'tags'> & {
  author: ForumUser | null;
  category: ForumCategory | null;
  tags: ForumTag[];
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  viewerVote: -1 | 0 | 1;
  hotScore: number;
};

type EnrichedPost = ForumPost & {
  author: ForumUser | null;
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  viewerVote: -1 | 0 | 1;
};

const MAX_TEXT_INPUT = 12000;
const URL_PROTOCOL_RE = /^https?:\/\//i;

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): PageResult<T> {
  const safePage = Math.max(1, Number.isFinite(page) ? page : 1);
  const safeSize = Math.min(Math.max(1, Number.isFinite(pageSize) ? pageSize : 10), 50);
  const start = (safePage - 1) * safeSize;
  const data = items.slice(start, start + safeSize);
  return {
    data,
    page: safePage,
    pageSize: safeSize,
    total: items.length,
    hasMore: start + safeSize < items.length,
  };
}

export function buildSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export function sanitizeForumTitle(input: unknown, max = 140): string {
  if (typeof input !== 'string') return '';
  const plain = input
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.slice(0, max);
}

export function sanitizeForumMarkdownInput(input: unknown, max = 4000): string {
  if (typeof input !== 'string') return '';
  let value = input.slice(0, Math.min(max, MAX_TEXT_INPUT));

  value = value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');

  value = value.replace(/<[^>]*>/g, '');

  value = value.replace(
    /(!?\[[^\]]*\]\()\s*javascript:[^)]*(\))/gi,
    (_, prefix: string, suffix: string) => `${prefix}#${suffix}`,
  );

  value = value.replace(/\n{3,}/g, '\n\n').trim();
  return value.slice(0, max);
}

export function sanitizeImageUrls(input: unknown, limit = 6): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .filter(item => URL_PROTOCOL_RE.test(item) || item.startsWith('/uploads/forum/'))
    .slice(0, limit);
}

export function normalizeTagSlugs(
  input: unknown,
  availableTags?: ForumTag[],
  limit = 6,
): string[] {
  if (!Array.isArray(input)) return [];

  const allowed = availableTags
    ? new Set(availableTags.map(tag => tag.slug.toLowerCase()))
    : null;

  const slugs = input
    .filter((item): item is string => typeof item === 'string')
    .map(item =>
      item
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-'),
    )
    .filter(Boolean)
    .filter(slug => !allowed || allowed.has(slug));

  return [...new Set(slugs)].slice(0, limit);
}

export function matchCategory(category: ForumCategory, value?: string): boolean {
  if (!value) return true;
  return category.id === value || category.slug === value;
}

export function matchTag(tag: ForumTag, value?: string): boolean {
  if (!value) return true;
  return tag.id === value || tag.slug === value || tag.name === value;
}

export function getVoteStats(
  votes: ForumVote[],
  targetType: 'thread' | 'post',
  targetId: string,
): VoteStats {
  let upvotes = 0;
  let downvotes = 0;

  for (const vote of votes) {
    if (vote.targetType !== targetType || vote.targetId !== targetId) continue;
    if (vote.value > 0) upvotes += 1;
    if (vote.value < 0) downvotes += 1;
  }

  return {
    upvotes,
    downvotes,
    score: upvotes - downvotes,
  };
}

export function getViewerVote(
  votes: ForumVote[],
  targetType: 'thread' | 'post',
  targetId: string,
  viewerUserId?: string,
): -1 | 0 | 1 {
  if (!viewerUserId) return 0;
  const found = votes.find(
    vote =>
      vote.targetType === targetType &&
      vote.targetId === targetId &&
      vote.userId === viewerUserId,
  );
  return found?.value || 0;
}

function calculateThreadHotScore(thread: ForumThread, score: number): number {
  const nowMs = Date.now();
  const createdMs = new Date(thread.createdAt).getTime();
  const lastActivityMs = new Date(thread.lastActivityAt).getTime();

  const ageHours = Math.max(1, (nowMs - createdMs) / 3600000);
  const recentHours = Math.max(1, (nowMs - lastActivityMs) / 3600000);

  const interactionPoints =
    score * 4 + thread.replyCount * 2 + Math.log10(thread.views + 1) * 3 + (thread.isSolved ? 2 : 0);

  const decay = Math.pow(ageHours, 0.8) + recentHours * 0.2;
  return Number((interactionPoints / decay).toFixed(6));
}

function threadScoreForSort(thread: ForumThread, votes: ForumVote[]): number {
  const voteStats = getVoteStats(votes, 'thread', thread.id);
  if (voteStats.upvotes === 0 && voteStats.downvotes === 0) {
    return thread.likeCount;
  }
  return voteStats.score;
}

export function sortThreads(
  threads: ForumThread[],
  sort: string,
  votes: ForumVote[] = [],
): ForumThread[] {
  const list = [...threads];
  const mode = (sort || 'hot').toLowerCase() as SortMode;

  switch (mode) {
    case 'top':
      return list.sort((a, b) => {
        const scoreDiff = threadScoreForSort(b, votes) - threadScoreForSort(a, votes);
        if (scoreDiff !== 0) return scoreDiff;
        return b.replyCount - a.replyCount;
      });
    case 'new':
    case 'latest':
      return list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      );
    case 'active':
      return list.sort(
        (a, b) =>
          new Date(b.lastActivityAt).getTime() -
          new Date(a.lastActivityAt).getTime(),
      );
    case 'trending':
    case 'hot':
    default:
      return list.sort(
        (a, b) =>
          calculateThreadHotScore(b, threadScoreForSort(b, votes)) -
          calculateThreadHotScore(a, threadScoreForSort(a, votes)),
      );
  }
}

export function enrichThread(
  thread: ForumThread,
  users: ForumUser[],
  categories: ForumCategory[],
  tags: ForumTag[],
  votes: ForumVote[] = [],
  viewerUserId?: string,
): EnrichedThread {
  const author = users.find(user => user.id === thread.authorId) || null;
  const category = categories.find(item => item.id === thread.categoryId) || null;
  const { tags: _threadTagSlugs, ...threadBase } = thread;
  const tagItems = tags.filter(tag => thread.tags.includes(tag.slug));
  const voteStats = getVoteStats(votes, 'thread', thread.id);
  const fallbackScore =
    voteStats.upvotes === 0 && voteStats.downvotes === 0 ? thread.likeCount : voteStats.score;

  return {
    ...threadBase,
    author,
    category,
    tags: tagItems,
    voteScore: fallbackScore,
    upvoteCount: voteStats.upvotes,
    downvoteCount: voteStats.downvotes,
    viewerVote: getViewerVote(votes, 'thread', thread.id, viewerUserId),
    hotScore: calculateThreadHotScore(thread, fallbackScore),
  };
}

export function enrichPost(
  post: ForumPost,
  users: ForumUser[],
  votes: ForumVote[] = [],
  viewerUserId?: string,
): EnrichedPost {
  const author = users.find(user => user.id === post.authorId) || null;
  const voteStats = getVoteStats(votes, 'post', post.id);
  const fallbackScore =
    voteStats.upvotes === 0 && voteStats.downvotes === 0 ? post.likeCount : voteStats.score;

  return {
    ...post,
    author,
    voteScore: fallbackScore,
    upvoteCount: voteStats.upvotes,
    downvoteCount: voteStats.downvotes,
    viewerVote: getViewerVote(votes, 'post', post.id, viewerUserId),
  };
}

export function upsertVote(
  store: ForumStore,
  input: {
    targetType: 'thread' | 'post';
    targetId: string;
    userId: string;
    value: -1 | 1;
  },
): {
  previous: -1 | 0 | 1;
  next: -1 | 0 | 1;
} {
  const existing = store.votes.find(
    vote =>
      vote.targetType === input.targetType &&
      vote.targetId === input.targetId &&
      vote.userId === input.userId,
  );

  if (!existing) {
    store.votes.push({
      id: createForumId('v'),
      targetType: input.targetType,
      targetId: input.targetId,
      userId: input.userId,
      value: input.value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { previous: 0, next: input.value };
  }

  const previous = existing.value;
  if (existing.value === input.value) {
    store.votes = store.votes.filter(vote => vote.id !== existing.id);
    return { previous, next: 0 };
  }

  existing.value = input.value;
  existing.updatedAt = new Date().toISOString();
  return { previous, next: input.value };
}

export function syncForumDerivedState(store: ForumStore): void {
  const postsByThread = new Map<string, ForumPost[]>();
  for (const post of store.posts) {
    if (!postsByThread.has(post.threadId)) {
      postsByThread.set(post.threadId, []);
    }
    postsByThread.get(post.threadId)?.push(post);
  }

  for (const thread of store.threads) {
    const threadPosts = postsByThread.get(thread.id) || [];
    thread.replyCount = Math.max(0, threadPosts.length - 1);

    let lastActivityAt = thread.createdAt;
    for (const post of threadPosts) {
      if (new Date(post.createdAt).getTime() > new Date(lastActivityAt).getTime()) {
        lastActivityAt = post.createdAt;
      }
    }
    thread.lastActivityAt = lastActivityAt;

    const solutionExists =
      typeof thread.solutionPostId === 'string' &&
      threadPosts.some(post => post.id === thread.solutionPostId);

    if (!solutionExists) {
      thread.solutionPostId = null;
    }
    thread.isSolved = Boolean(thread.solutionPostId);

    const voteStats = getVoteStats(store.votes, 'thread', thread.id);
    if (voteStats.upvotes > 0 || voteStats.downvotes > 0) {
      thread.likeCount = voteStats.upvotes;
    }
  }

  const threadIdSet = new Set(store.threads.map(thread => thread.id));
  store.posts = store.posts.filter(post => threadIdSet.has(post.threadId));

  const validPostIds = new Set(store.posts.map(post => post.id));

  for (const post of store.posts) {
    if (post.replyToPostId && !validPostIds.has(post.replyToPostId)) {
      post.replyToPostId = null;
    }

    const parentThread = store.threads.find(thread => thread.id === post.threadId);
    if (parentThread?.solutionPostId === post.id) {
      post.isAnswer = true;
    } else if (post.isAnswer) {
      post.isAnswer = false;
    }

    const voteStats = getVoteStats(store.votes, 'post', post.id);
    if (voteStats.upvotes > 0 || voteStats.downvotes > 0) {
      post.likeCount = voteStats.upvotes;
    }
  }

  for (const category of store.categories) {
    const categoryThreads = store.threads.filter(thread => thread.categoryId === category.id);
    category.threadCount = categoryThreads.length;
    const threadSet = new Set(categoryThreads.map(thread => thread.id));
    category.postCount = store.posts.filter(post => threadSet.has(post.threadId)).length;
  }

  const usageMap = new Map<string, number>();
  for (const thread of store.threads) {
    for (const slug of thread.tags) {
      usageMap.set(slug, (usageMap.get(slug) || 0) + 1);
    }
  }

  for (const tag of store.tags) {
    tag.usageCount = usageMap.get(tag.slug) || 0;
  }

  recalculateUserReputation(store);
}

function recalculateUserReputation(store: ForumStore): void {
  const baseMap = new Map<string, number>();

  for (const user of store.users) {
    baseMap.set(user.id, Number.isFinite(user.baseReputation) ? user.baseReputation : 0);
  }

  for (const thread of store.threads) {
    baseMap.set(thread.authorId, (baseMap.get(thread.authorId) || 0) + 4);
  }

  for (const post of store.posts) {
    baseMap.set(post.authorId, (baseMap.get(post.authorId) || 0) + 2);
    if (post.isAnswer) {
      baseMap.set(post.authorId, (baseMap.get(post.authorId) || 0) + 15);
    }
  }

  const threadAuthor = new Map(store.threads.map(thread => [thread.id, thread.authorId]));
  const postAuthor = new Map(store.posts.map(post => [post.id, post.authorId]));

  for (const vote of store.votes) {
    const targetAuthor =
      vote.targetType === 'thread' ? threadAuthor.get(vote.targetId) : postAuthor.get(vote.targetId);

    if (!targetAuthor || targetAuthor === vote.userId) continue;

    if (vote.targetType === 'thread') {
      baseMap.set(
        targetAuthor,
        (baseMap.get(targetAuthor) || 0) + (vote.value > 0 ? 2 : -1),
      );
    } else {
      baseMap.set(
        targetAuthor,
        (baseMap.get(targetAuthor) || 0) + (vote.value > 0 ? 5 : -2),
      );
    }
  }

  for (const user of store.users) {
    const value = Math.max(0, Math.round(baseMap.get(user.id) || 0));
    user.reputation = value;
  }
}

export function getTrendingTags(store: ForumStore, limit = 8): ForumTag[] {
  const scored = new Map<string, number>();

  for (const thread of store.threads) {
    const voteStats = getVoteStats(store.votes, 'thread', thread.id);
    const recencyHours = Math.max(
      1,
      (Date.now() - new Date(thread.lastActivityAt).getTime()) / 3600000,
    );
    const recencyWeight = 1 / Math.sqrt(recencyHours);
    const score =
      (1 + thread.replyCount * 0.8 + voteStats.score * 1.2 + Math.log10(thread.views + 1)) *
      recencyWeight;

    for (const slug of thread.tags) {
      scored.set(slug, (scored.get(slug) || 0) + score);
    }
  }

  return [...store.tags]
    .sort((a, b) => (scored.get(b.slug) || 0) - (scored.get(a.slug) || 0))
    .slice(0, limit);
}

export function getThreadAuthorId(store: ForumStore, threadId: string): string | null {
  const thread = store.threads.find(item => item.id === threadId);
  return thread?.authorId || null;
}

export function getPostAuthorId(store: ForumStore, postId: string): string | null {
  const post = store.posts.find(item => item.id === postId);
  return post?.authorId || null;
}

export type { EnrichedThread, EnrichedPost, VoteStats };

