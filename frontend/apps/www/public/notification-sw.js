self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Lajukan',
    body: '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { url: '/id/notifications' },
  };

  let payload = fallback;

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = {
          ...fallback,
          ...parsed,
          data: {
            ...fallback.data,
            ...(parsed.data && typeof parsed.data === 'object' ? parsed.data : {}),
          },
        };
      }
    } catch {
      payload = {
        ...fallback,
        body: event.data.text(),
      };
    }
  }

  const isIncomingCall = payload.type === 'incoming_call';
  const isCallCleanup = payload.type === 'call_end';

  if (isCallCleanup) {
    const tag =
      typeof payload.tag === 'string' && payload.tag
        ? payload.tag
        : typeof payload.call_id === 'string' && payload.call_id
          ? 'incoming-call:' + payload.call_id
          : '';

    event.waitUntil(
      self.registration
        .getNotifications(tag ? { tag } : undefined)
        .then(notifications => {
          notifications.forEach(notification => notification.close());
        }),
    );
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || fallback.title, {
      body: payload.body || '',
      icon: payload.icon || fallback.icon,
      badge: payload.badge || fallback.badge,
      tag: payload.tag,
      renotify: Boolean(payload.renotify),
      requireInteraction: Boolean(payload.requireInteraction),
      ...(isIncomingCall
        ? {
            actions: [
              { action: 'accept', title: 'Jawab' },
              { action: 'reject', title: 'Tolak' },
            ],
          }
        : {}),
      data: {
        ...(payload.data || fallback.data),
        url:
          typeof payload.url === 'string' && payload.url
            ? payload.url
            : payload.data?.url || fallback.data.url,
        type: payload.type,
        call_id: payload.call_id,
        room_id: payload.room_id,
        call_type: payload.call_type,
      },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl =
    typeof data.url === 'string' && data.url
      ? data.url
      : '/id/notifications';

  let resolvedTargetUrl = targetUrl;
  if (
    data.type === 'incoming_call' &&
    typeof data.room_id === 'string' &&
    data.room_id &&
    typeof data.call_id === 'string' &&
    data.call_id
  ) {
    const desired = new URL(targetUrl, self.location.origin);
    desired.searchParams.set('incomingCall', '1');
    desired.searchParams.set(
      'callAction',
      event.action === 'accept' || event.action === 'reject'
        ? event.action
        : 'show',
    );
    desired.searchParams.set('callId', data.call_id);
    resolvedTargetUrl = desired.pathname + desired.search;
  }

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clients) {
        if ('focus' in client) {
          try {
            const url = new URL(client.url);
            const desired = new URL(resolvedTargetUrl, self.location.origin);

            if (url.origin === desired.origin) {
              if ('navigate' in client) {
                await client.navigate(desired.href);
              }
              await client.focus();
              return;
            }
          } catch {
            // Ignore malformed client URLs.
          }
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(resolvedTargetUrl);
      }
    })(),
  );
});
