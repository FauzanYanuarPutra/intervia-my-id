'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { soundManager } from '@/lib/soundManager';
import {
  ensureNotificationServiceWorkerRegistered,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from '@/lib/browserNotifications';
import type { InboxNotification } from '@/context/NotificationInboxContext';

type ChatMessageNotificationDetail = {
  id: string;
  roomId: string;
  roomName: string;
  roomAvatar?: string;
  message: string;
  unreadCount: number;
  lastMessageAt?: string;
  url: string;
};

type IncomingCallNotificationDetail = {
  call_id: string;
  room_id: string;
  caller_id: string;
  caller_username: string;
  caller_avatar?: string;
  call_type: 'video' | 'voice';
  url: string;
};

function currentPathname() {
  if (typeof window === 'undefined') return '';
  return window.location.pathname || '';
}

function currentLocale() {
  const match = currentPathname().match(/^\/(id|en)(?:\/|$)/);
  return match?.[1] || 'id';
}

function currentChatRoomId() {
  const match = currentPathname().match(/^\/(?:id|en)\/chat\/([^/?#]+)/);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function shouldSuppressChatNotification(roomId: string) {
  return (
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    currentChatRoomId() === roomId
  );
}

function playBackgroundSound(sound: 'messageReceive' | 'callAlert') {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return;
  }
  soundManager.play(sound);
}

function runWhenIdle(task: () => void, timeout = 1800) {
  if (typeof window === 'undefined') return () => {};
  const idleWindow = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const idleId = idleWindow.requestIdleCallback(task, { timeout });
    return () => idleWindow.cancelIdleCallback?.(idleId);
  }

  const timeoutId = globalThis.setTimeout(task, Math.min(timeout, 600));
  return () => globalThis.clearTimeout(timeoutId);
}

export function BrowserNotificationBridge() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isBrowserNotificationSupported()) return;
    return runWhenIdle(() => {
      void ensureNotificationServiceWorkerRegistered();
    });
  }, [user]);

  useEffect(() => {
    if (!user || !isBrowserNotificationSupported()) return;
    if (Notification.permission !== 'default') return;

    const promptKey = `lajukan:notifications:prompted:v1:${user.id}`;
    if (window.localStorage.getItem(promptKey) === 'done') return;

    let cancelIdle: (() => void) | null = null;
    let promptScheduled = false;
    const options: AddEventListenerOptions = {
      passive: true,
      capture: true,
    };
    const cleanupPromptListeners = () => {
      window.removeEventListener('pointerdown', requestPermission, options);
      window.removeEventListener('keydown', requestPermission, options);
      window.removeEventListener('touchstart', requestPermission, options);
    };
    const requestPermission = () => {
      if (promptScheduled) return;
      promptScheduled = true;
      cleanupPromptListeners();

      cancelIdle = runWhenIdle(() => {
        window.localStorage.setItem(promptKey, 'done');
        void requestBrowserNotificationPermission().then(permission => {
          if (permission === 'granted') {
            void ensureNotificationServiceWorkerRegistered();
          }
        });
      });
    };

    window.addEventListener('pointerdown', requestPermission, options);
    window.addEventListener('keydown', requestPermission, options);
    window.addEventListener('touchstart', requestPermission, options);

    return () => {
      cancelIdle?.();
      cleanupPromptListeners();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const onMarketplaceNotification = (event: Event) => {
      const detail = (event as CustomEvent<InboxNotification>).detail;
      if (!detail || typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') return;

      void showBrowserNotification({
        title: detail.title || 'Lajukan',
        body: detail.message || '',
        tag: `marketplace:${detail.id}`,
        url: `/${currentLocale()}/notifications`,
      });
    };

    const onChatMessageNotification = (event: Event) => {
      const detail = (event as CustomEvent<ChatMessageNotificationDetail>).detail;
      if (!detail || shouldSuppressChatNotification(detail.roomId)) return;

      playBackgroundSound('messageReceive');
      void showBrowserNotification({
        title: detail.roomName || 'Pesan baru',
        body: detail.message || 'Ada pesan baru.',
        icon: detail.roomAvatar || '/favicon.png',
        tag: `chat-message:${detail.id}`,
        url: detail.url,
      });
    };

    const onIncomingCallNotification = (event: Event) => {
      const detail = (event as CustomEvent<IncomingCallNotificationDetail>).detail;
      if (!detail || shouldSuppressChatNotification(detail.room_id)) return;

      const title =
        currentLocale() === 'id'
          ? detail.call_type === 'video'
            ? 'Panggilan video masuk'
            : 'Panggilan suara masuk'
          : detail.call_type === 'video'
            ? 'Incoming video call'
            : 'Incoming voice call';
      const body =
        currentLocale() === 'id'
          ? `${detail.caller_username} menghubungi kamu`
          : `${detail.caller_username} is calling you`;

      playBackgroundSound('callAlert');
      void showBrowserNotification({
        title,
        body,
        icon: detail.caller_avatar || '/favicon.png',
        tag: `incoming-call:${detail.call_id}`,
        url: detail.url,
        renotify: true,
        requireInteraction: true,
      });
    };

    window.addEventListener(
      'marketplace:notification',
      onMarketplaceNotification as EventListener,
    );
    window.addEventListener(
      'chat:message-notification',
      onChatMessageNotification as EventListener,
    );
    window.addEventListener(
      'chat:incoming-call',
      onIncomingCallNotification as EventListener,
    );

    return () => {
      window.removeEventListener(
        'marketplace:notification',
        onMarketplaceNotification as EventListener,
      );
      window.removeEventListener(
        'chat:message-notification',
        onChatMessageNotification as EventListener,
      );
      window.removeEventListener(
        'chat:incoming-call',
        onIncomingCallNotification as EventListener,
      );
    };
  }, [user]);

  return null;
}
