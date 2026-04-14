import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { localAvatarForSeed } from '@/lib/media/localSeedMedia';
import type { AuthContext } from '@/lib/serverAuth';

type ForumUser = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string;
  title: string;
  reputation: number;
  baseReputation: number;
  badges: string[];
  createdAt: string;
  updatedAt: string;
};

type ForumCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  parentId?: string | null;
  order: number;
  threadCount: number;
  postCount: number;
};

type ForumTag = {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  usageCount: number;
};

type ForumThread = {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  authorId: string;
  createdAt: string;
  lastActivityAt: string;
  views: number;
  replyCount: number;
  likeCount: number;
  bookmarkCount: number;
  isPinned: boolean;
  isLocked: boolean;
  isSolved: boolean;
  solutionPostId?: string | null;
  status: 'open' | 'closed' | 'archived';
  tags: string[];
  imageUrls?: string[];
};

type ForumPost = {
  id: string;
  threadId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  likeCount: number;
  replyToPostId?: string | null;
  isAnswer: boolean;
  reactions: Record<string, number>;
  imageUrls?: string[];
};

type ForumVote = {
  id: string;
  targetType: 'thread' | 'post';
  targetId: string;
  userId: string;
  value: -1 | 1;
  createdAt: string;
  updatedAt: string;
};

