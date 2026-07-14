self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('realtime-kanban-board-store').then((cache) => cache.addAll([
      '/',
    ])),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
