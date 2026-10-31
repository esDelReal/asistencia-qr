/* =====================================================
       CONFIGURACIÓN
       ===================================================== */

    const API_URL =
      "https://script.google.com/macros/s/AKfycbyCnVZ4mkq92Cx788c-FJFcnwxw4OW8IWAGWwIMv-sMB1iwz1E2eIwfqzBeTOG4Ootr/exec";


    /*
     * Token de acceso a la Apps Script.
     *
     * Se envía en cada petición y Apps Script
     * lo valida antes de responder.
     *
     * Debe coincidir con el valor guardado en
     * Script Properties > TOKEN.
     *
     * Al estar en el cliente, cualquiera puede
     * leerlo: sube la barrera, no sustituye
     * una autenticación real.
     */

    const TOKEN =
      "qr-asistencia-7f3c9b21e84d4a6c9f05b2d7e1a3c8f4";


    /* =====================================================
       VARIABLES
       ===================================================== */

    let scanner = null;

    let procesando = false;

    let qrBloqueado = false;

    let sincronizando = false;

    let db = null;

    let internetReal = false;

    /* Evita aceptar lecturas antes de disponer de la lista local de alumnos. */
    let datosInicialesListos = false;

    /*
     * Fecha devuelta por el servidor.
     *
     * Al guardar una asistencia offline se usa
     * esta en lugar del reloj del dispositivo:
     * evita que un reloj desfasado registre la
     * asistencia en el día equivocado.
     */
    let fechaServidor = null;

    /*
     * Reintentos máximos de un pendiente que el
     * servidor rechaza por un motivo que no sea
     * duplicado ni alumno inactivo.
     */
    const MAX_INTENTOS = 5;

    let ultimaVerificacionInternet = 0;
    const registrosEnRevision = new Set();


    /* =====================================================
       LECTOR TIPO PISTOLA
       ===================================================== */

    /*
     * La pistola lectora (USB/OTG o Bluetooth) se
     * comporta como un teclado: escribe el código y
     * lo cierra con Enter. No usa la cámara ni
     * html5-qrcode.
     *
     * Estas variables acumulan esa escritura hasta
     * el Enter y la envían por la misma ruta que
     * usa la cámara.
     */

    let bufferLector = "";

    let temporizadorBufferLector = null;

    const COLA_LECTOR = [];

    let procesandoColaLector = false;

    let lectorDetectado = false;

    /* Las teclas de un mismo código llegan en menos de este tiempo. */
    const ESPERA_BUFFER_LECTOR = 700;


    /*
     * Tiempo máximo de espera para una petición
     * al servidor.
     *
     * Si el servidor no responde, la asistencia
     * se guarda automáticamente en el dispositivo.
     */

    const TIMEOUT_RED = 3500;


    /* =====================================================
       BASE DE DATOS
       ===================================================== */

    const DB_NAME =
      "AsistenciaQR";

    const DB_VERSION =
      1;


    /* =====================================================
       ABRIR BASE DE DATOS
       ===================================================== */

    function abrirBaseDatos() {

      return new Promise(
        function(resolve, reject) {

          const request =
            indexedDB.open(
              DB_NAME,
              DB_VERSION
            );


          request.onupgradeneeded =
            function(event) {

              const database =
                event.target.result;


              if (
                !database.objectStoreNames.contains(
                  "alumnos"
                )
              ) {

                database.createObjectStore(
                  "alumnos",
                  {
                    keyPath: "idQR"
                  }
                );

              }


              if (
                !database.objectStoreNames.contains(
                  "asistencias"
                )
              ) {

                const store =
                  database.createObjectStore(
                    "asistencias",
                    {
                      keyPath: "id",
                      autoIncrement: true
                    }
                  );


                store.createIndex(
                  "estado",
                  "estado",
                  {
                    unique: false
                  }
                );

              }

            };


          request.onsuccess =
            function(event) {

              db =
                event.target.result;


              /*
               * Si IndexedDB se cierra inesperadamente,
               * intentamos mantener la aplicación operativa.
               */

              db.onversionchange =
                function() {

                  db.close();

                };


              resolve(db);

            };


          request.onerror =
            function() {

              reject(
                request.error
              );

            };

        }
      );

    }


    /* =====================================================
       GUARDAR ALUMNOS
       ===================================================== */

    function guardarAlumnos(alumnos) {

      return new Promise(
        function(resolve, reject) {

          if (!db) {

            resolve();

            return;

          }


          const transaction =
            db.transaction(
              "alumnos",
              "readwrite"
            );


          const store =
            transaction.objectStore(
              "alumnos"
            );


          /*
           * Eliminamos la caché anterior.
           *
           * Así un alumno eliminado de Google Sheets
           * no permanece en el dispositivo.
           */

          store.clear();


          /*
           * Guardamos solamente la lista actual.
           */

          alumnos.forEach(
            function(alumno) {

              store.put({

                idQR:
                  String(
                    alumno.idQR || ""
                  ).trim(),

                nombre:
                  alumno.nombre || "",

                grupo:
                  alumno.grupo || "",

                activo:
                  alumno.activo || ""

              });

            }
          );


          transaction.oncomplete =
            function() {

              resolve();

            };


          transaction.onerror =
            function() {

              reject(
                transaction.error
              );

            };

        }
      );

    }


    /* =====================================================
       OBTENER ALUMNO LOCAL
       ===================================================== */

    function obtenerAlumnoLocal(idQR) {

      return new Promise(
        function(resolve, reject) {

          if (!db) {

            resolve(null);

            return;

          }


          const transaction =
            db.transaction(
              "alumnos",
              "readonly"
            );


          const store =
            transaction.objectStore(
              "alumnos"
            );


          const request =
            store.get(
              String(idQR).trim()
            );


          request.onsuccess =
            function() {

              resolve(
                request.result ||
                null
              );

            };


          request.onerror =
            function() {

              reject(
                request.error
              );

            };

        }
      );

    }


    /* =====================================================
       OBTENER TODOS LOS ALUMNOS
       ===================================================== */

    function obtenerTodosLosAlumnos() {

      return new Promise(
        function(resolve, reject) {

          if (!db) {

            resolve([]);

            return;

          }


          const transaction =
            db.transaction(
              "alumnos",
              "readonly"
            );


          const store =
            transaction.objectStore(
              "alumnos"
            );


          const request =
            store.getAll();


          request.onsuccess =
            function() {

              resolve(
                request.result || []
              );

            };


          request.onerror =
            function() {

              reject(
                request.error
              );

            };

        }
      );

    }


    /* =====================================================
       OBTENER ASISTENCIAS
       ===================================================== */

    function obtenerTodasLasAsistencias() {

      return new Promise(
        function(resolve, reject) {

          if (!db) {

            resolve([]);

            return;

          }


          const transaction =
            db.transaction(
              "asistencias",
              "readonly"
            );


          const store =
            transaction.objectStore(
              "asistencias"
            );


          const request =
            store.getAll();


          request.onsuccess =
            function() {

              resolve(
                request.result || []
              );

            };


          request.onerror =
            function() {

              reject(
                request.error
              );

            };

        }
      );

    }


    /* =====================================================
       GUARDAR ASISTENCIA LOCAL
       ===================================================== */

    function guardarAsistenciaLocal(
      asistencia
    ) {

      return new Promise(
        function(resolve, reject) {

          if (!db) {

            reject(
              new Error(
                "IndexedDB no está disponible."
              )
            );

            return;

          }


          const transaction =
            db.transaction(
              "asistencias",
              "readwrite"
            );


          const store =
            transaction.objectStore(
              "asistencias"
            );


          store.add(
            asistencia
          );


          transaction.oncomplete =
            function() {

              resolve();

            };


          transaction.onerror =
            function() {

              reject(
                transaction.error
              );

            };

        }
      );

    }


    /* =====================================================
       OBTENER PENDIENTES
       ===================================================== */

    function obtenerPendientes() {

      return new Promise(
        function(resolve, reject) {

          if (!db) {

            resolve([]);

            return;

          }


          const transaction =
            db.transaction(
              "asistencias",
              "readonly"
            );


          const store =
            transaction.objectStore(
              "asistencias"
            );


          /*
           * Utilizamos el índice estado.
           *
           * Esto es más eficiente que getAll()
           * y filtrar después.
           */

          const indice =
            store.index(
              "estado"
            );


          const request =
            indice.getAll(
              "pendiente"
            );


          request.onsuccess =
            function() {

              resolve(
                request.result || []
              );

            };


          request.onerror =
            function() {

              reject(
                request.error
              );

            };

        }
      );

    }


    /* =====================================================
       ACTUALIZAR PENDIENTES
       ===================================================== */

    async function actualizarPendientes() {

      try {

        const pendientes =
          await obtenerPendientes();


        document.getElementById(
          "pendientes"
        ).textContent =
          pendientes.length;


        document.getElementById(
          "syncButton"
        ).disabled =
          pendientes.length === 0;


      }
      catch(error) {

        console.error(
          "Error actualizando pendientes:",
          error
        );

      }

    }


    /* =====================================================
       MOSTRAR RESULTADO
       ===================================================== */

    function mostrarResultado(
      icono,
      titulo,
      detalle,
      clase
    ) {

      const resultado =
        document.getElementById(
          "resultado"
        );


      resultado.className =
        "result " + (clase || "");


      /*
       * Se usa textContent y no innerHTML.
       *
       * El nombre y el mensaje vienen de
       * Google Sheets: si fueran HTML,
       * se interpretarían en el dispositivo.
       */

      function texto(tag, claseNodo, contenido) {

        const nodo =
          document.createElement(tag);

        nodo.className = claseNodo;
        nodo.textContent =
          contenido == null
            ? ""
            : String(contenido);

        return nodo;

      }


      const contenedor =
        document.createElement("div");

      contenedor.append(
        texto("div", "result-icon", icono),
        texto("div", "result-title", titulo),
        texto("div", "result-detail", detalle)
      );


      resultado.replaceChildren(contenedor);

    }


    /* =====================================================
       CONEXIÓN
       ===================================================== */

    function actualizarConexion() {

      const status =
        document.getElementById(
          "connectionStatus"
        );


      const texto =
        document.getElementById(
          "connectionText"
        );


      if (
        navigator.onLine &&
        internetReal
      ) {

        status.classList.remove(
          "offline"
        );


        texto.textContent =
          "Conectado";

      }
      else {

        status.classList.add(
          "offline"
        );


        texto.textContent =
          "Sin conexión";

      }

    }


    /* =====================================================
       CARGAR ALUMNOS
       ===================================================== */

    async function cargarAlumnos() {

      /*
       * OFFLINE:
       *
       * No hacemos ninguna petición.
       */

      if (!navigator.onLine) {

        await actualizarTotalAlumnos();

        return;

      }


      try {

        const controller =
          new AbortController();


        const timeout =
          setTimeout(
            function() {

              controller.abort();

            },
            TIMEOUT_RED
          );


        const response =
          await fetch(
            API_URL +
            "?action=alumnos&token=" +
            TOKEN +
            "&t=" +
            Date.now(),
            {
              method: "GET",
              cache: "no-store",
              signal:
                controller.signal
            }
          );


        clearTimeout(
          timeout
        );


        if (!response.ok) {

          throw new Error(
            "HTTP " +
            response.status
          );

        }


        const data =
          await response.json();


        if (
          data.ok &&
          Array.isArray(
            data.alumnos
          )
        ) {

          await guardarAlumnos(
            data.alumnos
          );


          internetReal =
            true;


          actualizarConexion();

        }

      }
      catch(error) {

        console.warn(
          "No fue posible actualizar alumnos:",
          error
        );


        /*
         * No borramos la caché local.
         *
         * Se conserva para poder trabajar offline.
         */

        internetReal =
          false;


        await actualizarTotalAlumnos();

        actualizarConexion();

      }

    }


    /* =====================================================
       CONTAR ALUMNOS ACTIVOS
       ===================================================== */

    async function actualizarTotalAlumnos() {

      try {

        const alumnos =
          await obtenerTodosLosAlumnos();


        const activos =
          alumnos.filter(
            function(alumno) {

              const estado =
                String(
                  alumno.activo || ""
                )
                .trim()
                .toLowerCase();


              return (
                estado === "sí" ||
                estado === "si"
              );

            }
          );


        document.getElementById(
          "totalAlumnos"
        ).textContent =
          activos.length;

      }
      catch(error) {

        console.error(
          "Error contando alumnos:",
          error
        );

      }

    }


    /* =====================================================
       FECHA
       ===================================================== */

    function obtenerFecha() {

      const ahora =
        new Date();


      const dia =
        String(
          ahora.getDate()
        ).padStart(
          2,
          "0"
        );


      const mes =
        String(
          ahora.getMonth() + 1
        ).padStart(
          2,
          "0"
        );


      const año =
        ahora.getFullYear();


      return (
        dia +
        "/" +
        mes +
        "/" +
        año
      );

    }


    /* =====================================================
       HORA
       ===================================================== */

    function obtenerHora() {

      const ahora =
        new Date();


      const horas =
        String(
          ahora.getHours()
        ).padStart(
          2,
          "0"
        );


      const minutos =
        String(
          ahora.getMinutes()
        ).padStart(
          2,
          "0"
        );


      const segundos =
        String(
          ahora.getSeconds()
        ).padStart(
          2,
          "0"
        );


      return (
        horas +
        ":" +
        minutos +
        ":" +
        segundos
      );

    }

    /* =====================================================
       CLASIFICACIÓN DE ENTRADA
       ===================================================== */

    function calcularEstatusEntrada(hora) {
      const texto = String(hora || "").trim();
      const partes = texto.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

      if (!partes) return "Hora no disponible";

      const h = Number(partes[1]);
      const m = Number(partes[2]);
      const s = Number(partes[3] || 0);

      if (h > 23 || m > 59 || s > 59) {
        return "Hora no disponible";
      }

      return (h * 3600 + m * 60 + s) >= (14 * 3600 + 11 * 60)
        ? "Retardo"
        : "A tiempo";
    }


    /* =====================================================
       RESUMEN
       ===================================================== */

    async function actualizarResumenAsistencia() {

      if (!navigator.onLine) {

        return;

      }


      try {

        const controller =
          new AbortController();


        const timeout =
          setTimeout(
            function() {

              controller.abort();

            },
            TIMEOUT_RED
          );


        const response =
          await fetch(
            API_URL +
            "?action=resumen&token=" +
            TOKEN +
            "&t=" +
            Date.now(),
            {
              method: "GET",
              cache: "no-store",
              signal:
                controller.signal
            }
          );


        clearTimeout(
          timeout
        );


        if (!response.ok) {

          throw new Error(
            "HTTP " +
            response.status
          );

        }


        const data =
          await response.json();


        if (!data.ok) {

          return;

        }
                     /* La fecha del servidor manda para el registro offline. */
        if (data.fecha) {
          fechaServidor = data.fecha;
        }


        internetReal =
          true;


        const total =
          Number(
            data.totalActivos
          ) || 0;


        const ingresados =
          Number(
            data.hanIngresado
          ) || 0;


        const faltan =
          Number(
            data.faltan
          ) || 0;


        const porcentaje =
          Number(
            data.porcentaje
          ) || 0;


        document.getElementById(
          "totalAlumnos"
        ).textContent =
          total;


        document.getElementById(
          "totalActivos"
        ).textContent =
          total;


        document.getElementById(
          "hanIngresado"
        ).textContent =
          ingresados;


        document.getElementById(
          "faltanIngresar"
        ).textContent =
          faltan;


        document.getElementById(
          "porcentajeAsistencia"
        ).textContent =
          porcentaje +
          "%";


        document.getElementById(
          "barraProgreso"
        ).style.width =
          Math.min(
            100,
            Math.max(
              0,
              porcentaje
            )
          ) +
          "%";


        actualizarConexion();

      }
      catch(error) {

        console.warn(
          "No se pudo actualizar el resumen:",
          error
        );

      }

    }


    /* =====================================================
       DUPLICADO LOCAL
       ===================================================== */

    async function verificarDuplicadoLocal(
      idQR,
      fecha
    ) {

      const asistencias =
        await obtenerTodasLasAsistencias();


      return asistencias.some(
        function(item) {

          return (
            String(item.idQR).trim() ===
              String(idQR).trim() &&
            item.fecha ===
              fecha
          );

        }
      );

    }


    /* =====================================================
       REGISTRAR OFFLINE
       ===================================================== */

    async function registrarOffline(
      idQR
    ) {

      try {

        const alumno =
          await obtenerAlumnoLocal(
            idQR
          );


        /* ==========================================
           NO ENCONTRADO
           ========================================== */

        if (!alumno) {

          mostrarResultado(
            "❌",
            "Código no registrado",
            "Este alumno no está disponible en la información local del dispositivo.",
            "error"
          );

          return;

        }


        /* ==========================================
           ACTIVO
           ========================================== */

        const activo =
          String(
            alumno.activo || ""
          )
          .trim()
          .toLowerCase();


        if (
          activo !== "sí" &&
          activo !== "si"
        ) {

          mostrarResultado(
            "🚫",
            "Alumno inactivo",
            alumno.nombre +
            " · " +
            alumno.grupo +
            "\nNo tiene autorización para registrar asistencia.",
            "error"
          );

          return;

        }


        /* ==========================================
           FECHA / HORA
           ========================================== */

        // Fecha del dispositivo en el momento de la lectura; evita
        // reutilizar una fecha del servidor de un día anterior.
        const fecha = obtenerFecha();


        const hora =
          obtenerHora();

        const estatus =
          calcularEstatusEntrada(hora);


        /* ==========================================
           DUPLICADO
           ========================================== */

        const duplicado =
          await verificarDuplicadoLocal(
            idQR,
            fecha
          );


        if (duplicado) {

          mostrarResultado(
            "⚠️",
            "Asistencia duplicada",
            alumno.nombre +
            " · " +
            alumno.grupo +
            "\nYa fue registrado hoy.",
            "error"
          );

          return;

        }


        /* ==========================================
           GUARDAR
           ========================================== */

        await guardarAsistenciaLocal({

          idQR:
            String(idQR).trim(),

          nombre:
            alumno.nombre,

          grupo:
            alumno.grupo,

          fecha:
            fecha,

          hora:
            hora,

          estatus:
            estatus,

          estado:
            "pendiente"

        });


        await actualizarPendientes();


        mostrarResultado(
          "📱",
          "Asistencia guardada",
          alumno.nombre +
          " · " +
          alumno.grupo +
          "\nHora: " + hora + "\nEstado: " + estatus +
          "\nSin conexión. Pendiente de sincronizar.",
          "offline"
        );

      }
      catch(error) {

        console.error(
          "Error guardando offline:",
          error
        );


        mostrarResultado(
          "❌",
          "Error local",
          "No fue posible guardar la asistencia en el dispositivo.",
          "error"
        );

      }

    }


    /* =====================================================
       PROCESAR QR
       ===================================================== */

    async function procesarQR(
      idQR
    ) {

      /*
       * Evita que el mismo QR sea procesado
       * varias veces por la cámara.
       */

      if (procesando) {

        return;

      }


      procesando =
        true;


      try {

        idQR =
          String(
            idQR || ""
          ).trim();


        if (!idQR) {

          return;

        }


        /* ==========================================
           OFFLINE DIRECTO
           ========================================== */

        if (!navigator.onLine) {

          internetReal =
            false;


          actualizarConexion();


          await registrarOffline(
            idQR
          );


          return;

        }


        /* ==========================================
           INTENTAR SERVIDOR
           ========================================== */

        mostrarResultado(
          "⏳",
          "Procesando...",
          "Validando asistencia",
          ""
        );


        const controller =
          new AbortController();


        const timeout =
          setTimeout(
            function() {

              controller.abort();

            },
            TIMEOUT_RED
          );


        try {

          const url =
            API_URL +
            "?idQR=" +
            encodeURIComponent(
              idQR
            ) +
            "&token=" +
            TOKEN +
            "&t=" +
            Date.now();


          const response =
            await fetch(
              url,
              {
                method: "GET",
                cache: "no-store",
                signal: controller.signal
              }
            );

          clearTimeout(timeout);


          if (!response.ok) {

            throw new Error(
              "HTTP " +
              response.status
            );

          }


          const data =
            await response.json();


          internetReal = true;
          actualizarConexion();


          /* ========================================
             ASISTENCIA CORRECTA
             ======================================== */

          if (data.ok) {

            if (data.fecha) {
              fechaServidor = data.fecha;
            }


            mostrarResultado(
              "✓",
              "Asistencia registrada",
              data.nombre +
              " · " +
              data.grupo +
              "\nHora: " +
              data.hora +
              "\nEstado: " +
              (
                data.estatus ||
                calcularEstatusEntrada(data.hora)
              ),
              "success"
            );


            actualizarResumenAsistencia();

          }


          /* ========================================
             ALUMNO INACTIVO
             ======================================== */

          else if (data.inactivo) {

            mostrarResultado(
              "🚫",
              "Alumno inactivo",
              data.nombre +
              " · " +
              data.grupo +
              "\n" +
              data.mensaje,
              "error"
            );

          }


          /* ========================================
             ASISTENCIA DUPLICADA
             ======================================== */

          else if (data.duplicado) {

            mostrarResultado(
              "⚠️",
              "Asistencia duplicada",
              (data.mensaje || "La asistencia ya fue registrada.") +
              (data.hora ? "\nHora: " + data.hora : "") +
              (data.estatus ? "\nEstado: " + data.estatus : ""),
              "error"
            );

          }


          /* ========================================
             CÓDIGO DESCONOCIDO
             ======================================== */

          else {

            mostrarResultado(
              "❌",
              "Código no registrado",
              data.mensaje ||
              "El código QR no está registrado.",
              "error"
            );

          }

        }
        catch(error) {

          clearTimeout(
            timeout
          );


          console.warn(
            "Servidor no disponible:",
            error
          );


          internetReal =
            false;


          actualizarConexion();


          await registrarOffline(
            idQR
          );

        }

      }
      catch(error) {

        console.error(
          "Error procesando QR:",
          error
        );


        mostrarResultado(
          "❌",
          "Error",
          "No fue posible procesar el código QR.",
          "error"
        );

      }
      finally {

        setTimeout(
          function() {

            procesando =
              false;

          },
          600
        );

      }

    }


    /* =====================================================
       ELIMINAR ASISTENCIA LOCAL
       ===================================================== */

    function eliminarAsistencia(
      id
    ) {

      return new Promise(
        function(resolve, reject) {

          if (!db) {

            resolve();

            return;

          }


          const transaction =
            db.transaction(
              "asistencias",
              "readwrite"
            );


          const store =
            transaction.objectStore(
              "asistencias"
            );


          store.delete(
            id
          );


          transaction.oncomplete =
            function() {

              resolve();

            };


          transaction.onerror =
            function() {

              reject(
                transaction.error
              );

            };

        }
      );

    }


    /* =====================================================
       ACTUALIZAR INTENTOS
       ===================================================== */

    function actualizarIntento(
      id,
      intento
    ) {

      return new Promise(
        function(resolve, reject) {

          if (!db) {

            resolve();

            return;

          }


          const transaction =
            db.transaction(
              "asistencias",
              "readwrite"
            );


          const store =
            transaction.objectStore(
              "asistencias"
            );


          const request =
            store.get(id);


          request.onsuccess =
            function() {

              const registro =
                request.result;


              if (!registro) {

                return;

              }


              registro.intento =
                intento;


              store.put(registro);

            };


          request.onerror =
            function() {

              reject(
                request.error
              );

            };


          transaction.oncomplete =
            function() {

              resolve();

            };


          transaction.onerror =
            function() {

              reject(
                transaction.error
              );

            };

        }
      );

    }
               /* =====================================================
       SINCRONIZAR PENDIENTES
       ===================================================== */

    async function sincronizarPendientes() {
      if (sincronizando || !navigator.onLine || !db) {
        await actualizarPendientes();
        return;
      }
      sincronizando = true;
      const boton = document.getElementById("syncButton");
      let sincronizadas = 0;
      let requierenRevision = 0;
      try {
        const pendientes = await obtenerPendientes();
        if (boton) {
          boton.disabled = true;
          boton.textContent = "Sincronizando " + pendientes.length + "...";
        }
        for (const asistencia of pendientes) {
          if (!navigator.onLine) break;
          // No se elimina ninguna asistencia por número de intentos.
          // Un rechazo explícito permanece localmente para revisión.
          if (registrosEnRevision.has(asistencia.id)) {
            requierenRevision++;
            continue;
          }
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), TIMEOUT_RED);
          try {
            const datos = {
              idQR: asistencia.idQR,
              fecha: asistencia.fecha,
              hora: asistencia.hora
            };
            const url = API_URL + "?action=sincronizar&datos=" +
              encodeURIComponent(JSON.stringify(datos)) +
              "&token=" + encodeURIComponent(TOKEN) + "&t=" + Date.now();
            const response = await fetch(url, {
              method: "GET",
              cache: "no-store",
              signal: controller.signal
            });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const data = await response.json();
            // Solo una confirmación de guardado o duplicado en el servidor
            // autoriza eliminar la copia local.
            if (data && (data.ok === true || data.duplicado === true)) {
              await eliminarAsistencia(asistencia.id);
              sincronizadas++;
            } else {
              registrosEnRevision.add(asistencia.id);
              requierenRevision++;
              console.warn("Asistencia conservada para revisión:", asistencia.id, data);
            }
          } catch (error) {
            console.warn("Asistencia conservada; error de sincronización:", error);
            // Un error de red o respuesta ambigua nunca elimina el registro.
            break;
          } finally {
            clearTimeout(timeout);
          }
        }
        if (requierenRevision > 0) {
          mostrarResultado("⚠️", "Pendientes por revisar",
            requierenRevision + " asistencia(s) no fueron confirmadas por el servidor. Permanecen guardadas en este dispositivo.", "error");
        }
      } catch (error) {
        console.error("Error sincronizando:", error);
      } finally {
        sincronizando = false;
        await actualizarPendientes();
        if (navigator.onLine) void actualizarResumenAsistencia();
        if (boton) boton.textContent = "Sincronizar pendientes";
      }
    }


    /* =====================================================
       DETENER Y REANUDAR ESCÁNER
       ===================================================== */

    async function detenerCamara() {

      if (!scanner) return;

      const instancia = scanner;

      scanner = null;

      try {
        await instancia.stop();
      }
      catch(error) {
        console.log(
          "La cámara ya estaba detenida:",
          error
        );
      }

      try {
        await instancia.clear();
      }
      catch(error) {
        console.log(
          "No fue necesario limpiar el lector:",
          error
        );
      }

    }


    async function reanudarEscaneo() {

      if (procesando) return;

      const boton =
        document.getElementById("cameraButton");

      boton.disabled = true;
      boton.textContent = "Activando cámara...";

      qrBloqueado = false;

      try {
        await iniciarCamara();
      }
      finally {
        boton.disabled = false;
        boton.textContent =
          "Escanear siguiente alumno";
      }

    }


    /* =====================================================
       INICIAR CÁMARA
       ===================================================== */

    async function iniciarCamara() {

      if (scanner) return;

      if (typeof Html5Qrcode === "undefined") {

        mostrarResultado(
          "❌",
          "Lector QR no disponible",
          "No se pudo cargar html5-qrcode. Abre la aplicación con Internet al menos una vez.",
          "error"
        );

        document.getElementById(
          "cameraStatus"
        ).textContent =
          "Lector no disponible";

        return;

      }

      try {

        scanner =
          new Html5Qrcode("reader");

        await scanner.start(

          {
            facingMode: "environment"
          },

          {
            fps: 10,

            qrbox: function(width, height) {

              const lado =
                Math.max(
                  140,
                  Math.min(
                    210,
                    Math.floor(
                      Math.min(width, height) * 0.75
                    )
                  )
                );

              return {
                width: lado,
                height: lado
              };

            },

            aspectRatio: 1.0
          },

          async function(decodedText) {

            /*
             * Esperar la carga de alumnos.
             */

            if (!datosInicialesListos) {

              mostrarResultado(
                "⏳",
                "Cargando lista de alumnos",
                "Espera un momento antes de escanear.",
                ""
              );

              return;

            }

            /*
             * Evitar múltiples lecturas.
             */

            if (qrBloqueado || procesando) {
              return;
            }

            qrBloqueado = true;

            /*
             * Detener la cámara antes
             * de registrar la asistencia.
             */

            await detenerCamara();

            document.getElementById(
              "cameraStatus"
            ).textContent =
              "QR detectado · cámara detenida";

            await procesarQR(decodedText);

          },

          function(errorMessage) {
                             /*
             * Errores normales de búsqueda.
             */

          }

        );


        document.getElementById(
          "cameraStatus"
        ).textContent =
          datosInicialesListos
            ? "Cámara activa · esperando QR"
            : "Cámara activa · cargando lista…";

        const botonCamara = document.getElementById("cameraButton");

        if (botonCamara) {
          botonCamara.disabled = false;
          botonCamara.textContent = "Escanear siguiente alumno";
        }

      }
      catch(error) {

        console.error("Error de cámara:", error);

        document.getElementById(
          "cameraStatus"
        ).textContent = "Error";

        mostrarResultado(
          "📷",
          "No se pudo iniciar la cámara",
          "Revisa el permiso de cámara del navegador.",
          "error"
        );

      }

    }


    /* =====================================================
       LECTOR TIPO PISTOLA
       ===================================================== */

    function dormir(ms) {

      return new Promise(function(resolve) {
        setTimeout(resolve, ms);
      });

    }


    function normalizarCodigoLector(texto) {

      return String(texto || "")
        .replace(/[\r\n\t]/g, "")
        .trim();

    }


    async function procesarLecturaDelLector(codigo) {

      let espera = 0;

      while (!datosInicialesListos && espera < 6000) {
        await dormir(200);
        espera += 200;
      }

      if (!datosInicialesListos) {

        mostrarResultado(
          "⏳",
          "Cargando lista de alumnos",
          "Espera un momento antes de escanear.",
          ""
        );

        return;

      }

      let esperaProceso = 0;

      while (procesando && esperaProceso < 12000) {
        await dormir(150);
        esperaProceso += 150;
      }

      if (procesando) {

        mostrarResultado(
          "⏳",
          "Espera un momento",
          "Hay una lectura en curso.",
          ""
        );

        return;

      }

      qrBloqueado = true;

      if (scanner) {

        await detenerCamara();

        document.getElementById("cameraStatus").textContent =
          "Lector detectado · cámara detenida";

      }

      await procesarQR(codigo);

    }


    async function procesarColaDelLector() {

      if (procesandoColaLector) return;

      procesandoColaLector = true;

      try {

        while (COLA_LECTOR.length > 0) {

          const codigo = COLA_LECTOR.shift();

          await procesarLecturaDelLector(codigo);

        }

      }
      finally {

        procesandoColaLector = false;

      }

    }


    function encolarLecturaDelLector(codigo) {

      if (!codigo) return;

      COLA_LECTOR.push(codigo);

      if (!lectorDetectado) {

        lectorDetectado = true;

        document.getElementById("cameraStatus").textContent =
          "Lector detectado";

      }

      void procesarColaDelLector();

    }


    function manejarTeclaDelLector(evento) {

      const destino = evento.target;

      if (
        destino &&
        (
          destino.tagName === "INPUT" ||
          destino.tagName === "TEXTAREA" ||
          destino.isContentEditable
        )
      ) {
        return;
      }

      if (
        evento.ctrlKey ||
        evento.altKey ||
        evento.metaKey
      ) {
        return;
      }

      if (evento.key === "Enter") {

        const codigo =
          normalizarCodigoLector(bufferLector);

        bufferLector = "";

        clearTimeout(temporizadorBufferLector);

        temporizadorBufferLector = null;

        if (codigo) {

          evento.preventDefault();

          encolarLecturaDelLector(codigo);

        }

        return;

      }

      if (evento.key.length !== 1) {
        return;
      }

      bufferLector += evento.key;

      clearTimeout(temporizadorBufferLector);

      temporizadorBufferLector = setTimeout(
        function() {
          bufferLector = "";
          temporizadorBufferLector = null;
        },
        ESPERA_BUFFER_LECTOR
      );

    }


    /* =====================================================
       EVENTO ONLINE
       ===================================================== */

    window.addEventListener(
      "online",
      function() {

        actualizarConexion();

        setTimeout(function() {
          void actualizarDatosEnSegundoPlano();
        }, 800);

      }
    );


    /* =====================================================
       EVENTO OFFLINE
       ===================================================== */

    window.addEventListener(
      "offline",
      function() {

        internetReal = false;

        actualizarConexion();

        mostrarResultado(
          "📱",
          "Modo sin conexión",
          "Las nuevas asistencias se guardarán automáticamente en este dispositivo.",
          "offline"
        );

      }
    );


    /* =====================================================
       BOTÓN SINCRONIZACIÓN
       ===================================================== */

    document.getElementById(
      "syncButton"
    ).addEventListener(
      "click",
      sincronizarPendientes
    );


    const cameraButton = document.getElementById("cameraButton");
    if (cameraButton) cameraButton.addEventListener("click", reanudarEscaneo);

    /* =====================================================
       LECTOR TIPO PISTOLA
       ===================================================== */

    document.addEventListener(
      "keydown",
      manejarTeclaDelLector
    );


    /* =====================================================
       SERVICE WORKER
       ===================================================== */

    function registrarServiceWorker() {

      if (
        "serviceWorker" in navigator &&
        location.protocol === "https:"
      ) {

        navigator.serviceWorker.register("./service-worker.js")
          .catch(function(error) {
            console.warn(
              "No se pudo registrar el service worker:",
              error
            );
          });

      }

    }


    /* =====================================================
       ACTUALIZACIÓN EN SEGUNDO PLANO
       ===================================================== */

    async function actualizarDatosEnSegundoPlano() {

      if (!navigator.onLine) {
        datosInicialesListos = true;
        return;
      }

      try {

        await cargarAlumnos();

        datosInicialesListos = true;

        await sincronizarPendientes();

        await actualizarResumenAsistencia();

        await actualizarPendientes();

      }
      catch(error) {

        console.warn(
          "La actualización en segundo plano no terminó:",
          error
        );

      }

    }


    /* =====================================================
       INICIO RÁPIDO
       ===================================================== */

    async function iniciarAplicacion() {

      registrarServiceWorker();

      try {

        await abrirBaseDatos();

        internetReal = false;

        actualizarConexion();

        await actualizarTotalAlumnos();

        await actualizarPendientes();

        await iniciarCamara();

        void actualizarDatosEnSegundoPlano();

      }
      catch(error) {

        console.error(
          "Error iniciando aplicación:",
          error
        );

        datosInicialesListos = true;

        mostrarResultado(
          "⚠️",
          "Almacenamiento local no disponible",
          "Las asistencias no se guardarán sin conexión.",
          "error"
        );

        try {
          await iniciarCamara();
        }
        catch(errorCamara) {
          console.error(
            "No se pudo iniciar la cámara:",
            errorCamara
          );
        }

      }

    }


    /* =====================================================
       INICIAR
       ===================================================== */

    window.addEventListener(
      "load",
      iniciarAplicacion
    );
