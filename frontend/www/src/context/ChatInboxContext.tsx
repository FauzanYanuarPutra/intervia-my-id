'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { clearChatMessageCache } from '@/lib/chatMessageCache';
import { readProfileAvatarStyle } from '@/lib/profile/avatar';
import type { Channel } from 'phoenix';

export type InboxRoom = {
  room_id?: string;
  id?: string;
  room_name?: string;
  name?: string;
  room_avatar?: string;
  avatar?: string;
  last_message?: string;
  lastMsg?: string;
  last_message_at?: string;
  unread_count?: number;
  last_sender?: string;
  [key: string]: unknown;
};

type ChatInboxContextValue = {
  rooms: InboxRoom[];
  totalUnread: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markRoomRead: (roomId: string) => void;
};

type InboxRoomSnapshot = {
  roomId: string;
  roomName: string;
  roomAvatar: string;
  roomAvatarStyle?: unknown;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  lastSender: string;
};

type IncomingCallEventPayload = {
  call_id?: string;
  room_id?: string;
  caller_id?: string;
  caller_username?: string;
  caller_avatar?: string;
  caller_avatar_style?: unknown;
  avatar_style?: unknown;
  call_type?: 'video' | 'voice';
};

type InboxRequest = {
  userId: string;
  controller: AbortController;
  promise: Promise<void>;
};

type CachedInboxPayload = {
  version: 1;
  userId: string;
  savedAt: number;
  rooms: InboxRoom[];
};

const CHAT_INBOX_CACHE_VERSION = 1 as const;
const CHAT_INBOX_CACHE_PREFIX = 'lajukan:chat-inbox:v1:';
const CHAT_INBOX_CACHE_TTL_MS = 5 * 60 * 1000;
const CHAT_INBOX_CACHE_MAX_ROOMS = 30;
const CHAT_INBOX_CACHE_MAX_CHARS = 96_000;

const ChatInboxContext = createContext<ChatInboxContextValue | undefined>(
  undefined,
);

function resolveCurrentLocale(): string {
  if (typeof window === 'undefined') return 'id';
  const match = window.location.pathname.match(/^\/(id|en)(?:\/|$)/);
  return match?.[1] || 'id';
}

function resolveLocalizedChatHref(roomId: string): string {
  return `/${resolveCurrentLocale()}/chat/${encodeURIComponent(roomId)}`;
}

function buildRoomSnapshot(room: InboxRoom): InboxRoomSnapshot | null {
  const roomId = String(room.room_id ?? room.id ?? '').trim();
  if (!roomId) return null;

  return {
    roomId,
    roomName: String(room.room_name ?? room.name ?? roomId),
    roomAvatar: String(room.room_avatar ?? room.avatar ?? ''),
    roomAvatarStyle: readProfileAvatarStyle(room),
    lastMessage: String(room.last_message ?? room.lastMsg ?? ''),
    lastMessageAt: String(room.last_message_at ?? ''),
    unreadCount: Number(room.unread_count ?? 0),
    lastSender: String(room.last_sender ?? '').toLowerCase(),
  };
}

function normalizeInboxRoomId(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

function boundedJsonValue(value: unknown, maxLength = 4_096): unknown {
  if (value === undefined || value === null) return undefined;
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length > maxLength) return undefined;
    return JSON.parse(serialized) as unknown;
  } catch {
    return undefined;
  }
}

function sanitizeCachedInboxRoom(value: unknown): InboxRoom | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const room = value as InboxRoom;
  const roomId = normalizeInboxRoomId(room.room_id ?? room.id);
  if (!roomId || roomId.length > 512) return null;

  const unreadRaw = Number(room.unread_count ?? 0);
  const unreadCount = Number.isFinite(unreadRaw)
    ? Math.min(999_999, Math.max(0, Math.trunc(unreadRaw)))
    : 0;
  const avatarStyle = boundedJsonValue(readProfileAvatarStyle(room));

  return {
    room_id: roomId,
    id: roomId,
    room_name: boundedString(room.room_name ?? room.name, 240),
    room_avatar: boundedString(room.room_avatar ?? room.avatar, 2_048),
    last_message: boundedString(room.last_message ?? room.lastMsg, 2_000),
    last_message_at: boundedString(room.last_message_at, 80),
    unread_count: unreadCount,
    last_sender: boundedString(room.last_sender, 128),
    room_type: boundedString(room.room_type, 32),
    is_pinned: room.is_pinned === true,
    ...(avatarStyle !== undefined ? { avatar_style: avatarStyle } : {}),
  };
}

