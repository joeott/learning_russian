/* За столо́м — offline app shell cache */
const CACHE = "zastolom-v9";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./learning_metrics.js",
  "./content.js",
  "./audio.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
];
const NETWORK_FIRST = [
  "/web/",
  "/web/index.html",
  "/web/styles.css",
  "/web/app.js",
  "/web/learning_metrics.js",
  "/web/content.js",
  "/web/audio.js",
];
// MP3 phrase audio (assets/audio/*.mp3) is cached on-demand by the fetch
// handler below the first time each clip plays, so it works offline thereafter.

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function isNetworkFirst(request) {
  const url = new URL(request.url);
  return url.origin === location.origin && NETWORK_FIRST.some((path) => url.pathname.endsWith(path));
}

// network-first for mutable app files; cache fallback for offline use
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (isNetworkFirst(e.request)) {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      // opportunistically cache same-origin GETs
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
