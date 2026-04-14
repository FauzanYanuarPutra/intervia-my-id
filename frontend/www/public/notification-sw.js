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

  event.waitUntil(
    self.registration.showNotification(payload.title || fallback.title, {
      body: payload.body || '',
      icon: payload.icon || fallback.icon,
      badge: payload.badge || fallback.badge,
      tag: payload.tag,
      renotify: Boolean(payload.renotify),
      requireInteraction: Boolean(payload.requireInteraction),
      data: payload.data || fallback.data,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = typeof data.url === 'string' && data.url ? data.url : '/id/notifications';

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
            const desired = new URL(targetUrl, self.location.origin);

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
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
