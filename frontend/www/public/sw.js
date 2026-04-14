self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      } catch {
        // ignore cache cleanup errors
      }

      await self.registration.unregister();

      const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window',
      });

      clients.forEach((client) => {
        if ('navigate' in client) {
          client.navigate(client.url);
        }
      });
    })(),
  );
});
