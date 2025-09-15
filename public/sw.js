/* Basic service worker for TaskTimmer */
const CACHE_VERSION = 'v3';
const PRECACHE = `precache-${CACHE_VERSION}`;
const RUNTIME = `runtime-${CACHE_VERSION}`;

// Resources to precache (shell)
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon-clock-pixel.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE).then(cache => cache.addAll(PRECACHE_URLS)).then(self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![PRECACHE, RUNTIME].includes(k)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return; // pass through non-GET

  // Runtime caching for same-origin navigations & static assets
  if (url.origin === self.location.origin) {
    // Network-first for navigation requests
    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request).then(resp => {
          const copy = resp.clone();
          caches.open(RUNTIME).then(cache => cache.put(request, copy));
          return resp;
        }).catch(() => caches.match(request).then(r => r || caches.match('/')))
      );
      return;
    }
    // Cache-first for static assets
    if (/\.(?:js|css|png|svg|ico|jpg|jpeg|gif|webp|woff2?)$/i.test(url.pathname)) {
      event.respondWith(
        caches.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(resp => {
            const copy = resp.clone();
            caches.open(RUNTIME).then(cache => cache.put(request, copy));
            return resp;
          });
        })
      );
      return;
    }
  }
});
