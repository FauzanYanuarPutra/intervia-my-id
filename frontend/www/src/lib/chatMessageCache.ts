export type CachedChatMessageStatus = 'sending' | 'sent' | 'failed';

export type CachedChatMessage = {
  id: string;
  content: string;
  sender_id: string;
  message_type?: string;
  attachments?: string[];
  created_at: string;
  status?: CachedChatMessageStatus;
};

type ChatMessageCacheRecord = {
  key: string;
  userId: string;
  roomId: string;
  savedAt: number;
  messages: CachedChatMessage[];
};

export type ChatMessageCacheSnapshot = {
  savedAt: number;
  messages: CachedChatMessage[];
};

const DATABASE_NAME = 'lajukan-chat-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'room_messages';
const MAX_CACHED_MESSAGES = 100;
const MAX_CACHED_ROOMS_PER_USER = 24;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_READ_DEADLINE_MS = 1_000;

function loadWithinDeadline(
  operation: Promise<ChatMessageCacheSnapshot | null>,
): Promise<ChatMessageCacheSnapshot | null> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (value: ChatMessageCacheSnapshot | null) => {
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

function cacheKey(userId: string, roomId: string): string {
  return `${userId.trim()}::${roomId.trim()}`;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function normalizeStatus(value: unknown): CachedChatMessageStatus {
  // An interrupted optimistic send must never return as "sending" forever
  // after a reload. It stays visible and can be retried by the user.
  if (value === 'sending' || value === 'failed') return 'failed';
  return 'sent';
}

export function normalizeCachedChatMessages(
  input: unknown,
): CachedChatMessage[] {
  if (!Array.isArray(input)) return [];

  const byId = new Map<string, CachedChatMessage>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const source = raw as Record<string, unknown>;
    const id = cleanText(source.id, 256).trim();
    if (!id) continue;

    const attachments = Array.isArray(source.attachments)
      ? source.attachments
          .filter((item): item is string => typeof item === 'string')
          .map(item => item.slice(0, 2048))
          .filter(Boolean)
          .slice(0, 10)
      : [];

    byId.set(id, {
      id,
      content: cleanText(source.content, 5000),
      sender_id: cleanText(source.sender_id, 128),
      message_type: cleanText(source.message_type, 32) || 'text',
      attachments,
      created_at: cleanText(source.created_at, 64),
      status: normalizeStatus(source.status),
    });
  }

  return [...byId.values()]
    .sort((left, right) => {
      const leftTime = Date.parse(left.created_at);
      const rightTime = Date.parse(right.created_at);
      if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return 0;
      if (!Number.isFinite(leftTime)) return 1;
      if (!Number.isFinite(rightTime)) return -1;
      return leftTime - rightTime;
    })
    .slice(-MAX_CACHED_MESSAGES);
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
        store.createIndex('by_saved_at', 'savedAt', { unique: false });
      }
    };
    request.onsuccess = () => finish(request.result);
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

async function deleteExpiredRecords(database: IDBDatabase, now: number) {
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const completed = transactionComplete(transaction);
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('by_saved_at');
  const range = IDBKeyRange.upperBound(now - CACHE_TTL_MS);

  await new Promise<void>(resolve => {
    const cursorRequest = index.openKeyCursor(range);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) {
        resolve();
        return;
      }
      store.delete(cursor.primaryKey);
      cursor.continue();
    };
    cursorRequest.onerror = () => resolve();
  });
  await completed;
}

async function pruneUserRooms(database: IDBDatabase, userId: string) {
  const readTransaction = database.transaction(STORE_NAME, 'readonly');
  const readCompleted = transactionComplete(readTransaction);
  const rows = await requestResult(
    readTransaction.objectStore(STORE_NAME).index('by_user').getAll(userId),
  );
  await readCompleted;

  if (!Array.isArray(rows) || rows.length <= MAX_CACHED_ROOMS_PER_USER) return;
  const staleKeys = (rows as ChatMessageCacheRecord[])
    .sort((left, right) => right.savedAt - left.savedAt)
    .slice(MAX_CACHED_ROOMS_PER_USER)
    .map(row => row.key);

  const writeTransaction = database.transaction(STORE_NAME, 'readwrite');
  const writeCompleted = transactionComplete(writeTransaction);
  const store = writeTransaction.objectStore(STORE_NAME);
  staleKeys.forEach(key => store.delete(key));
  await writeCompleted;
}

