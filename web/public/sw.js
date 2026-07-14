self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('trello-clone-store').then((cache) => cache.addAll([
      '/',
    ])),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
