/* Route 508 Alpenglow service worker. */
const CACHE_VERSION = "r508-alpenglow-v0-10-package-72-account-task-ctas";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./assets/alpenglow-mountain.png",
  "./assets/alpenglow-abstract-bgv2.png",
  "./assets/508BG.png",
  "./assets/dark-liquid-bg.jpg",
  "./assets/frost-noise.svg",
  "./js/app.js",
  "./js/data/seed.js",
  "./js/data/migration.js",
  "./js/data/import-report.json",
  "./js/core/utils.js",
  "./js/core/store.js",
  "./js/core/selectors.js",
  "./js/core/pricing.js",
  "./js/core/media.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return caches.match(event.request);
      });
    })
  );
});