async function readChatMessageCache(
  userId: string,
  roomId: string,
): Promise<ChatMessageCacheSnapshot | null> {
  const normalizedUserId = userId.trim();
  const normalizedRoomId = roomId.trim();
  if (!normalizedUserId || !normalizedRoomId) return null;
  const database = await openDatabase();
  if (!database) return null;

  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const completed = transactionComplete(transaction);
    const row = await requestResult(
      transaction
        .objectStore(STORE_NAME)
        .get(cacheKey(normalizedUserId, normalizedRoomId)),
    );
    await completed;

    if (!row || typeof row !== 'object') return null;
    const record = row as ChatMessageCacheRecord;
    if (
      record.userId !== normalizedUserId ||
      record.roomId !== normalizedRoomId ||
      !Number.isFinite(record.savedAt) ||
      Date.now() - record.savedAt > CACHE_TTL_MS
    ) {
      const cleanup = database.transaction(STORE_NAME, 'readwrite');
      const cleanupCompleted = transactionComplete(cleanup);
      cleanup
        .objectStore(STORE_NAME)
        .delete(cacheKey(normalizedUserId, normalizedRoomId));
      await cleanupCompleted;
      return null;
    }

    const messages = normalizeCachedChatMessages(record.messages);
    return messages.length > 0 ? { savedAt: record.savedAt, messages } : null;
  } catch {
    return null;
  } finally {
    database.close();
  }
}

export function loadChatMessageCache(
  userId: string,
  roomId: string,
): Promise<ChatMessageCacheSnapshot | null> {
  return loadWithinDeadline(readChatMessageCache(userId, roomId));
}

export async function saveChatMessageCache(
  userId: string,
  roomId: string,
  input: unknown,
): Promise<void> {
  const normalizedUserId = userId.trim();
  const normalizedRoomId = roomId.trim();
  if (!normalizedUserId || !normalizedRoomId) return;
  const messages = normalizeCachedChatMessages(input);
  const database = await openDatabase();
  if (!database) return;

  try {
    const now = Date.now();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).put({
      key: cacheKey(normalizedUserId, normalizedRoomId),
      userId: normalizedUserId,
      roomId: normalizedRoomId,
      savedAt: now,
      messages,
    } satisfies ChatMessageCacheRecord);
    await completed;
    await deleteExpiredRecords(database, now);
    await pruneUserRooms(database, normalizedUserId);
  } catch {
    // Browser storage is an acceleration layer. Quota/privacy-mode failures
    // must never make canonical server chat unusable.
  } finally {
    database.close();
  }
}

export async function clearChatMessageCache(userId: string): Promise<void> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return;
  const database = await openDatabase();
  if (!database) return;

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('by_user');

    await new Promise<void>(resolve => {
      const cursorRequest = index.openKeyCursor(
        IDBKeyRange.only(normalizedUserId),
      );
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve();
          return;
        }
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
      cursorRequest.onerror = () => resolve();
    });
    await completed;
  } catch {
    // Cache cleanup remains best-effort in browsers that block IndexedDB.
  } finally {
    database.close();
  }
}

export async function clearChatMessageCacheForRoom(
  userId: string,
  roomId: string,
): Promise<void> {
  const normalizedUserId = userId.trim();
  const normalizedRoomId = roomId.trim();
  if (!normalizedUserId || !normalizedRoomId) return;
  const database = await openDatabase();
  if (!database) return;

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction
      .objectStore(STORE_NAME)
      .delete(cacheKey(normalizedUserId, normalizedRoomId));
    await completed;
  } catch {
    // Cache cleanup remains best-effort in browsers that block IndexedDB.
  } finally {
    database.close();
  }
}
