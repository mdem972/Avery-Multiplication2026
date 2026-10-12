/* Offline support for both math games. Bump CACHE to force everyone to re-download. */
const CACHE = "math-games-v1";
const FILES = [
  "./", "index.html", "grade5.html",
  "manifest.json", "manifest-grade5.json",
  "icon-avery-180.png", "icon-avery-192.png", "icon-avery-512.png",
  "icon-g5-180.png", "icon-g5-192.png", "icon-g5-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Saved copy first (so it opens instantly, even with no internet), then refresh it quietly in the
// background so the next visit has any updates.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const key = new Request(url.origin + url.pathname);            // ignore ?v=5 style cache-busters
    const net = fetch(req).then((res) => {
      if (res && res.ok && res.type === "basic") cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    const res = await net;
    if (res) return res;
    if (req.mode === "navigate") { const fb = await cache.match("index.html"); if (fb) return fb; }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }));
});
