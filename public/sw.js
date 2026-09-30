/* Basic service worker for TaskTimmer */
const CACHE_VERSION = 'v6';
const PRECACHE = `precache-${CACHE_VERSION}`;
const RUNTIME = `runtime-${CACHE_VERSION}`;

// Resources to precache (shell)
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/favicon.ico'
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
        fetch(request).catch(() => caches.match('/offline.html'))
      );
      return;
    }
    // Cache-first only for Next's content-hashed build files: a new deploy means new URLs.
    // (Dev-server chunks keep the same URL between edits, so they must never be served from cache.)
    const local = ['localhost', '127.0.0.1'].includes(self.location.hostname);
    if (!local && url.pathname.startsWith('/_next/static/')) {
      event.respondWith(
        caches.match(request).then(cached => cached || fetch(request).then(resp => {
          if (resp.ok) { const copy = resp.clone(); caches.open(RUNTIME).then(cache => cache.put(request, copy)); }
          return resp;
        }))
      );
      return;
    }
    // Network-first for other static files (icons, manifest…), cache only as offline fallback.
    if (/\.(?:js|css|png|svg|ico|jpg|jpeg|gif|webp|woff2?|webmanifest)$/i.test(url.pathname)) {
      event.respondWith(
        fetch(request).then(resp => {
          if (resp.ok) { const copy = resp.clone(); caches.open(RUNTIME).then(cache => cache.put(request, copy)); }
          return resp;
        }).catch(() => caches.match(request))
      );
      return;
    }
  }
});
