export type CachedPersonalAiAgent = {
  id: string;
  name: string;
  description: string;
  visibility: 'private' | 'unlisted' | 'public' | 'shared';
  starter_prompts: string[];
  usage_count: number;
  can_edit: boolean;
};

export type CachedPersonalAiThread = {
  id: string;
  agent_id: string;
  title: string;
  updated_at: string;
};

export type CachedPersonalAiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};

export type PersonalAiCacheSnapshot<T> = {
  savedAt: number;
  data: T[];
};

type CacheKind = 'agents' | 'threads' | 'messages';

type PersonalAiCacheRecord = {
  key: string;
  schemaVersion: number;
  userId: string;
  kind: CacheKind;
  contextId: string;
  savedAt: number;
  data: unknown[];
};

const DATABASE_NAME = 'lajukan-personal-ai-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'snapshots';
const CACHE_SCHEMA_VERSION = 2;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_READ_DEADLINE_MS = 1_000;
const CACHE_WRITE_DEADLINE_MS = 1_500;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_AGENTS = 12;
const MAX_THREADS_PER_AGENT = 80;
const MAX_MESSAGES_PER_THREAD = 50;
const MAX_THREAD_LISTS_PER_USER = 12;
const MAX_MESSAGE_THREADS_PER_USER = 16;

const MAX_RECORDS_BY_KIND: Record<CacheKind, number> = {
  agents: 1,
  threads: MAX_THREAD_LISTS_PER_USER,
  messages: MAX_MESSAGE_THREADS_PER_USER,
};

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function cleanId(value: unknown): string {
  return cleanText(value, 256).trim();
}

function normalizeVisibility(
  value: unknown,
): CachedPersonalAiAgent['visibility'] {
  if (value === 'public' || value === 'unlisted' || value === 'shared') {
    return value;
  }
  return 'private';
}

function normalizeCreatedAt(value: unknown): string {
  const text = cleanText(value, 64);
  return Number.isFinite(Date.parse(text)) ? text : '';
}

function normalizeMessageMetadata(
  value: unknown,
  messageId: string,
): Record<string, unknown> | undefined {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const metadata: Record<string, unknown> = {};

  const clientRef = cleanText(source.client_ref, 256).trim();
  if (clientRef) metadata.client_ref = clientRef;

  // A browser reload must not make an interrupted optimistic message look sent.
  if (
    source.send_status === 'failed' ||
    source.send_status === 'sending' ||
    messageId.startsWith('local_')
  ) {
    metadata.send_status = 'failed';
  }

  if (source.forwarded === true) metadata.forwarded = true;

  const reaction = cleanText(source.user_reaction, 16).trim();
  if (reaction) metadata.user_reaction = reaction;

  const rawReply = source.reply_to;
  if (rawReply && typeof rawReply === 'object' && !Array.isArray(rawReply)) {
    const reply = rawReply as Record<string, unknown>;
    const replyId = cleanId(reply.message_id);
    const replyRole =
      reply.role === 'assistant' || reply.role === 'system'
        ? reply.role
        : 'user';
    if (replyId) {
      metadata.reply_to = {
        message_id: replyId,
        role: replyRole,
        excerpt: cleanText(reply.excerpt, 500),
      };
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function normalizeCachedPersonalAiAgents(
  input: unknown,
): CachedPersonalAiAgent[] {
  if (!Array.isArray(input)) return [];

  const byId = new Map<string, CachedPersonalAiAgent>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const source = raw as Record<string, unknown>;
    const id = cleanId(source.id);
    if (!id) continue;

    const starterPrompts = Array.isArray(source.starter_prompts)
      ? source.starter_prompts
          .filter((item): item is string => typeof item === 'string')
          .map(item => item.trim().slice(0, 500))
          .filter(Boolean)
          .slice(0, 6)
      : [];
    const usageCount = Number(source.usage_count);

    // Deliberately allow-list display fields. Capability links, owner prompts,
    // provider settings, memory, and builder configuration are never cached.
    byId.set(id, {
      id,
      name: cleanText(source.name, 160),
      description: cleanText(source.description, 800),
      visibility: normalizeVisibility(source.visibility),
      starter_prompts: starterPrompts,
      usage_count: Number.isFinite(usageCount)
        ? Math.max(0, Math.min(Math.trunc(usageCount), 1_000_000_000))
        : 0,
      can_edit: source.can_edit === true,
    });
  }

  return [...byId.values()].slice(0, MAX_AGENTS);
}

export function normalizeCachedPersonalAiThreads(
  input: unknown,
): CachedPersonalAiThread[] {
  if (!Array.isArray(input)) return [];

  const byId = new Map<string, CachedPersonalAiThread>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const source = raw as Record<string, unknown>;
    const id = cleanId(source.id);
    const agentId = cleanId(source.agent_id);
    if (!id || !agentId) continue;
    byId.set(id, {
      id,
      agent_id: agentId,
      title: cleanText(source.title, 300),
      updated_at: normalizeCreatedAt(source.updated_at),
    });
  }

  return [...byId.values()]
    .sort((left, right) => {
      const timeDifference =
        Date.parse(right.updated_at) - Date.parse(left.updated_at);
      return Number.isFinite(timeDifference) && timeDifference !== 0
        ? timeDifference
        : left.id.localeCompare(right.id);
    })
    .slice(0, MAX_THREADS_PER_AGENT);
}

export function normalizeCachedPersonalAiMessages(
  input: unknown,
): CachedPersonalAiMessage[] {
  if (!Array.isArray(input)) return [];

  const byId = new Map<string, CachedPersonalAiMessage>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const source = raw as Record<string, unknown>;
    const id = cleanId(source.id);
    if (!id) continue;
    if (source.role !== 'user' && source.role !== 'assistant') continue;
    const role = source.role;
    const metadata = normalizeMessageMetadata(source.metadata, id);
    byId.set(id, {
      id,
      role,
      content: cleanText(source.content, 6000),
      created_at: normalizeCreatedAt(source.created_at),
      ...(metadata ? { metadata } : {}),
    });
  }

  return [...byId.values()]
    .sort((left, right) => {
      const timeDifference =
        Date.parse(left.created_at) - Date.parse(right.created_at);
      return Number.isFinite(timeDifference) && timeDifference !== 0
        ? timeDifference
        : left.id.localeCompare(right.id);
    })
    .slice(-MAX_MESSAGES_PER_THREAD);
}

