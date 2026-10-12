/* Offline support for both math games. Bump CACHE to force everyone to re-download. */
const CACHE = "math-games-v2";
const FILES = [
  "./", "index.html", "grade5.html",
  "manifest.json", "manifest-grade5.json",
  "icon-avery-180.png", "icon-avery-192.png", "icon-avery-512.png",
  "icon-g5-180.png", "icon-g5-192.png", "icon-g5-512.png"
];
const NET_TIMEOUT_MS = 3500;

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

function isPage(req, url) {
  return req.mode === "navigate" || req.destination === "document" ||
         /\.html$/.test(url.pathname) || /\/$/.test(url.pathname);
}

// Game pages (and downloads of them): ask the internet first so you always get the newest version,
// but fall back to the saved copy when offline or when the connection is slow.
// Everything else (icons, manifests): saved copy first.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const key = new Request(url.origin + url.pathname);              // ignore ?v=5 style cache-busters

  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const net = fetch(req).then((res) => {
      if (res && res.ok && res.type === "basic") cache.put(key, res.clone());
      return res;
    });
    const quiet = net.catch(() => null);
    if (isPage(req, url)) {
      e.waitUntil(quiet);
      const first = await Promise.race([quiet, new Promise((r) => setTimeout(() => r(null), NET_TIMEOUT_MS))]);
      if (first) return first;
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      const late = await quiet;                                    // slow network and nothing saved: keep waiting
      if (late) return late;
      const fb = await cache.match("index.html");
      return fb || new Response("Offline", { status: 503, statusText: "Offline" });
    }
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) { e.waitUntil(quiet); return cached; }
    const res = await quiet;
    return res || new Response("Offline", { status: 503, statusText: "Offline" });
  }));
});
