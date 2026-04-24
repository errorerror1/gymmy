// Service worker that makes GymTracker installable and usable offline.
//
// Strategy:
//   - Navigation requests (HTML):  network-first, fall back to cached
//     /index.html. This lets a newly deployed index.html take over as
//     soon as the user is online, without ever showing a blank page
//     when they're offline.
//   - Everything else:             cache-first. Expo's web export
//     content-hashes every JS and asset URL (/_expo/static/js/...), so
//     cache entries never need to be busted — a new deploy serves new
//     filenames. Old hashed files are cleaned up by the cache-version
//     bump on activate.
//
// When you deploy a code change: bump CACHE_VERSION. On next visit the
// browser fetches this file, notices it's different, installs the new
// worker, activates it (skipWaiting + clients.claim below), and the
// "activate" handler deletes the previous cache in one shot.

const CACHE_VERSION = 'v3';
const CACHE_NAME = `gymtracker-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('gymtracker-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GETs. Skip POSTs, cross-origin fetches, etc.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put('/index.html', response.clone());
          return response;
        } catch {
          const cached = await caches.match('/index.html');
          return cached ?? Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response && response.status === 200 && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    })()
  );
});
