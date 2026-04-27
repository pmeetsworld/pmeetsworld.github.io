// ── Service Worker ───────────────────────────────────────────────────────────
// Increment CACHE_VERSION every time you push updated app files.
// This forces browsers to download the new version on next visit.
const CACHE_VERSION = 'r508-v14';

self.addEventListener('install', event => {
  // Derive base URL from SW location — works at / or /route508/ or any subfolder
  const base = self.location.href.replace('sw.js', '');
  const FILES = [
    base,
    base + 'index.html',
    base + 'style.css',
    base + 'manifest.json',
    base + 'icon-192.png',
    base + 'icon-512.png',
    base + 'js/config.js',
    base + 'js/data.js',
    base + 'js/app.js',
    'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  ];
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request.mode === 'navigate'
        ? new Request(self.registration.scope + 'index.html')
        : event.request
      ));
    })
  );
});
