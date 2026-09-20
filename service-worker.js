const CACHE_NAME = "asistencia-v1";

const ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./service-worker.js",
  "./lib/html5-qrcode.min.js"
];


// ==========================================================
// INSTALACIÓN
// ==========================================================

self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME)

      .then(cache => {

        return cache.addAll(ARCHIVOS);

      })

  );

  self.skipWaiting();

});


// ==========================================================
// ACTIVACIÓN
// ==========================================================

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()
      .then(keys => {

        return Promise.all(

          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))

        );

      })

  );

  self.clients.claim();

});


// ==========================================================
// PETICIONES
// ==========================================================

self.addEventListener("fetch", event => {

  const request = event.request;


  // Solo GET
  if (request.method !== "GET") {
    return;
  }


  event.respondWith(

    caches.match(request)

      .then(cachedResponse => {

        if (cachedResponse) {

          return cachedResponse;

        }


        return fetch(request)

          .then(response => {

            return response;

          })

          .catch(() => {

            return caches.match("./index.html");

          });

      })

  );

});
