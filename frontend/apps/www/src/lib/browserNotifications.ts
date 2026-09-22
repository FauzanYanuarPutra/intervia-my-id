'use client';

export type BrowserNotificationPayload = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
  renotify?: boolean;
  actions?: Array<{ action: string; title: string }>;
};

const NOTIFICATION_SW_URL = '/notification-sw.js';
const NOTIFICATION_SW_SCOPE = '/notification-worker/';

export function isBrowserNotificationSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

export async function ensureNotificationServiceWorkerRegistered() {
  if (!isBrowserNotificationSupported()) return null;

  try {
    const existing = await navigator.serviceWorker.getRegistration(
      NOTIFICATION_SW_SCOPE,
    );
    if (existing) {
      return existing;
    }

    return await navigator.serviceWorker.register(NOTIFICATION_SW_URL, {
      scope: NOTIFICATION_SW_SCOPE,
      updateViaCache: 'none',
    });
  } catch (error) {
    console.warn('[Notifications] service worker registration failed', error);
    return null;
  }
}

export async function requestBrowserNotificationPermission() {
  if (!isBrowserNotificationSupported()) return 'denied' as NotificationPermission;
  return Notification.requestPermission();
}

export async function showBrowserNotification(
  payload: BrowserNotificationPayload,
) {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const resolvedUrl =
    typeof payload.url === 'string' && payload.url.trim()
      ? payload.url
      : '/id/notifications';

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/favicon.png',
    badge: payload.badge || '/favicon.png',
    tag: payload.tag,
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    ...(payload.actions?.length ? { actions: payload.actions } : {}),
    data: { url: resolvedUrl },
  };

  const registration = await ensureNotificationServiceWorkerRegistered();

  if (registration?.showNotification) {
    await registration.showNotification(payload.title, options);
    return true;
  }

  const notification = new Notification(payload.title, options);
  notification.onclick = () => {
    window.focus();
    window.location.href = resolvedUrl;
    notification.close();
  };

  return true;
}


function urlBase64ToUint8Array(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const raw = window.atob(padded);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

export async function closeBrowserNotificationsByTag(tag: string) {
  if (!isBrowserNotificationSupported() || !tag) return;
  try {
    const registration = await ensureNotificationServiceWorkerRegistered();
    if (!registration?.getNotifications) return;
    const notifications = await registration.getNotifications({ tag });
    notifications.forEach(notification => notification.close());
  } catch {
    // Notification cleanup is best-effort.
  }
}

export async function ensureWebPushSubscription(deviceLabel?: string) {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const registration = await ensureNotificationServiceWorkerRegistered();
    if (!registration?.pushManager) return false;

    const configResponse = await fetch('/api/notifications/push/subscriptions', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
    if (!configResponse.ok) return false;

    const config = (await configResponse.json().catch(() => ({}))) as {
      enabled?: boolean;
      publicKey?: string | null;
    };
    if (!config.enabled || !config.publicKey) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
    }

    const json = subscription.toJSON();
    const endpoint = json.endpoint || subscription.endpoint;
    const p256dh = json.keys?.p256dh || '';
    const auth = json.keys?.auth || '';
    if (!endpoint || !p256dh || !auth) return false;

    const saveResponse = await fetch(
      '/api/notifications/push/subscriptions',
      {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          p256dh,
          auth,
          deviceLabel:
            deviceLabel ||
            (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : 'web'),
        }),
      },
    );

    return saveResponse.ok;
  } catch (error) {
    console.warn('[Notifications] push subscription sync failed', error);
    return false;
  }
}


export async function disableWebPushSubscription() {
  if (!isBrowserNotificationSupported()) return false;

  try {
    const registration = await ensureNotificationServiceWorkerRegistered();
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return true;

    await fetch('/api/notifications/push/subscriptions', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => null);

    await subscription.unsubscribe().catch(() => false);
    return true;
  } catch (error) {
    console.warn('[Notifications] push subscription disable failed', error);
    return false;
  }
}
