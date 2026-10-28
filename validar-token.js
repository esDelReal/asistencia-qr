/*
 * VALIDACIÓN DEL TOKEN EN LA APPS SCRIPT
 * =======================================
 *
 * Este archivo no forma parte de la web:
 * es el código que se pega en script.google.com.
 *
 * Pasos:
 *
 * 1. Ejecutar configurarToken() una sola vez
 *    (guarda el token en las propiedades del script).
 *
 * 2. Pegar validarToken(e) y llamarlo como primera
 *    línea de tu doGet(e), antes de cualquier lógica.
 *
 * 3. Publicar: Implementar > Administrar implementaciones
 *    > lápiz > Versión: Versión nueva > Implementar.
 *    Eso conserva la misma URL.
 */


function configurarToken() {
  PropertiesService.getScriptProperties().setProperty(
    "TOKEN",
    "qr-asistencia-7f3c9b21e84d4a6c9f05b2d7e1a3c8f4"
  );
}


function validarToken(e) {
  const esperado = PropertiesService
    .getScriptProperties()
    .getProperty("TOKEN");

  const recibido = (e && e.parameter && e.parameter.token) || "";

  if (!esperado || recibido !== esperado) {
    return ContentService
      .createTextOutput(
        JSON.stringify({ ok: false, mensaje: "No autorizado" })
      )
      .setMimeType(ContentService.MimeType.JSON);
  }

  return null; // token correcto: continuar con el doGet normal
}


/*
 * Uso dentro de tu doGet existente:
 *
 *   function doGet(e) {
 *     const rechazo = validarToken(e);
 *     if (rechazo) return rechazo;
 *
 *     // ... el resto de tu código, sin cambios
 *   }
 */
