/*
 * CONTROL DE ENTRADA: A TIEMPO O RETARDO
 * =======================================
 *
 * Este archivo no forma parte de la web:
 * es el código que se pega en script.google.com.
 *
 * Agrega una columna "Estado entrada" a la hoja de asistencia y
 * escribe "A tiempo" o "Retardo" en cada registro nuevo.
 *
 * REGLA DE HORARIO (hora local de la escuela):
 *
 *   de 1:50 pm a 2:10:59 pm ..... A tiempo
 *   desde 2:11:00 pm ............ Retardo
 *
 *   (las llegadas anteriores a 1:50 pm también cuentan
 *   como A tiempo)
 *
 * Pasos:
 *
 * 1. Pegar todo este archivo al final de Code.gs.
 *
 * 2. Donde agregas la fila de la asistencia (tu línea
 *    hoja.appendRow(...)), llamar inmediatamente después:
 *
 *      agregarEstadoEntrada(hoja, hora);
 *
 *    "hoja" es el objeto hoja que usas en el appendRow y
 *    "hora" es la variable con la hora del registro, si la
 *    tienes. Si no, basta con:
 *
 *      agregarEstadoEntrada(hoja);
 *
 *    (lee la hora de la columna "hora" de la fila recién
 *    escrita y, si no existe esa columna, usa la hora del
 *    servidor).
 *
 * 3. Publicar: Implementar > Administrar implementaciones
 *    > lápiz > Versión: Versión nueva > Implementar.
 *    La URL no cambia.
 *
 * 4. Probar: registrar un alumno y ver la columna
 *    "Estado entrada" al final de su fila.
 *
 * Notas:
 *
 * - La hora clasificada es la del momento de la llegada:
 *   en línea usa la hora del servidor de Apps Script; los
 *   registros hechos sin conexión usan la hora que envió el
 *   dispositivo al sincronizar.
 *
 * - Verifica la zona horaria del proyecto (engranaje >
 *   Configuración del proyecto): debe ser la de la escuela.
 */


/*
 * Minuto de corte: 2:11 pm = 14*60 + 11 = 851.
 *
 * Minutos desde medianoche >= 851 -> Retardo.
 * Antes de eso -> A tiempo (incluye 2:10:59 pm).
 */
const MINUTO_CORTE = 14 * 60 + 11;

const ETIQUETA_A_TIEMPO = "A tiempo";
const ETIQUETA_RETARDO = "Retardo";

const ENCABEZADO_ESTADO = "Estado entrada";


/*
 * Clasifica la hora de una llegada.
 *
 * valorHora: texto ("14:05:33", "2:05:33 p. m."), objeto
 * Date de la hoja o vacío. Si no se puede leer, se usa
 * "ahora" (por defecto, la hora del servidor).
 */
function clasificarEntrada(valorHora, ahora) {
  let minutos = minutosDelDia(valorHora);

  if (minutos === null) {
    minutos = minutosDelDia(ahora || new Date());
  }

  if (minutos === null) {
    return "";
  }

  return minutos >= MINUTO_CORTE
    ? ETIQUETA_RETARDO
    : ETIQUETA_A_TIEMPO;
}


/*
 * Convierte una hora en minutos desde medianoche.
 * Devuelve null si el valor no se puede interpretar.
 */
function minutosDelDia(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  /* Celdas de hora/fecha de Google Sheets: vienen como Date. */
  if (valor instanceof Date) {
    return isNaN(valor.getTime())
      ? null
      : valor.getHours() * 60 + valor.getMinutes();
  }

  let texto = String(valor).trim().toLowerCase();

  if (!texto) {
    return null;
  }

  /* Fecha completa en texto: "2026-10-30T14:05:00". */
  if (texto.indexOf("-") !== -1 || texto.indexOf("t") !== -1) {
    const fecha = new Date(String(valor).trim());

    if (!isNaN(fecha.getTime())) {
      return fecha.getHours() * 60 + fecha.getMinutes();
    }
  }

  /*
   * Hora con o sin segundos y con o sin a. m./p. m.:
   * "14:05", "14:05:33", "2:05 pm", "02:05:33 p. m."
   */
  const partes = texto.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\s*\.?\s*m\s*\.?)?$/
  );

  if (!partes) {
    return null;
  }

  let horas = Number(partes[1]);
  const minutos = Number(partes[2]);
  const meridiano = partes[4] || "";

  if (meridiano === "p" && horas < 12) {
    horas += 12;
  }

  if (meridiano === "a" && horas === 12) {
    horas = 0;
  }

  if (horas > 23 || minutos > 59) {
    return null;
  }

  return horas * 60 + minutos;
}


/*
 * Escribe "A tiempo" o "Retardo" en la fila recién agregada.
 *
 * Llamar justo después del appendRow. Si la columna
 * "Estado entrada" no existe, la crea.
 *
 *   agregarEstadoEntrada(hoja, hora);
 *   agregarEstadoEntrada(hoja);
 */
function agregarEstadoEntrada(hoja, valorHora) {
  if (!hoja) {
    return;
  }

  const fila = hoja.getLastRow();

  if (fila < 2) {
    return;
  }

  let columna = columnaPorEncabezado(hoja, ENCABEZADO_ESTADO);

  if (columna === -1) {
    columna = hoja.getLastColumn() + 1;
    hoja.getRange(1, columna).setValue(ENCABEZADO_ESTADO);
  }

  let hora = valorHora;

  if (hora === null || hora === undefined || hora === "") {
    const columnaHora = columnaQueContenga(hoja, "hora");

    if (columnaHora !== -1) {
      hora = hoja.getRange(fila, columnaHora).getValue();
    }
  }

  hoja.getRange(fila, columna).setValue(clasificarEntrada(hora));
}


/*
 * Número de columna cuyo encabezado coincide (sin distinguir
 * mayúsculas), o -1 si no está.
 */
function columnaPorEncabezado(hoja, nombre) {
  const encabezados = hoja
    .getRange(1, 1, 1, hoja.getLastColumn())
    .getValues()[0];

  const buscado = String(nombre).trim().toLowerCase();

  for (let i = 0; i < encabezados.length; i++) {
    if (String(encabezados[i]).trim().toLowerCase() === buscado) {
      return i + 1;
    }
  }

  return -1;
}


/*
 * Número de columna cuyo encabezado contiene el texto,
 * o -1 si no está.
 */
function columnaQueContenga(hoja, texto) {
  const encabezados = hoja
    .getRange(1, 1, 1, hoja.getLastColumn())
    .getValues()[0];

  const buscado = String(texto).trim().toLowerCase();

  for (let i = 0; i < encabezados.length; i++) {
    if (String(encabezados[i]).trim().toLowerCase().indexOf(buscado) !== -1) {
      return i + 1;
    }
  }

  return -1;
}