function cacheKey(userId: string, kind: CacheKind, contextId: string): string {
  return `${CACHE_SCHEMA_VERSION}:${kind}:${userId}:${contextId}`;
}

function loadWithinDeadline<T>(
  operation: Promise<PersonalAiCacheSnapshot<T> | null>,
): Promise<PersonalAiCacheSnapshot<T> | null> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (value: PersonalAiCacheSnapshot<T> | null) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      resolve(value);
    };
    const timer = globalThis.setTimeout(
      () => finish(null),
      CACHE_READ_DEADLINE_MS,
    );
    operation.then(finish, () => finish(null));
  });
}

function saveWithinDeadline(operation: Promise<void>): Promise<void> {
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      resolve();
    };
    const timer = globalThis.setTimeout(finish, CACHE_WRITE_DEADLINE_MS);
    operation.then(finish, finish);
  });
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise(resolve => {
    let request: IDBOpenDBRequest;
    let settled = false;
    const finish = (database: IDBDatabase | null) => {
      if (settled) {
        database?.close();
        return;
      }
      settled = true;
      resolve(database);
    };
    try {
      request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch {
      finish(null);
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: 'key',
        });
        store.createIndex('by_user', 'userId', { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      finish(database);
    };
    request.onerror = () => finish(null);
    request.onblocked = () => finish(null);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T | null> {
  return new Promise(resolve => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise(resolve => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

function isFreshRecord(
  record: PersonalAiCacheRecord,
  expected: { userId: string; kind: CacheKind; contextId: string },
  now: number,
): boolean {
  return (
    record.schemaVersion === CACHE_SCHEMA_VERSION &&
    record.userId === expected.userId &&
    record.kind === expected.kind &&
    record.contextId === expected.contextId &&
    Number.isFinite(record.savedAt) &&
    record.savedAt <= now + MAX_FUTURE_CLOCK_SKEW_MS &&
    now - record.savedAt <= CACHE_TTL_MS
  );
}

async function deleteRecords(
  database: IDBDatabase,
  keys: IDBValidKey[],
): Promise<void> {
  if (keys.length === 0) return;
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const completed = transactionComplete(transaction);
  const store = transaction.objectStore(STORE_NAME);
  keys.forEach(key => store.delete(key));
  await completed;
}

async function pruneUserRecords(
  database: IDBDatabase,
  userId: string,
  now: number,
): Promise<void> {
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const completed = transactionComplete(transaction);
  const rows = await requestResult(
    transaction.objectStore(STORE_NAME).index('by_user').getAll(userId),
  );
  await completed;
  if (!Array.isArray(rows)) return;

  const records = rows as PersonalAiCacheRecord[];
  const staleKeys = records
    .filter(
      record =>
        record.schemaVersion !== CACHE_SCHEMA_VERSION ||
        !Number.isFinite(record.savedAt) ||
        record.savedAt > now + MAX_FUTURE_CLOCK_SKEW_MS ||
        now - record.savedAt > CACHE_TTL_MS,
    )
    .map(record => record.key);

  for (const kind of ['agents', 'threads', 'messages'] as const) {
    const overflow = records
      .filter(
        record =>
          record.kind === kind &&
          record.schemaVersion === CACHE_SCHEMA_VERSION &&
          !staleKeys.includes(record.key),
      )
      .sort((left, right) => right.savedAt - left.savedAt)
      .slice(MAX_RECORDS_BY_KIND[kind]);
    overflow.forEach(record => staleKeys.push(record.key));
  }

  await deleteRecords(database, [...new Set(staleKeys)]);
}

async function loadSnapshot<T>(input: {
  userId: string;
  kind: CacheKind;
  contextId: string;
  normalize: (value: unknown) => T[];
}): Promise<PersonalAiCacheSnapshot<T> | null> {
  const userId = cleanId(input.userId);
  const contextId = cleanId(input.contextId);
  if (!userId || !contextId) return null;
  const database = await openDatabase();
  if (!database) return null;

  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const completed = transactionComplete(transaction);
    const row = await requestResult(
      transaction
        .objectStore(STORE_NAME)
        .get(cacheKey(userId, input.kind, contextId)),
    );
    await completed;
    if (!row || typeof row !== 'object') return null;

    const record = row as PersonalAiCacheRecord;
    const now = Date.now();
    if (!isFreshRecord(record, { userId, kind: input.kind, contextId }, now)) {
      await deleteRecords(database, [record.key]);
      return null;
    }
    return { savedAt: record.savedAt, data: input.normalize(record.data) };
  } catch {
    return null;
  } finally {
    database.close();
  }
}

async function saveSnapshot<T>(input: {
  userId: string;
  kind: CacheKind;
  contextId: string;
  data: unknown;
  normalize: (value: unknown) => T[];
}): Promise<void> {
  const userId = cleanId(input.userId);
  const contextId = cleanId(input.contextId);
  if (!userId || !contextId) return;
  const data = input.normalize(input.data);
  const database = await openDatabase();
  if (!database) return;

  try {
    const now = Date.now();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).put({
      key: cacheKey(userId, input.kind, contextId),
      schemaVersion: CACHE_SCHEMA_VERSION,
      userId,
      kind: input.kind,
      contextId,
      savedAt: now,
      data,
    } satisfies PersonalAiCacheRecord);
    await completed;
    await pruneUserRecords(database, userId, now);
  } catch {
    // A blocked, unavailable, or full cache must never break canonical chat.
  } finally {
    database.close();
  }
}

export async function clearPersonalAiCache(userId: string): Promise<void> {
  const normalizedUserId = cleanId(userId);
  if (!normalizedUserId) return;
  const database = await openDatabase();
  if (!database) return;

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const cursorRequest = store
      .index('by_user')
      .openKeyCursor(normalizedUserId);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      store.delete(cursor.primaryKey);
      cursor.continue();
    };
    await completed;
  } catch {
    // Local cache cleanup is best effort; authentication state remains canonical.
  } finally {
    database.close();
  }
}

export function loadPersonalAiAgentsCache(
  userId: string,
): Promise<PersonalAiCacheSnapshot<CachedPersonalAiAgent> | null> {
  return loadWithinDeadline(
    loadSnapshot({
      userId,
      kind: 'agents',
      contextId: 'owned',
      normalize: normalizeCachedPersonalAiAgents,
    }),
  );
}

export function savePersonalAiAgentsCache(
  userId: string,
  agents: unknown,
): Promise<void> {
  return saveWithinDeadline(
    saveSnapshot({
      userId,
      kind: 'agents',
      contextId: 'owned',
      data: agents,
      normalize: normalizeCachedPersonalAiAgents,
    }),
  );
}

export function loadPersonalAiThreadsCache(
  userId: string,
  agentId: string,
): Promise<PersonalAiCacheSnapshot<CachedPersonalAiThread> | null> {
  return loadWithinDeadline(
    loadSnapshot({
      userId,
      kind: 'threads',
      contextId: agentId,
      normalize: normalizeCachedPersonalAiThreads,
    }),
  );
}

export function savePersonalAiThreadsCache(
  userId: string,
  agentId: string,
  threads: unknown,
): Promise<void> {
  return saveWithinDeadline(
    saveSnapshot({
      userId,
      kind: 'threads',
      contextId: agentId,
      data: threads,
      normalize: normalizeCachedPersonalAiThreads,
    }),
  );
}

export function loadPersonalAiMessagesCache(
  userId: string,
  threadId: string,
): Promise<PersonalAiCacheSnapshot<CachedPersonalAiMessage> | null> {
  return loadWithinDeadline(
    loadSnapshot({
      userId,
      kind: 'messages',
      contextId: threadId,
      normalize: normalizeCachedPersonalAiMessages,
    }),
  );
}

export function savePersonalAiMessagesCache(
  userId: string,
  threadId: string,
  messages: unknown,
): Promise<void> {
  return saveWithinDeadline(
    saveSnapshot({
      userId,
      kind: 'messages',
      contextId: threadId,
      data: messages,
      normalize: normalizeCachedPersonalAiMessages,
    }),
  );
}
