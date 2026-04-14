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
