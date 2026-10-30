# asistencia-qr

PWA de control de asistencia por QR para la Esc. Sec. N° 101
"Ludwig Van Beethoven". Toma asistencia con la cámara, funciona sin
internet guardando en el dispositivo y sincroniza con Google Sheets.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Estructura de la página (5 KB, sin CSS ni JS embebidos) |
| `estilos.css` | Todo el CSS |
| `app.js` | Toda la lógica: cámara, IndexedDB, sincronización |
| `service-worker.js` | Caché offline (versión `asistencia-qr-v4`) |
| `manifest.json` + `icon-192/512.png` | Instalación como aplicación |
| `lib/html5-qrcode.mim.js` | Lector QR local (no depende de CDNs) |
| `validar-token.js` | Código para pegar en Google Apps Script, no se usa en la web |
| `estado-entrada.js` | Código para pegar en Google Apps Script: marca "A tiempo" o "Retardo" en la hoja |

## Seguridad: token en la API

La web envía `&token=` en cada petición. Para que el script de Google lo
exija, seguir estos pasos en **script.google.com** con el código de
[`validar-token.js`](validar-token.js):

1. Ejecutar `configurarToken()` una sola vez.
2. Llamar `validarToken(e)` como primera línea del `doGet(e)`:
   `const rechazo = validarToken(e); if (rechazo) return rechazo;`
3. Publicar con **Implementar > Administrar implementaciones > lápiz >
   Versión nueva > Implementar** (así se conserva la misma URL).
4. Probar: sin `&token=` debe responder `{"ok":false,"mensaje":"No autorizado"}`.

## Cómo funciona el registro offline

Si el servidor no responde, la asistencia se guarda en IndexedDB con
estado `pendiente` y la fecha que devolvió el servidor (o la del
dispositivo si aún no hubo respuesta). Al volver la conexión se
reintenta sola; un pendiente que el servidor rechace cinco veces se
descarta de la cola para que no crezca sin límite.

## Pistola lectora de códigos

La app admite una pistola lectora (USB/OTG o Bluetooth) además de la
cámara, sin instalar nada: la pistola actúa como teclado, escribe el
código y lo cierra con Enter. Al primer disparo la app muestra
"Lector detectado" en la línea de estado, detiene la cámara y registra
por la misma ruta que la cámara. Los disparos rápidos se atienden en
cola, así que no se pierde ninguno aunque el servidor tarde.

Configuración de la pistola (código de configuración del fabricante):

1. Habilitar la symbología **QR** (de fábrica suele venir solo 1D).
2. Sufijo **CR (Enter)** activado.
3. Sin prefijo ni sufijo de texto personalizado.

## Control de entrada: A tiempo / Retardo

[`estado-entrada.js`](estado-entrada.js) agrega una columna
**Estado entrada** a la hoja de asistencia y escribe `A tiempo` o
`Retardo` en cada registro nuevo:

| Hora de llegada | Valor |
|---|---|
| de 1:50 pm a 2:10:59 pm | `A tiempo` |
| desde 2:11:00 pm | `Retardo` |

(Las llegadas anteriores a 1:50 pm también cuentan como `A tiempo`.)

Pasos en **script.google.com**:

1. Pegar todo el archivo al final de `Code.gs`.
2. Llamar `agregarEstadoEntrada(hoja);` justo después de tu línea
   `hoja.appendRow(...)` (donde `hoja` es la misma hoja del
   appendRow). Lee la hora de la columna `hora` de la fila; si esa
   columna no existe, pásala tú: `agregarEstadoEntrada(hoja, hora);`.
3. Publicar versión nueva: **Implementar > Administrar
   implementaciones > lápiz > Versión nueva > Implementar** (la URL
   no cambia).
4. Comprobar la zona horaria del proyecto (engranaje > Configuración
   del proyecto): debe ser la de la escuela.
5. Probar registrando un alumno y buscando la columna al final de su
   fila.

La hora clasificada es la del momento de la llegada: en línea, la del
servidor de Apps Script; en los registros hechos sin conexión, la que
envió el dispositivo al sincronizar.
