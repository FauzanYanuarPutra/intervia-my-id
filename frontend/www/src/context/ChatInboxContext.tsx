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
import { ensureSocketConnected } from '@/lib/socket';
import { joinUserChannel } from '@/lib/chat';
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
  refetch: () => Promise<void>;
};

type InboxRoomSnapshot = {
  roomId: string;
  roomName: string;
  roomAvatar: string;
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
  call_type?: 'video' | 'voice';
};

const ChatInboxContext = createContext<ChatInboxContextValue | undefined>(undefined);

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
    lastMessage: String(room.last_message ?? room.lastMsg ?? ''),
    lastMessageAt: String(room.last_message_at ?? ''),
    unreadCount: Number(room.unread_count ?? 0),
    lastSender: String(room.last_sender ?? '').toLowerCase(),
  };
}

export function ChatInboxProvider({ children }: { children: ReactNode }) {
  const { user, accessToken, authFetch } = useAuth();
  const userId = user?.id;
  const [rooms, setRooms] = useState<InboxRoom[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<Channel | null>(null);
  const initialLoadedRef = useRef(false);
  const inboxUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomSnapshotRef = useRef<Map<string, InboxRoomSnapshot>>(new Map());

  const toSignature = useCallback((list: InboxRoom[]) => {
    return list
      .map((r) => {
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

      list.forEach((room) => {
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
      },
    ) => {
      if (options?.emitChatMessageNotifications) {
        emitChatMessageNotifications(list);
      } else {
        roomSnapshotRef.current = new Map(
          list
            .map((room) => buildRoomSnapshot(room))
            .filter((snapshot): snapshot is InboxRoomSnapshot => snapshot !== null)
            .map((snapshot) => [snapshot.roomId, snapshot]),
        );
      }

      setRooms((prev) => {
        const prevSig = toSignature(prev);
        const nextSig = toSignature(list);
        if (prevSig === nextSig) return prev;
        return list;
      });

      const total = list.reduce((acc, r) => {
        const unread = Number(r.unread_count ?? 0);
        const lastSender = String(r.last_sender ?? '').toLowerCase();
        const isOwnLast = Boolean(userId) && lastSender && lastSender === String(userId).toLowerCase();
        return acc + (isOwnLast ? 0 : unread);
      }, 0);
      setTotalUnread((prev) => (prev === total ? prev : total));
    },
    [emitChatMessageNotifications, toSignature, userId],
  );

  const refetch = useCallback(async (opts?: { silent?: boolean }) => {
    if (!userId) return;
    const silent = opts?.silent ?? false;
    try {
      if (!silent && !initialLoadedRef.current) setLoading(true);
      const res = await authFetch('/api/chat/inbox', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const list = (data.data || []) as InboxRoom[];
        applyInbox(list, {
          emitChatMessageNotifications: silent && initialLoadedRef.current,
        });
        initialLoadedRef.current = true;
      }
    } catch (err) {
      console.error('ChatInbox refetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [userId, authFetch, applyInbox]);

  // Inisialisasi WebSocket begitu user login agar koneksi tampil di Network tab
  useEffect(() => {
    if (!accessToken) return;
    try {
      ensureSocketConnected(accessToken);
    } catch (err) {
      console.warn('[ChatInbox] Socket init failed', err);
    }
  }, [accessToken]);

  // Initial fetch + join user channel untuk inbox_updated
  useEffect(() => {
    if (!userId || !accessToken) {
      setRooms([]);
      setTotalUnread(0);
      setLoading(false);
      initialLoadedRef.current = false;
      roomSnapshotRef.current = new Map();
      return;
    }
    refetch({ silent: false });
  }, [userId, accessToken, refetch]);

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
              refetch({ silent: true });
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
  }, [userId, accessToken, refetch]);

  const value: ChatInboxContextValue = useMemo(
    () => ({
      rooms,
      totalUnread,
      loading,
      refetch: () => refetch({ silent: false }),
    }),
    [rooms, totalUnread, loading, refetch],
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
  refetch: async () => {},
};

export function useChatInbox() {
  const ctx = useContext(ChatInboxContext);
  return ctx ?? defaultValue;
}
