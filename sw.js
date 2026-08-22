const CACHE_NAME = "alpenglow-shell-v1.1.0-r6";

const SHELL = [
  "./",
  "./index.html",
  "./release-loader.js?v=1.1.0",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./styles/tokens.css?v=1.1.0",
  "./styles/base.css?v=1.1.0",
  "./styles/components.css?v=1.1.0",
  "./styles/screens.css?v=1.1.0",
  "./vendor/lucide.min.js",
  "./vendor/xlsx.full.min.js",
  "./vendor/jszip.min.js",
  "./assets/fonts/dm-sans.ttf",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./src/app.js?v=1.1.0",
  "./src/config.js?v=1.1.0",
  "./src/state/schema.js?v=1.1.0",
  "./src/state/store.js?v=1.1.0",
  "./src/state/idb.js?v=1.1.0",
  "./src/domain/dates.js?v=1.1.0",
  "./src/domain/identity.js?v=1.1.0",
  "./src/domain/health.js?v=1.1.0",
  "./src/domain/execution.js?v=1.1.0",
  "./src/domain/legacy.js?v=1.1.0",
  "./src/domain/reports.js?v=1.1.0",
  "./src/domain/backup.js?v=1.1.0",
  "./src/domain/media.js?v=1.1.0",
  "./src/domain/pricing.js?v=1.1.0",
  "./src/domain/sample.js?v=1.1.0",
  "./src/ui/components.js?v=1.1.0",
  "./src/ui/screens/home.js?v=1.1.0",
  "./src/ui/screens/route.js?v=1.1.0",
  "./src/ui/screens/focus.js?v=1.1.0",
  "./src/ui/screens/account.js?v=1.1.0",
  "./src/ui/screens/activity.js?v=1.1.0",
  "./src/ui/screens/more.js?v=1.1.0",
  "./src/ui/screens/import.js?v=1.1.0",
  "./data/elite-2026-08-22.json",
  "./data/preorders-2026-08-22.json",
  "./data/pfp-2026-08-22.json",
  "./data/perfect-launch-2026-08-17.csv"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response?.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => {
    const network = fetch(event.request).then((response) => {
      if (response?.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    });
    if (cached) {
      event.waitUntil(network.catch(() => undefined));
      return cached;
    }
    return network;
  }));
});
