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