function inboxCacheKey(userId: string): string {
  return `${CHAT_INBOX_CACHE_PREFIX}${encodeURIComponent(userId)}`;
}

function removeCachedInbox(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.sessionStorage.removeItem(inboxCacheKey(userId));
  } catch {
    // Session storage may be disabled by the browser.
  }
}

function readCachedInbox(userId: string): InboxRoom[] | null {
  if (typeof window === 'undefined' || !userId) return null;
  const key = inboxCacheKey(userId);
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    if (raw.length > CHAT_INBOX_CACHE_MAX_CHARS) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    const payload = JSON.parse(raw) as Partial<CachedInboxPayload>;
    const now = Date.now();
    if (
      payload.version !== CHAT_INBOX_CACHE_VERSION ||
      payload.userId !== userId ||
      !Number.isFinite(payload.savedAt) ||
      Number(payload.savedAt) > now + 60_000 ||
      now - Number(payload.savedAt) > CHAT_INBOX_CACHE_TTL_MS ||
      !Array.isArray(payload.rooms)
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return payload.rooms
      .slice(0, CHAT_INBOX_CACHE_MAX_ROOMS)
      .map(sanitizeCachedInboxRoom)
      .filter((room): room is InboxRoom => room !== null);
  } catch {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures.
    }
    return null;
  }
}

