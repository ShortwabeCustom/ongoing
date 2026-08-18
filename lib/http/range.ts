/**
 * Parser de la cabecera HTTP `Range` para UN solo rango.
 *
 * ADR-001 (P1-B) — D13.
 *
 * Módulo PURO: no toca red, filesystem ni BD.
 *
 * Distinción normativa (RFC 9110 §14.2): un `Range` **malformado o no
 * soportado** se IGNORA y se sirve la representación completa con 200; un
 * `Range` bien formado pero **no satisfacible** produce 416. No son lo mismo.
 *
 * P1-B.3 sirve como máximo UN rango. Los rangos múltiples
 * (`bytes=0-1,4-5`) NO se soportan —no se emite `multipart/byteranges`— y se
 * tratan como "ignorar": 200 con el objeto completo.
 */

export type RangeResult =
  /** Sin `Range`, o `Range` que debe ignorarse ⇒ 200 con el objeto completo. */
  | { kind: 'none' }
  /** Rango satisfacible ⇒ 206. `start`/`end` son inclusivos. */
  | { kind: 'satisfiable'; start: number; end: number }
  /** Bien formado pero no satisfacible ⇒ 416 con `Content-Range: bytes *\/{size}`. */
  | { kind: 'unsatisfiable' }

const IGNORE: RangeResult = { kind: 'none' }
const UNSATISFIABLE: RangeResult = { kind: 'unsatisfiable' }

/** `bytes=` seguido de un único rango: `N-M`, `N-` o `-N`. */
const SINGLE_RANGE = /^(\d*)-(\d*)$/

function toCount(digits: string): number | null {
  if (digits === '') return null
  const value = Number.parseInt(digits, 10)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

/**
 * Interpreta `Range` contra un objeto de `size` bytes.
 *
 * @param header valor crudo de la cabecera, o `null` si no viene
 * @param size   tamaño real del objeto en el filesystem
 */
export function parseRange(header: string | null | undefined, size: number): RangeResult {
  if (!header) return IGNORE

  const raw = header.trim()
  if (raw === '') return IGNORE

  // Unidad desconocida (`items=0-1`, `bits=…`) ⇒ ignorar.
  const eq = raw.indexOf('=')
  if (eq === -1) return IGNORE
  if (raw.slice(0, eq).trim().toLowerCase() !== 'bytes') return IGNORE

  const spec = raw.slice(eq + 1).trim()

  // Rangos múltiples: no se soportan y no se emite multipart. Se ignoran.
  if (spec.includes(',')) return IGNORE

  const match = SINGLE_RANGE.exec(spec)
  if (!match) return IGNORE

  const [, startDigits, endDigits] = match
  const start = toCount(startDigits)
  const end = toCount(endDigits)

  // `-` a secas no designa nada: malformado ⇒ ignorar.
  if (start === null && end === null) return IGNORE

  // Forma sufijo `bytes=-N`: los últimos N bytes.
  if (start === null) {
    const suffix = end as number
    // Un sufijo de longitud cero nunca es satisfacible.
    if (suffix === 0) return UNSATISFIABLE
    if (size === 0) return UNSATISFIABLE
    // Un sufijo mayor que el objeto devuelve el objeto completo, como 206.
    const from = suffix >= size ? 0 : size - suffix
    return { kind: 'satisfiable', start: from, end: size - 1 }
  }

  // Formas `bytes=N-` y `bytes=N-M`.
  // `start >= size` cubre también el caso `size === 0`.
  if (start >= size) return UNSATISFIABLE

  const last = end === null ? size - 1 : Math.min(end, size - 1)
  if (last < start) return UNSATISFIABLE

  return { kind: 'satisfiable', start, end: last }
}

/** Valor de `Content-Range` para una respuesta 206. */
export function contentRange(start: number, end: number, size: number): string {
  return `bytes ${start}-${end}/${size}`
}

/** Valor de `Content-Range` para una respuesta 416. */
export function unsatisfiedContentRange(size: number): string {
  return `bytes */${size}`
}
