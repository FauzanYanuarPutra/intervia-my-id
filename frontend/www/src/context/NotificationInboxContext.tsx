'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { isMoneyRelatedNotification } from '@/lib/notifications/presentation';

export type InboxNotification = {
  id: string;
  category: string;
  event_type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
};

type NotificationInboxContextValue = {
  items: InboxNotification[];
  unreadCount: number;
  loading: boolean;
  connected: boolean;
  refetch: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

type ListNotificationsResponse = {
  items?: InboxNotification[];
  unread_count?: number;
};

type ReadNotificationResponse = {
  notification?: InboxNotification;
  unread_count?: number;
};

type ReadAllNotificationResponse = {
  unread_count?: number;
};

type SocketNotificationPayload = {
  event?: string;
  unread_count?: number;
  notification?: InboxNotification;
  notification_id?: string;
};

const NotificationInboxContext =
  createContext<NotificationInboxContextValue | null>(null);
const MAX_NOTIFICATION_WS_RECONNECT = 6;
const NETWORK_LOG_COOLDOWN_MS = 30_000;

function isLoopbackHost(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
}

function shouldIgnoreLoopbackWsUrl(candidate: string): boolean {
  if (typeof window === 'undefined') return false;
  const runtimeHost = window.location.hostname;
  if (isLoopbackHost(runtimeHost)) return false;

  try {
    return isLoopbackHost(new URL(candidate).hostname);
  } catch {
    return false;
  }
}

function resolveNotificationWsBaseUrl(): string | null {
  const explicitCandidates = [
    process.env.NEXT_PUBLIC_NOTIFICATION_WS_URL?.trim(),
    process.env.NEXT_PUBLIC_MARKETPLACE_WS_URL?.trim(),
  ].filter(Boolean) as string[];

  for (const explicit of explicitCandidates) {
    const normalized = explicit.replace(/\/$/, '');
    if (!shouldIgnoreLoopbackWsUrl(normalized)) {
      return normalized;
    }
  }

  const marketplaceHttp = process.env.NEXT_PUBLIC_MARKETPLACE_URL?.trim();
  if (marketplaceHttp) {
    const normalized = marketplaceHttp
      .replace(/^http:\/\//i, 'ws://')
      .replace(/^https:\/\//i, 'wss://')
      .replace(/\/$/, '');
    if (!shouldIgnoreLoopbackWsUrl(normalized)) {
      return normalized;
    }
  }

  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (isLocal) {
      return `${proto}://${host}:8081`;
    }
  }

  // For public hosts we require an explicit WS base to avoid broken same-origin
  // websocket attempts when the edge proxy doesn't route /v1/notifications/stream.
  return null;
}

function dedupeNotifications(items: InboxNotification[]): InboxNotification[] {
  const seen = new Set<string>();
  const result: InboxNotification[] = [];
  for (const item of items) {
    const id = String(item.id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }
  return result;
}

function shouldShowNotification(item: InboxNotification): boolean {
  if (!PROMO_ONLY_MODE) return true;
  return !isMoneyRelatedNotification({
    category: item.category,
    eventType: item.event_type,
    title: item.title,
    message: item.message,
  });
}

function visibleNotifications(items: InboxNotification[]): InboxNotification[] {
  return PROMO_ONLY_MODE ? items.filter(shouldShowNotification) : items;
}

function unreadNotificationCount(items: InboxNotification[]): number {
  return items.reduce((total, item) => total + Number(!item.is_read), 0);
}

export function NotificationInboxProvider({ children }: { children: ReactNode }) {
  const { user, accessToken, authFetch } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const seenToastRef = useRef<Set<string>>(new Set());
  const socketEnabledRef = useRef(false);
  const lastNetworkLogRef = useRef(0);

  const userId = user?.id || null;

  const logNetworkIssue = useCallback((label: string, error: unknown) => {
    const now = Date.now();
    if (now - lastNetworkLogRef.current < NETWORK_LOG_COOLDOWN_MS) return;
    lastNetworkLogRef.current = now;
    console.error(label, error);
  }, []);

  const clearSocket = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const activeSocket = wsRef.current;
    wsRef.current = null;
    if (activeSocket) {
      try {
        activeSocket.close();
      } catch {
        // ignore socket close error
      }
    }
    setConnected(false);
  }, []);

  const refetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/notifications?limit=30&offset=0', {
        cache: 'no-store',
      });
      const payload = (await res.json().catch(() => ({}))) as ListNotificationsResponse;
      if (!res.ok) {
        throw new Error('Failed to load notifications');
      }
      const nextItems = visibleNotifications(
        dedupeNotifications(Array.isArray(payload.items) ? payload.items : []),
      );
      setItems(nextItems);
      if (PROMO_ONLY_MODE) {
        setUnreadCount(unreadNotificationCount(nextItems));
      } else if (typeof payload.unread_count === 'number') {
        setUnreadCount(Math.max(0, payload.unread_count));
      }
    } catch (error) {
      logNetworkIssue('[NotificationInbox] refetch error', error);
    } finally {
      setLoading(false);
    }
  }, [authFetch, logNetworkIssue, userId]);

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) return;
    if (PROMO_ONLY_MODE) {
      try {
        const res = await authFetch('/api/notifications?limit=30&offset=0', {
          cache: 'no-store',
        });
        const payload = (await res
          .json()
          .catch(() => ({}))) as ListNotificationsResponse;
        if (!res.ok) {
          throw new Error('Failed to load notification unread count');
        }
        const nextItems = visibleNotifications(
          dedupeNotifications(Array.isArray(payload.items) ? payload.items : []),
        );
        setItems(nextItems);
        setUnreadCount(unreadNotificationCount(nextItems));
      } catch (error) {
        logNetworkIssue('[NotificationInbox] promo unread-count error', error);
      }
      return;
    }
    try {
      const res = await authFetch('/api/notifications/unread-count', {
        cache: 'no-store',
      });
      const payload = (await res.json().catch(() => ({}))) as { unread_count?: number };
      if (res.ok && typeof payload.unread_count === 'number') {
        setUnreadCount(Math.max(0, payload.unread_count));
      }
    } catch (error) {
      logNetworkIssue('[NotificationInbox] unread-count error', error);
    }
  }, [authFetch, logNetworkIssue, userId]);

  const markRead = useCallback(
    async (id: string) => {
      if (!id) return;
      const res = await authFetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST',
      });
      const payload = (await res.json().catch(() => ({}))) as ReadNotificationResponse;
      if (!res.ok) {
        throw new Error('Failed to mark notification as read');
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                is_read: true,
                read_at: payload.notification?.read_at || new Date().toISOString(),
              }
            : item,
        ),
      );
      if (PROMO_ONLY_MODE) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else if (typeof payload.unread_count === 'number') {
        setUnreadCount(Math.max(0, payload.unread_count));
      } else {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    },
    [authFetch],
  );

  const markAllRead = useCallback(async () => {
    const res = await authFetch('/api/notifications/read-all', { method: 'POST' });
    const payload = (await res.json().catch(() => ({}))) as ReadAllNotificationResponse;
    if (!res.ok) {
      throw new Error('Failed to mark all notifications as read');
    }
    setItems((prev) =>
      prev.map((item) =>
        item.is_read
          ? item
          : { ...item, is_read: true, read_at: new Date().toISOString() },
      ),
    );
    if (PROMO_ONLY_MODE) {
      setUnreadCount(0);
    } else if (typeof payload.unread_count === 'number') {
      setUnreadCount(Math.max(0, payload.unread_count));
    } else {
      setUnreadCount(0);
    }
  }, [authFetch]);

  const scheduleReconnect = useCallback(
    (token: string) => {
      if (!userId || !socketEnabledRef.current) return;
      const attempt = Math.min(reconnectAttemptRef.current + 1, 8);
      reconnectAttemptRef.current = attempt;
      if (attempt > MAX_NOTIFICATION_WS_RECONNECT) {
        socketEnabledRef.current = false;
        setConnected(false);
        return;
      }
      const waitMs = Math.min(20_000, 600 * 2 ** attempt);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = setTimeout(() => {
        if (!socketEnabledRef.current) return;
        const base = resolveNotificationWsBaseUrl();
        if (!base) {
          socketEnabledRef.current = false;
          setConnected(false);
          return;
        }
        const wsUrl = `${base}/v1/notifications/stream?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        const isActiveSocket = () => wsRef.current === ws;
        ws.onopen = () => {
          if (!isActiveSocket()) {
            try {
              ws.close();
            } catch {
              // ignore socket close error
            }
            return;
          }
          reconnectAttemptRef.current = 0;
          setConnected(true);
          void refreshUnreadCount();
        };
        ws.onclose = () => {
          if (!isActiveSocket()) return;
          wsRef.current = null;
          setConnected(false);
          if (socketEnabledRef.current) {
            scheduleReconnect(token);
          }
        };
        ws.onerror = () => {
          if (!isActiveSocket()) return;
          setConnected(false);
        };
        ws.onmessage = (message) => {
          if (!isActiveSocket()) return;
          let payload: SocketNotificationPayload | null = null;
          try {
            payload = JSON.parse(String(message.data || '{}')) as SocketNotificationPayload;
          } catch {
            return;
          }
          if (!payload || typeof payload !== 'object') return;

          if (!PROMO_ONLY_MODE && typeof payload.unread_count === 'number') {
            setUnreadCount(Math.max(0, payload.unread_count));
          }

          if (payload.event === 'notification.created' && payload.notification) {
            const notification = payload.notification;
            if (!shouldShowNotification(notification)) return;

            setItems((prev) =>
              dedupeNotifications([notification, ...prev]).sort(
                (a, b) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
              ),
            );

            if (!notification.is_read) {
              setUnreadCount((prev) => prev + 1);
            }

            if (!seenToastRef.current.has(notification.id)) {
              seenToastRef.current.add(notification.id);
              notify({
                title: notification.title || 'Info baru',
                description: notification.message || '',
                variant:
                  notification.category === 'wallet'
                    ? 'success'
                    : notification.category === 'security'
                      ? 'error'
                      : 'info',
              });
            }

            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('marketplace:notification', {
                  detail: notification,
                }),
              );
            }
          }

          if (payload.event === 'notification.read' && payload.notification_id) {
            setItems((prev) =>
              prev.map((item) =>
                item.id === payload.notification_id
                  ? { ...item, is_read: true, read_at: new Date().toISOString() }
                  : item,
              ),
            );
          }

          if (payload.event === 'notification.read_all') {
            setItems((prev) =>
              prev.map((item) => ({ ...item, is_read: true, read_at: new Date().toISOString() })),
            );
            setUnreadCount(0);
          }
        };
      }, waitMs);
    },
    [notify, refreshUnreadCount, userId],
  );

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setUnreadCount(0);
      clearSocket();
      return;
    }
    void refetch();
  }, [clearSocket, refetch, userId]);

  useEffect(() => {
    if (!userId || !accessToken) {
      socketEnabledRef.current = false;
      clearSocket();
      return;
    }

    if (!resolveNotificationWsBaseUrl()) {
      socketEnabledRef.current = false;
      clearSocket();
      return;
    }

    socketEnabledRef.current = true;
    clearSocket();
    reconnectAttemptRef.current = 0;
    scheduleReconnect(accessToken);

    return () => {
      socketEnabledRef.current = false;
      clearSocket();
    };
  }, [accessToken, clearSocket, scheduleReconnect, userId]);

  useEffect(() => {
    if (!userId) return;
    if (connected) return;

    const timer = setInterval(() => {
      void refreshUnreadCount();
    }, 15000);
    return () => clearInterval(timer);
  }, [connected, refreshUnreadCount, userId]);

  const value = useMemo<NotificationInboxContextValue>(
    () => ({
      items,
      unreadCount,
      loading,
      connected,
      refetch,
      markRead,
      markAllRead,
    }),
    [connected, items, loading, markAllRead, markRead, refetch, unreadCount],
  );

  return (
    <NotificationInboxContext.Provider value={value}>
      {children}
    </NotificationInboxContext.Provider>
  );
}

const fallbackValue: NotificationInboxContextValue = {
  items: [],
  unreadCount: 0,
  loading: false,
  connected: false,
  refetch: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
};

export function useNotificationInbox() {
  const value = useContext(NotificationInboxContext);
  return value ?? fallbackValue;
}