function writeCachedInbox(userId: string, rooms: InboxRoom[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const payload: CachedInboxPayload = {
      version: CHAT_INBOX_CACHE_VERSION,
      userId,
      savedAt: Date.now(),
      rooms: rooms
        .slice(0, CHAT_INBOX_CACHE_MAX_ROOMS)
        .map(sanitizeCachedInboxRoom)
        .filter((room): room is InboxRoom => room !== null),
    };
    const serialized = JSON.stringify(payload);
    if (serialized.length > CHAT_INBOX_CACHE_MAX_CHARS) return;
    window.sessionStorage.setItem(inboxCacheKey(userId), serialized);
  } catch {
    // A cache miss is safe; the server remains authoritative.
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function ChatInboxProvider({ children }: { children: ReactNode }) {
  const { user, accessToken, authFetch } = useAuth();
  const userId = user?.id;
  const [rooms, setRooms] = useState<InboxRoom[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<Channel | null>(null);
  const initialLoadedRef = useRef(false);
  const activeUserIdRef = useRef(userId ?? '');
  const cacheOwnerUserIdRef = useRef('');
  const roomsRef = useRef<InboxRoom[]>([]);
  const inboxRequestRef = useRef<InboxRequest | null>(null);
  const lastInboxSyncAtRef = useRef(0);
  const inboxUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const roomSnapshotRef = useRef<Map<string, InboxRoomSnapshot>>(new Map());

  activeUserIdRef.current = userId ?? '';

  const toSignature = useCallback((list: InboxRoom[]) => {
    return list
      .map(r => {
        const id = String(r.room_id ?? r.id ?? '');
        const lastAt = String(r.last_message_at ?? '');
        const unread = Number(r.unread_count ?? 0);
        const last = String(r.last_message ?? r.lastMsg ?? '');
        const name = String(r.room_name ?? r.name ?? '');
        return `${id}|${lastAt}|${unread}|${last}|${name}`;
      })
      .join('||');
  }, []);

  const emitChatMessageNotifications = useCallback(
    (list: InboxRoom[]) => {
      if (typeof window === 'undefined' || !userId) return;

      const previous = roomSnapshotRef.current;
      const next = new Map<string, InboxRoomSnapshot>();

      list.forEach(room => {
        const snapshot = buildRoomSnapshot(room);
        if (!snapshot) return;

        next.set(snapshot.roomId, snapshot);
        const previousSnapshot = previous.get(snapshot.roomId);
        if (!previousSnapshot) return;

        const isOwnLast =
          snapshot.lastSender !== '' &&
          snapshot.lastSender === String(userId).toLowerCase();
        const unreadRaised =
          snapshot.unreadCount > previousSnapshot.unreadCount;
        const messageChanged =
          snapshot.lastMessageAt !== '' &&
          snapshot.lastMessageAt !== previousSnapshot.lastMessageAt;

        if (!isOwnLast && unreadRaised && messageChanged) {
          window.dispatchEvent(
            new CustomEvent('chat:message-notification', {
              detail: {
                id: `${snapshot.roomId}:${snapshot.lastMessageAt}:${snapshot.unreadCount}`,
                roomId: snapshot.roomId,
                roomName: snapshot.roomName,
                roomAvatar: snapshot.roomAvatar || undefined,
                roomAvatarStyle: snapshot.roomAvatarStyle,
                message: snapshot.lastMessage || 'Ada pesan baru.',
                unreadCount: snapshot.unreadCount,
                lastMessageAt: snapshot.lastMessageAt,
                url: resolveLocalizedChatHref(snapshot.roomId),
              },
            }),
          );
        }
      });

      roomSnapshotRef.current = next;
    },
    [userId],
  );

  const applyInbox = useCallback(
    (
      list: InboxRoom[],
      options?: {
        emitChatMessageNotifications?: boolean;
        persist?: boolean;
      },
    ) => {
      if (options?.emitChatMessageNotifications) {
        emitChatMessageNotifications(list);
      } else {
        roomSnapshotRef.current = new Map(
          list
            .map(room => buildRoomSnapshot(room))
            .filter(
              (snapshot): snapshot is InboxRoomSnapshot => snapshot !== null,
            )
            .map(snapshot => [snapshot.roomId, snapshot]),
        );
      }

      setRooms(prev => {
        const prevSig = toSignature(prev);
        const nextSig = toSignature(list);
        if (prevSig === nextSig) return prev;
        return list;
      });
      roomsRef.current = list;

      const total = list.reduce((acc, r) => {
        const unread = Number(r.unread_count ?? 0);
        const lastSender = String(r.last_sender ?? '').toLowerCase();
        const isOwnLast =
          Boolean(userId) &&
          lastSender &&
          lastSender === String(userId).toLowerCase();
        return acc + (isOwnLast ? 0 : unread);
      }, 0);
      setTotalUnread(prev => (prev === total ? prev : total));

      if (userId && options?.persist !== false) {
        writeCachedInbox(userId, list);
      }
    },
    [emitChatMessageNotifications, toSignature, userId],
  );

  const markRoomRead = useCallback(
    (roomId: string) => {
      const normalizedRoomId = normalizeInboxRoomId(roomId);
      if (!normalizedRoomId) return;

      let changed = false;
      const next = roomsRef.current.map(room => {
        const currentRoomId = normalizeInboxRoomId(room.room_id ?? room.id);
        if (currentRoomId !== normalizedRoomId) return room;
        const unread = Number(room.unread_count ?? 0);
        if (!Number.isFinite(unread) || unread <= 0) return room;
        changed = true;
        return {
          ...room,
          unread_count: 0,
        };
      });

      if (changed) applyInbox(next);
    },
    [applyInbox],
  );

  const refreshInbox = useCallback(
    async (opts?: { silent?: boolean; minIntervalMs?: number }) => {
      if (!userId) return;
      const silent = opts?.silent ?? false;
      const existing = inboxRequestRef.current;
      if (existing?.userId === userId) return existing.promise;
      if (existing) existing.controller.abort();
      const now = Date.now();
      if (
        opts?.minIntervalMs &&
        now - lastInboxSyncAtRef.current < opts.minIntervalMs
      ) {
        return;
      }
      lastInboxSyncAtRef.current = now;

      if (!silent && !initialLoadedRef.current) setLoading(true);
      const controller = new AbortController();
      const promise = (async () => {
        try {
          const res = await authFetch('/api/chat/inbox', {
            cache: 'no-store',
            signal: controller.signal,
          });
          if (!res.ok) {
            throw new Error(`chat inbox unavailable (${res.status})`);
          }
          const data = (await res.json()) as { data?: unknown };
          if (controller.signal.aborted || activeUserIdRef.current !== userId) {
            return;
          }
          const list = Array.isArray(data.data)
            ? (data.data as InboxRoom[])
            : [];
          applyInbox(list, {
            emitChatMessageNotifications: silent && initialLoadedRef.current,
          });
          initialLoadedRef.current = true;
          setError(null);
        } catch (err) {
          if (controller.signal.aborted || isAbortError(err)) return;
          if (activeUserIdRef.current !== userId) return;
          console.error('ChatInbox refetch failed', err);
          setError('chat-inbox-unavailable');
        } finally {
          if (inboxRequestRef.current?.controller === controller) {
            inboxRequestRef.current = null;
          }
          if (
            !controller.signal.aborted &&
            activeUserIdRef.current === userId
          ) {
            setLoading(false);
          }
        }
      })();

      inboxRequestRef.current = { userId, controller, promise };
      return promise;
    },
    [userId, authFetch, applyInbox],
  );

  const refetch = useCallback(
    () => refreshInbox({ silent: false }),
    [refreshInbox],
  );

  // Initial fetch + join user channel untuk inbox_updated
  useEffect(() => {
    if (!userId || !accessToken) {
      const previousCacheOwner = cacheOwnerUserIdRef.current;
      if (previousCacheOwner) {
        removeCachedInbox(previousCacheOwner);
        void clearChatMessageCache(previousCacheOwner);
      }
      cacheOwnerUserIdRef.current = '';
      inboxRequestRef.current?.controller.abort();
      inboxRequestRef.current = null;
      roomsRef.current = [];
      setRooms([]);
      setTotalUnread(0);
      setLoading(false);
      setError(null);
      initialLoadedRef.current = false;
      lastInboxSyncAtRef.current = 0;
      roomSnapshotRef.current = new Map();
      return;
    }

    const previousCacheOwner = cacheOwnerUserIdRef.current;
    if (previousCacheOwner && previousCacheOwner !== userId) {
      removeCachedInbox(previousCacheOwner);
      void clearChatMessageCache(previousCacheOwner);
      roomsRef.current = [];
      setRooms([]);
      setTotalUnread(0);
    }
    cacheOwnerUserIdRef.current = userId;
    initialLoadedRef.current = false;
    lastInboxSyncAtRef.current = 0;
    roomSnapshotRef.current = new Map();

    const cachedRooms = readCachedInbox(userId);
    if (cachedRooms !== null) {
      applyInbox(cachedRooms, { persist: false });
      initialLoadedRef.current = true;
      setLoading(false);
    } else {
      roomsRef.current = [];
      setRooms([]);
      setTotalUnread(0);
      setLoading(true);
    }

    void refreshInbox({ silent: cachedRooms !== null });
  }, [userId, accessToken, applyInbox, refreshInbox]);

  useEffect(() => {
    if (!userId || !accessToken) {
      // Cleanup channel jika user logout
      if (channelRef.current) {
        try {
          channelRef.current.leave();
        } catch {
          // ignore
        }
        channelRef.current = null;
      }
      return;
    }

    let channel: Channel | null = null;
    let isMounted = true;
    let inboxUpdatedRef: number | null = null;
    let incomingCallRef: number | null = null;

    const setupChannel = async () => {
      try {
        const { joinUserChannel } = await import('@/lib/chat');
        const joinedChannel = await joinUserChannel(userId, accessToken);
        if (!isMounted) {
          try {
            joinedChannel.leave();
          } catch {
            // ignore
          }
          return;
        }

        channel = joinedChannel;
        channelRef.current = joinedChannel;
        inboxUpdatedRef = joinedChannel.on('inbox_updated', () => {
          if (!isMounted) return;
          if (inboxUpdateTimerRef.current) {
            clearTimeout(inboxUpdateTimerRef.current);
          }
          inboxUpdateTimerRef.current = setTimeout(() => {
            if (isMounted) {
              const eventArrivedDuringRequest =
                inboxRequestRef.current?.userId === userId;
              void refreshInbox({ silent: true }).then(() => {
                if (isMounted && eventArrivedDuringRequest) {
                  void refreshInbox({ silent: true });
                }
              });
            }
          }, 250);
        }) as number;

        incomingCallRef = joinedChannel.on(
          'incoming_call',
          (payload: IncomingCallEventPayload) => {
            if (!isMounted || typeof window === 'undefined') return;

            const roomId = String(payload.room_id ?? '').trim();
            const callId = String(payload.call_id ?? '').trim();
            const callerId = String(payload.caller_id ?? '').trim();
            const callerUsername = String(
              payload.caller_username ?? 'Unknown caller',
            ).trim();

            if (!roomId || !callId || !callerId) return;
            if (callerId.toLowerCase() === String(userId).toLowerCase()) return;

            window.dispatchEvent(
              new CustomEvent('chat:incoming-call', {
                detail: {
                  call_id: callId,
                  room_id: roomId,
                  caller_id: callerId,
                  caller_username: callerUsername,
                  caller_avatar:
                    String(payload.caller_avatar ?? '') || undefined,
                  caller_avatar_style:
                    payload.caller_avatar_style ?? payload.avatar_style,
                  call_type: payload.call_type === 'video' ? 'video' : 'voice',
                  url: resolveLocalizedChatHref(roomId),
                },
              }),
            );
          },
        ) as number;
      } catch (err) {
        if (!isMounted) return;
        console.error('[ChatInbox] joinUserChannel failed', err);
        channelRef.current = null;
      }
    };

    void setupChannel();

    return () => {
      isMounted = false;
      if (inboxUpdateTimerRef.current) {
        clearTimeout(inboxUpdateTimerRef.current);
        inboxUpdateTimerRef.current = null;
      }

      const activeChannel = channel || channelRef.current;
      if (activeChannel) {
        try {
          if (inboxUpdatedRef !== null) {
            activeChannel.off('inbox_updated', inboxUpdatedRef);
          }
          if (incomingCallRef !== null) {
            activeChannel.off('incoming_call', incomingCallRef);
          }
          activeChannel.leave();
        } catch {
          // ignore cleanup errors
        }
      }

      channelRef.current = null;
    };
  }, [userId, accessToken, refreshInbox]);

  useEffect(() => {
    if (!userId || !accessToken) return;

    const syncInbox = () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      ) {
        return;
      }
      void refreshInbox({ silent: true, minIntervalMs: 15_000 });
    };

    window.addEventListener('focus', syncInbox);
    document.addEventListener('visibilitychange', syncInbox);

    return () => {
      window.removeEventListener('focus', syncInbox);
      document.removeEventListener('visibilitychange', syncInbox);
    };
  }, [userId, accessToken, refreshInbox]);

  const value: ChatInboxContextValue = useMemo(
    () => ({
      rooms,
      totalUnread,
      loading,
      error,
      refetch,
      markRoomRead,
    }),
    [rooms, totalUnread, loading, error, refetch, markRoomRead],
  );

  return (
    <ChatInboxContext.Provider value={value}>
      {children}
    </ChatInboxContext.Provider>
  );
}

const defaultValue: ChatInboxContextValue = {
  rooms: [],
  totalUnread: 0,
  loading: false,
  error: null,
  refetch: async () => {},
  markRoomRead: () => {},
};

export function useChatInbox() {
  const ctx = useContext(ChatInboxContext);
  return ctx ?? defaultValue;
}
