
const CACHE_NAME = "asistencia-qr-v4";

const ARCHIVOS = [
  "./",
  "./index.html",
  "./estilos.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./lib/html5-qrcode.mim.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // No interceptar API de Google ni otras solicitudes externas.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Para archivos de la aplicación: red primero, caché como respaldo.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copia = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copia))
            .catch(error => console.warn("No se pudo actualizar la caché:", error));
        }

        return response;
      })
      .catch(async () => {
        const guardada = await caches.match(request);

        if (guardada) {
          return guardada;
        }

        return new Response(
          "Sin conexión y sin copia local disponible.",
          {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          }
        );
      })
  );
});
