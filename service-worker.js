const CACHE_NAME = "asistencia-qr-v5";

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

// INSTALACIÓN
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        await Promise.all(
          ARCHIVOS.map(async archivo => {
            try {
              await cache.add(
                new Request(archivo, { cache: "reload" })
              );
            } catch (error) {
              console.warn(
                "No se pudo guardar en caché:",
                archivo,
                error
              );
            }
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ACTIVACIÓN
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// INTERCEPTAR SOLICITUDES
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copia = response.clone();

          event.waitUntil(
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, copia))
              .catch(error => {
                console.warn(
                  "Error actualizando caché:",
                  error
                );
              })
          );
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
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      })
  );
});
