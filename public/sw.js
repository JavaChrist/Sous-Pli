const CACHE = "souspli-static-v1";
const PRECACHE = ["/hors-ligne", "/favicon.ico", "/favicon.svg", "/logo512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/version.json" || url.pathname === "/sw.js") return;
  if (url.pathname.startsWith("/invitation") || url.pathname.startsWith("/rejoindre") || url.pathname.startsWith("/compte") || url.pathname.startsWith("/mot-de-passe-oublie")) return;

  if (/\.(png|svg|ico|webp)$/.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(request, copy));
      return response;
    })));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/hors-ligne")) || new Response("Hors connexion", { status: 503 })));
  }
});
