const CACHE_NAME = "asistencia-qr-v1";

const ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://unpkg.com/html5-qrcode"
];

self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME)
      .then(cache => {

        return cache.addAll(
          ARCHIVOS
        );

      })
      .catch(error => {

        console.log(
          "Error guardando archivos:",
          error
        );

      })

  );

  self.skipWaiting();

});


self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()
      .then(keys => {

        return Promise.all(

          keys
            .filter(
              key => key !== CACHE_NAME
            )
            .map(
              key => caches.delete(key)
            )

        );

      })

  );

  self.clients.claim();

});


self.addEventListener("fetch", event => {

  event.respondWith(

    caches.match(event.request)
      .then(cachedResponse => {

        if (cachedResponse) {

          return cachedResponse;

        }

        return fetch(event.request)
          .then(response => {

            /*
              Guardamos únicamente respuestas
              válidas.
            */

            if (
              response &&
              response.status === 200 &&
              response.type !== "opaque"
            ) {

              const responseClone =
                response.clone();

              caches.open(CACHE_NAME)
                .then(cache => {

                  cache.put(
                    event.request,
                    responseClone
                  );

                });

            }

            return response;

          })
          .catch(() => {

            /*
              Si no hay Internet y no existe
              en caché, devolvemos la página.
            */

            return caches.match(
              "./index.html"
            );

          });

      })

  );

});