type ForumAuditLog = {
  id: string;
  action:
    | 'thread.create'
    | 'thread.update'
    | 'thread.delete'
    | 'post.create'
    | 'post.update'
    | 'post.delete'
    | 'vote.thread'
    | 'vote.post'
    | 'thread.mark_solution'
    | 'thread.clear_solution';
  actorUserId: string;
  targetType: 'thread' | 'post' | 'forum';
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type ForumStore = {
  users: ForumUser[];
  categories: ForumCategory[];
  tags: ForumTag[];
  threads: ForumThread[];
  posts: ForumPost[];
  votes: ForumVote[];
  auditLogs: ForumAuditLog[];
};

const nowIso = () => new Date().toISOString();

const seedStore = (): ForumStore => ({
  users: [
    {
      id: 'u-1',
      username: 'arif',
      name: 'Arif Rahman',
      avatarUrl: localAvatarForSeed('forum-u-1'),
      title: 'UMKM Supply Builder',
      reputation: 1240,
      baseReputation: 1240,
      badges: ['founder', 'mentor'],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: 'u-2',
      username: 'siska',
      name: 'Siska Putri',
      avatarUrl: localAvatarForSeed('forum-u-2'),
      title: 'Marketplace Designer',
      reputation: 980,
      baseReputation: 980,
      badges: ['designer', 'top-contributor'],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: 'u-3',
      username: 'fajar',
      name: 'Fajar Surya',
      avatarUrl: localAvatarForSeed('forum-u-3'),
      title: 'Growth Strategist UMKM',
      reputation: 1430,
      baseReputation: 1430,
      badges: ['growth', 'analytics'],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: 'u-4',
      username: 'dina',
      name: 'Dina Halim',
      avatarUrl: localAvatarForSeed('forum-u-4'),
      title: 'Marketplace Ops UMKM',
      reputation: 820,
      baseReputation: 820,
      badges: ['ops', 'community'],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ],
  categories: [
    {
      id: 'c-1',
      name: 'Announcements',
      slug: 'announcements',
      description: 'Update platform, fitur baru, dan roadmap.',
      icon: 'megaphone',
      color: '#10b981',
      parentId: null,
      order: 1,
      threadCount: 12,
      postCount: 64,
    },
    {
      id: 'c-2',
      name: 'Product & Sourcing',
      slug: 'product-ux',
      description: 'Diskusi sourcing flow, trust, dan UX untuk UMKM.',
      icon: 'sparkles',
      color: '#6366f1',
      parentId: null,
      order: 2,
      threadCount: 28,
      postCount: 156,
    },
    {
      id: 'c-3',
      name: 'Supply & Operasional',
      slug: 'marketplace-projects',
      description: 'Supplier, alat, jasa operasional, dan pricing paket.',
      icon: 'puzzle',
      color: '#f59e0b',
      parentId: null,
      order: 3,
      threadCount: 33,
      postCount: 204,
    },
    {
      id: 'c-4',
      name: 'Community & Events',
      slug: 'community-events',
      description: 'Kolaborasi, acara, dan inisiatif komunitas.',
      icon: 'community',
      color: '#ef4444',
      parentId: null,
      order: 4,
      threadCount: 21,
      postCount: 98,
    },
    {
      id: 'c-5',
      name: 'Support & Help',
      slug: 'support-help',
      description: 'Bantuan teknis, bug report, dan solusi.',
      icon: 'wrench',
      color: '#0ea5e9',
      parentId: null,
      order: 5,
      threadCount: 45,
      postCount: 242,
    },
  ],
  tags: [
    {
      id: 't-1',
      name: 'Sourcing',
      slug: 'ui-ux',
      description: 'Supplier, distributor, dan alur supply UMKM.',
      color: '#6366f1',
      usageCount: 34,
    },
    {
      id: 't-2',
      name: 'Growth',
      slug: 'growth',
      description: 'Akuisisi, activation, dan retention.',
      color: '#10b981',
      usageCount: 28,
    },
    {
      id: 't-3',
      name: 'Operasional',
      slug: 'marketplace',
      description: 'Jasa, packaging, admin, dan trust & safety.',
      color: '#f59e0b',
      usageCount: 31,
    },
    {
      id: 't-4',
      name: 'Bug',
      slug: 'bug',
      description: 'Issue teknis dan perbaikan.',
      color: '#ef4444',
      usageCount: 19,
    },
    {
      id: 't-5',
      name: 'Onboarding',
      slug: 'onboarding',
      description: 'Flow registrasi dan aktivasi.',
      color: '#0ea5e9',
      usageCount: 22,
    },
  ],
  threads: [
    {
      id: 'th-1',
      title: 'Roadmap Q2: sourcing, trust score, dan supplier matching',
      slug: 'roadmap-q2-sourcing-trust-score-supplier-matching',
      categoryId: 'c-1',
      authorId: 'u-1',
      createdAt: nowIso(),
      lastActivityAt: nowIso(),
      views: 1480,
      replyCount: 24,
      likeCount: 120,
      bookmarkCount: 48,
      isPinned: true,
      isLocked: false,
      isSolved: false,
      solutionPostId: null,
      status: 'open',
      tags: ['growth', 'marketplace'],
    },
    {
      id: 'th-2',
      title: 'Improvement ideas: quick actions untuk kebutuhan UMKM',
      slug: 'improvement-ideas-quick-actions-umkm-home',
      categoryId: 'c-2',
      authorId: 'u-2',
      createdAt: nowIso(),
      lastActivityAt: nowIso(),
      views: 560,
      replyCount: 14,
      likeCount: 56,
      bookmarkCount: 22,
      isPinned: false,
      isLocked: false,
      isSolved: true,
      solutionPostId: 'p-3',
      status: 'open',
      tags: ['ui-ux', 'onboarding'],
    },
    {
      id: 'th-3',
      title: 'Pricing tiers untuk admin marketplace, konten, dan supplier',
      slug: 'pricing-tiers-admin-marketplace-konten-supplier',
      categoryId: 'c-3',
      authorId: 'u-3',
      createdAt: nowIso(),
      lastActivityAt: nowIso(),
      views: 920,
      replyCount: 32,
      likeCount: 84,
      bookmarkCount: 40,
      isPinned: false,
      isLocked: false,
      isSolved: false,
      solutionPostId: null,
      status: 'open',
      tags: ['marketplace', 'growth'],
    },
    {
      id: 'th-4',
      title: 'Bug: OTP phone tidak diterima di dev',
      slug: 'bug-otp-phone-tidak-diterima-di-dev',
      categoryId: 'c-5',
      authorId: 'u-4',
      createdAt: nowIso(),
      lastActivityAt: nowIso(),
      views: 310,
      replyCount: 6,
      likeCount: 18,
      bookmarkCount: 6,
      isPinned: false,
      isLocked: false,
      isSolved: true,
      solutionPostId: 'p-5',
      status: 'open',
      tags: ['bug', 'onboarding'],
    },
  ],
  posts: [
    {
      id: 'p-1',
      threadId: 'th-1',
      authorId: 'u-1',
      content:
        'Kita fokus Q2 untuk **supplier matching**, trust score, dan sourcing flow yang lebih rapih. Masukan kalian?',
      createdAt: nowIso(),
      updatedAt: null,
      likeCount: 32,
      replyToPostId: null,
      isAnswer: false,
      reactions: { like: 20, love: 8, wow: 4 },
    },
    {
      id: 'p-2',
      threadId: 'th-1',
      authorId: 'u-3',
      content:
        'Tambahkan quick win: template brief UMKM, badge supplier verified, dan SLA untuk vendor.',
      createdAt: nowIso(),
      updatedAt: null,
      likeCount: 14,
      replyToPostId: 'p-1',
      isAnswer: false,
      reactions: { like: 10, insight: 4 },
    },
    {
      id: 'p-3',
      threadId: 'th-2',
      authorId: 'u-2',
      content:
        'Quick actions di home bikin funnel lebih cepat. Sarankan 5 tombol: cari supplier, lokasi jualan, sewa alat, paket jasa, dan freelancer.',
      createdAt: nowIso(),
      updatedAt: null,
      likeCount: 18,
      replyToPostId: null,
      isAnswer: true,
      reactions: { like: 12, love: 4, wow: 2 },
    },
    {
      id: 'p-4',
      threadId: 'th-3',
      authorId: 'u-3',
      content:
        'Tier vendor bisa berdasarkan SLA, repeat order, review rate, dan volume transaksi. Kita perlu indikator trust.',
      createdAt: nowIso(),
      updatedAt: null,
      likeCount: 20,
      replyToPostId: null,
      isAnswer: false,
      reactions: { like: 15, idea: 5 },
    },
    {
      id: 'p-5',
      threadId: 'th-4',
      authorId: 'u-4',
      content:
        'Di dev, OTP SMS dicetak ke server log. Tambahkan echo response agar mudah debug.',
      createdAt: nowIso(),
      updatedAt: null,
      likeCount: 6,
      replyToPostId: null,
      isAnswer: true,
      reactions: { like: 6 },
    },
  ],
  votes: [],
  auditLogs: [],
});

const storeKey = '__forum_store__';
const persistQueueKey = '__forum_store_persist_queue__';
const FORUM_STORE_PATH =
  process.env.FORUM_STORE_FILE ||
  path.join(process.cwd(), 'docker-data', 'forum', 'store.json');

function cleanText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w.-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function toSafeString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const next = value.trim();
  return next || fallback;
}

function toSafeNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeForumUser(input: Partial<ForumUser>, index: number): ForumUser {
  const createdAt = toSafeString(input.createdAt, nowIso());
  const updatedAt = toSafeString(input.updatedAt, createdAt);
  const reputation = toSafeNumber(input.reputation, 0);
  const baseReputation = toSafeNumber(input.baseReputation, reputation);
  const usernameRaw = toSafeString(input.username, `member_${index + 1}`);
  const username = cleanText(usernameRaw) || `member_${index + 1}`;

  return {
    id: toSafeString(input.id, `u-${index + 1}`),
    username,
    name: toSafeString(input.name, username),
    avatarUrl: toSafeString(
      input.avatarUrl,
      localAvatarForSeed(username),
    ),
    title: toSafeString(input.title, 'Community Member'),
    reputation,
    baseReputation,
    badges: toStringArray(input.badges),
    createdAt,
    updatedAt,
  };
}

function normalizeForumCategory(
  input: Partial<ForumCategory>,
  index: number,
): ForumCategory {
  return {
    id: toSafeString(input.id, `c-${index + 1}`),
    name: toSafeString(input.name, `Category ${index + 1}`),
    slug: cleanText(toSafeString(input.slug, `category-${index + 1}`)),
    description: toSafeString(input.description, ''),
    icon: toSafeString(input.icon, 'forum'),
    color: toSafeString(input.color, '#0ea5e9'),
    parentId:
      typeof input.parentId === 'string' || input.parentId === null
        ? input.parentId
        : null,
    order: toSafeNumber(input.order, index + 1),
    threadCount: toSafeNumber(input.threadCount, 0),
    postCount: toSafeNumber(input.postCount, 0),
  };
}

function normalizeForumTag(input: Partial<ForumTag>, index: number): ForumTag {
  return {
    id: toSafeString(input.id, `t-${index + 1}`),
    name: toSafeString(input.name, `Tag ${index + 1}`),
    slug: cleanText(toSafeString(input.slug, `tag-${index + 1}`)),
    description: toSafeString(input.description, ''),
    color: toSafeString(input.color, '#64748b'),
    usageCount: toSafeNumber(input.usageCount, 0),
  };
}

function normalizeForumThread(
  input: Partial<ForumThread>,
  index: number,
): ForumThread {
  const createdAt = toSafeString(input.createdAt, nowIso());
  const status =
    input.status === 'closed' || input.status === 'archived' ? input.status : 'open';
  return {
    id: toSafeString(input.id, `th-${index + 1}`),
    title: toSafeString(input.title, 'Untitled thread'),
    slug: toSafeString(input.slug, `thread-${index + 1}`),
    categoryId: toSafeString(input.categoryId, 'c-1'),
    authorId: toSafeString(input.authorId, 'u-1'),
    createdAt,
    lastActivityAt: toSafeString(input.lastActivityAt, createdAt),
    views: Math.max(0, toSafeNumber(input.views, 0)),
    replyCount: Math.max(0, toSafeNumber(input.replyCount, 0)),
    likeCount: toSafeNumber(input.likeCount, 0),
    bookmarkCount: Math.max(0, toSafeNumber(input.bookmarkCount, 0)),
    isPinned: Boolean(input.isPinned),
    isLocked: Boolean(input.isLocked),
    isSolved: Boolean(input.isSolved),
    solutionPostId:
      typeof input.solutionPostId === 'string' || input.solutionPostId === null
        ? input.solutionPostId
        : null,
    status,
    tags: toStringArray(input.tags)
      .map(cleanText)
      .filter(Boolean),
    imageUrls: toStringArray(input.imageUrls),
  };
}

function normalizeForumPost(input: Partial<ForumPost>, index: number): ForumPost {
  const createdAt = toSafeString(input.createdAt, nowIso());
  const reactions =
    input.reactions && typeof input.reactions === 'object'
      ? Object.fromEntries(
          Object.entries(input.reactions).filter(
            ([key, value]) =>
              typeof key === 'string' &&
              typeof value === 'number' &&
              Number.isFinite(value) &&
              value > 0,
          ),
        )
      : {};

  return {
    id: toSafeString(input.id, `p-${index + 1}`),
    threadId: toSafeString(input.threadId, 'th-1'),
    authorId: toSafeString(input.authorId, 'u-1'),
    content: toSafeString(input.content, ''),
    createdAt,
    updatedAt:
      typeof input.updatedAt === 'string' || input.updatedAt === null
        ? input.updatedAt
        : null,
    likeCount: toSafeNumber(input.likeCount, 0),
    replyToPostId:
      typeof input.replyToPostId === 'string' || input.replyToPostId === null
        ? input.replyToPostId
        : null,
    isAnswer: Boolean(input.isAnswer),
    reactions,
    imageUrls: toStringArray(input.imageUrls),
  };
}

function normalizeForumVote(input: Partial<ForumVote>, index: number): ForumVote | null {
  if (input.targetType !== 'thread' && input.targetType !== 'post') {
    return null;
  }
  const targetId = toSafeString(input.targetId, '');
  const userId = toSafeString(input.userId, '');
  if (!targetId || !userId) {
    return null;
  }

  const value: -1 | 1 = input.value === -1 ? -1 : 1;
  const createdAt = toSafeString(input.createdAt, nowIso());
  return {
    id: toSafeString(input.id, `v-${index + 1}`),
    targetType: input.targetType,
    targetId,
    userId,
    value,
    createdAt,
    updatedAt: toSafeString(input.updatedAt, createdAt),
  };
}

function normalizeForumAuditLog(
  input: Partial<ForumAuditLog>,
  index: number,
): ForumAuditLog | null {
  const actions = new Set<ForumAuditLog['action']>([
    'thread.create',
    'thread.update',
    'thread.delete',
    'post.create',
    'post.update',
    'post.delete',
    'vote.thread',
    'vote.post',
    'thread.mark_solution',
    'thread.clear_solution',
  ]);
  if (!input.action || !actions.has(input.action)) return null;

  const actorUserId = toSafeString(input.actorUserId, '');
  const targetId = toSafeString(input.targetId, '');
  if (!actorUserId || !targetId) {
    return null;
  }

  const targetType =
    input.targetType === 'thread' || input.targetType === 'post' ? input.targetType : 'forum';

  return {
    id: toSafeString(input.id, `a-${index + 1}`),
    action: input.action,
    actorUserId,
    targetType,
    targetId,
    metadata:
      input.metadata && typeof input.metadata === 'object'
        ? (input.metadata as Record<string, unknown>)
        : undefined,
    createdAt: toSafeString(input.createdAt, nowIso()),
  };
}

function normalizeForumStore(input: Partial<ForumStore> | null): ForumStore {
  const seed = seedStore();

  const users = Array.isArray(input?.users)
    ? input.users.map((item, idx) => normalizeForumUser(item, idx))
    : seed.users;
  const categories = Array.isArray(input?.categories)
    ? input.categories.map((item, idx) => normalizeForumCategory(item, idx))
    : seed.categories;
  const tags = Array.isArray(input?.tags)
    ? input.tags.map((item, idx) => normalizeForumTag(item, idx))
    : seed.tags;
  const threads = Array.isArray(input?.threads)
    ? input.threads.map((item, idx) => normalizeForumThread(item, idx))
    : seed.threads;
  const posts = Array.isArray(input?.posts)
    ? input.posts.map((item, idx) => normalizeForumPost(item, idx))
    : seed.posts;
  const votes = Array.isArray(input?.votes)
    ? input.votes
        .map((item, idx) => normalizeForumVote(item, idx))
        .filter((item): item is ForumVote => Boolean(item))
    : [];
  const auditLogs = Array.isArray(input?.auditLogs)
    ? input.auditLogs
        .map((item, idx) => normalizeForumAuditLog(item, idx))
        .filter((item): item is ForumAuditLog => Boolean(item))
    : [];

  return {
    users,
    categories,
    tags,
    threads,
    posts,
    votes,
    auditLogs,
  };
}

function canExtractString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function firstString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (canExtractString(value)) return value.trim();
  }
  return null;
}

