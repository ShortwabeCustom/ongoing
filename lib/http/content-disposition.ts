/**
 * Construcción defensiva de la cabecera `Content-Disposition`.
 *
 * ADR-001 (P1-B) — §3.1: `inline` con filename saneado y RFC 5987 para no ASCII.
 *
 * Módulo PURO.
 *
 * El `originalFilename` de una Evidence pasó por `sanitizeFilename` en el
 * upload, pero esta cabecera se construye a partir de un valor YA ALMACENADO:
 * puede provenir de filas históricas, de una importación o de datos
 * manipulados. El saneado en escritura no protege lo que ya está en la BD, así
 * que aquí se vuelve a sanear sin excepción.
 */

/** Caracteres seguros para el `filename=` ASCII (token sin comillas ni escapes). */
const UNSAFE_ASCII = /[^A-Za-z0-9._-]+/g

/** NUL, controles C0, DEL y C1: incluye CR y LF (inyección de cabeceras). */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g

const FALLBACK_NAME = 'evidence'
const MAX_LENGTH = 120

/**
 * Nombre ASCII para el parámetro `filename=`.
 *
 * Elimina todo lo que no sea `[A-Za-z0-9._-]`, con lo que desaparecen por
 * construcción CR, LF, comillas dobles, backslashes, punto y coma y cualquier
 * carácter capaz de romper la cabecera.
 */
function asciiFallback(filename: string): string {
  const cleaned = filename
    .replace(CONTROL_CHARS, '')
    .replace(UNSAFE_ASCII, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, MAX_LENGTH)

  return cleaned === '' || cleaned === '.' ? FALLBACK_NAME : cleaned
}

/**
 * Valor codificado para `filename*=UTF-8''…` (RFC 8187 §3.2).
 *
 * `encodeURIComponent` percent-codifica comillas, backslashes, CR, LF y
 * cualquier byte no ASCII, pero **deja sin escapar `! ' ( ) * - . _ ~`**. De
 * esos, `'`, `(`, `)` y `*` NO pertenecen a `attr-char`:
 *
 *     attr-char = ALPHA / DIGIT / "!" / "#" / "$" / "&" / "+" / "-" / "."
 *               / "^" / "_" / "`" / "|" / "~"
 *
 * El caso peligroso es `'`, que es el delimitador del propio formato
 * `UTF-8''valor`: un nombre como `O'Reilly.png` produciría un apóstrofo suelto
 * que un parser estricto interpreta mal. Por eso se escapan a mano los cuatro.
 * `!` sí es attr-char válido y se deja tal cual.
 */
function rfc5987Value(filename: string): string {
  const cleaned = filename.replace(CONTROL_CHARS, '').slice(0, MAX_LENGTH)
  const source = cleaned === '' ? FALLBACK_NAME : cleaned
  return encodeURIComponent(source).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/**
 * `inline; filename="…"; filename*=UTF-8''…`
 *
 * Se emiten SIEMPRE ambos parámetros: los clientes antiguos leen `filename`, los
 * modernos prefieren `filename*` (RFC 6266 §4.3).
 */
export function inlineContentDisposition(filename: string | null | undefined): string {
  const source = typeof filename === 'string' ? filename : ''
  return `inline; filename="${asciiFallback(source)}"; filename*=UTF-8''${rfc5987Value(source)}`
}
