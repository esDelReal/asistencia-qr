const CACHE_NAME = "asistencia-qr-v6";
const CORE = [
  "./", "./index.html", "./estilos.css", "./app.js",
  "./lib/html5-qrcode.min.js"
];
const OPTIONAL = ["./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Si falta un archivo esencial, no activar una versión offline incompleta.
    await cache.addAll(CORE.map(path => new Request(path, { cache: "reload" })));
    await Promise.all(OPTIONAL.map(async path => {
      try { await cache.add(new Request(path, { cache: "reload" })); }
      catch (error) { console.warn("Archivo opcional no guardado:", path, error); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("asistencia-qr-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    // Los recursos de la interfaz abren inmediatamente desde caché.
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        event.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    } catch (error) {
      if (request.mode === "navigate") {
        const fallback = await cache.match("./index.html");
        if (fallback) return fallback;
      }
      return new Response("Recurso no disponible sin conexión.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