function safeUsername(input: string): string {
  const normalized = cleanText(input).replace(/_/g, '');
  if (!normalized) return `member${Math.floor(Math.random() * 100000)}`;
  return normalized.slice(0, 24);
}

export function buildForumUserIdFromAuth(authUserId: string): string {
  const normalized = cleanText(authUserId);
  if (!normalized) return `auth-${randomUUID()}`;
  return `auth-${normalized.slice(0, 48)}`;
}

function ensureForumStoreDir() {
  const dir = path.dirname(FORUM_STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadForumStoreFromDisk(): ForumStore | null {
  try {
    if (!fs.existsSync(FORUM_STORE_PATH)) {
      return null;
    }
    const raw = fs.readFileSync(FORUM_STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ForumStore>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return normalizeForumStore(parsed);
  } catch {
    return null;
  }
}

export function getForumStore(): ForumStore {
  const globalAny = globalThis as typeof globalThis & {
    [storeKey]?: ForumStore;
  };
  if (!globalAny[storeKey]) {
    const disk = loadForumStoreFromDisk();
    globalAny[storeKey] = disk || normalizeForumStore(seedStore());
  }
  return globalAny[storeKey] as ForumStore;
}

export async function saveForumStore(): Promise<void> {
  const globalAny = globalThis as typeof globalThis & {
    [storeKey]?: ForumStore;
    [persistQueueKey]?: Promise<void>;
  };

  const store = getForumStore();
  ensureForumStoreDir();

  const write = async () => {
    const payload = JSON.stringify(store, null, 2);
    await fs.promises.writeFile(FORUM_STORE_PATH, payload, 'utf-8');
  };

  const prev = globalAny[persistQueueKey] || Promise.resolve();
  const next = prev.then(write, write);
  globalAny[persistQueueKey] = next;
  await next;
}

export function createForumId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export function ensureForumUserForAuth(
  store: ForumStore,
  auth: AuthContext,
): ForumUser {
  const payload = auth.payload as Record<string, unknown>;
  const candidateIds = [
    buildForumUserIdFromAuth(auth.userId),
    auth.userId,
    firstString(payload, ['forum_user_id']),
  ].filter((item): item is string => typeof item === 'string' && item.length > 0);

  for (const id of candidateIds) {
    const existing = store.users.find(user => user.id === id);
    if (existing) {
      existing.updatedAt = nowIso();
      return existing;
    }
  }

  const now = nowIso();
  const rawName =
    firstString(payload, ['name', 'full_name', 'fullname', 'display_name']) ||
    firstString(payload, ['username']) ||
    firstString(payload, ['email']) ||
    `User ${auth.userId}`;
  const username = safeUsername(
    firstString(payload, ['username']) || rawName || `member-${store.users.length + 1}`,
  );
  const title = firstString(payload, ['title', 'role_name']) || 'Community Member';
  const picture =
    firstString(payload, ['picture', 'avatar_url', 'avatar', 'image']) ||
    localAvatarForSeed(username);

  const user: ForumUser = {
    id: buildForumUserIdFromAuth(auth.userId),
    username,
    name: rawName,
    avatarUrl: picture,
    title,
    reputation: 0,
    baseReputation: 0,
    badges: [],
    createdAt: now,
    updatedAt: now,
  };
  store.users.push(user);
  return user;
}

export function isForumModeratorRole(roles: string[]): boolean {
  const normalized = new Set(roles.map(role => role.toLowerCase()));
  return (
    normalized.has('admin') ||
    normalized.has('superadmin') ||
    normalized.has('moderator') ||
    normalized.has('forum:moderator') ||
    normalized.has('forum:admin')
  );
}

export function addForumAuditLog(
  store: ForumStore,
  input: Omit<ForumAuditLog, 'id' | 'createdAt'>,
) {
  const entry: ForumAuditLog = {
    id: createForumId('a'),
    createdAt: nowIso(),
    ...input,
  };
  store.auditLogs.push(entry);
}

export type {
  ForumStore,
  ForumUser,
  ForumCategory,
  ForumTag,
  ForumThread,
  ForumPost,
  ForumVote,
  ForumAuditLog,
};

