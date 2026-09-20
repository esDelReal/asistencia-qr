const CACHE_NAME = "asistencia-qr-v1";

const ARCHIVOS = [
  "./",
  "./index.html"
];

self.addEventListener("install", event => {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ARCHIVOS))
  );

  self.skipWaiting();
});


self.addEventListener("activate", event => {

  event.waitUntil(
    caches.keys().then(keys => {

      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );

    })
  );

  self.clients.claim();
});


self.addEventListener("fetch", event => {

  event.respondWith(

    fetch(event.request)
      .then(response => {

        if (
          response &&
          response.status === 200
        ) {

          const copia =
            response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {

              cache.put(
                event.request,
                copia
              );

            });

        }

        return response;

      })
      .catch(() => {

        return caches.match(
          event.request
        );

      })

  );

});
