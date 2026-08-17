/**
 * C-01 · Presentación de valores de `AuditLog`.
 *
 * `audit_logs.before` / `audit_logs.after` son columnas `Json?` que guardan el
 * snapshot completo de la fila (`toAuditJson(current)` / `toAuditJson(after)` en
 * `lib/services/finding-service.ts`). Ese snapshot incluye las tablas join tal
 * cual las devuelve Prisma, es decir arrays de objetos:
 *
 *   incidenceTypes: [{ findingId, incidenceType }]
 *   experienceTags: [{ findingId, experienceTag }]
 *   supportLinks:   [{ id, title, url, createdAt, updatedAt }]
 *
 * El visor insertaba esos valores directamente como hijos de React
 * (`{key}: {before} → {value}`), lo que provocaba el error #31 y derribaba el
 * detalle completo del hallazgo.
 *
 * Este módulo es la ÚNICA frontera entre ese JSON arbitrario y el árbol de
 * React. Contrato:
 *
 *   1. `formatAuditValue` devuelve SIEMPRE un string. Nunca un objeto, nunca
 *      `"[object Object]"`, nunca lanza.
 *   2. Es determinista: la misma entrada produce siempre la misma salida
 *      (las claves se serializan ordenadas).
 *   3. No oculta campos: un valor problemático se muestra de forma degradada,
 *      no se descarta — el historial debe seguir siendo útil para una persona.
 *   4. No infla la interfaz: los volcados se truncan.
 *
 * Este módulo NO toca datos persistidos: es exclusivamente de presentación.
 */

/** Longitud máxima de un valor renderizado, incluido el carácter de elisión. */
const MAX_LENGTH = 200

const ABSENT_VALUE = '(sin dato)'
const NULL_VALUE = '(vacío)'
const EMPTY_STRING = '(cadena vacía)'
const EMPTY_LIST = '(lista vacía)'
const UNREPRESENTABLE = '(valor no representable)'

export type AuditChange = {
  key: string
  before: string
  after: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function truncate(text: string): string {
  if (text.length <= MAX_LENGTH) return text
  return `${text.slice(0, MAX_LENGTH - 1)}…`
}

/**
 * Presentadores por campo conocido del dominio.
 *
 * Para las tablas join, un volcado JSON repetiría `findingId` en cada entrada y
 * no aportaría nada: lo útil para quien lee el historial es el valor del enum.
 * Para `supportLinks`, el título y la URL; los ids y timestamps son ruido.
 *
 * Cualquier campo no listado aquí cae al tratamiento genérico, que sigue siendo
 * seguro (ver `formatUnknown`).
 */
const ITEM_PRESENTERS: Record<string, (entry: Record<string, unknown>) => string | null> = {
  incidenceTypes: (entry) => scalarToText(entry.incidenceType),
  experienceTags: (entry) => scalarToText(entry.experienceTag),
  supportLinks: (entry) => {
    const url = scalarToText(entry.url)
    const title = scalarToText(entry.title)
    if (url && title) return `${title} (${url})`
    return url ?? title
  },
  evidence: (entry) =>
    scalarToText(entry.caption) ?? scalarToText(entry.originalFilename) ?? scalarToText(entry.url),
}

/** Devuelve el texto de un escalar utilizable como etiqueta, o `null`. */
function scalarToText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.length > 0 ? value : null
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  return null
}

/**
 * Serialización determinista y acotada para formas que nadie anticipó.
 * Las claves se ordenan para que la salida no dependa del orden de inserción.
 */
function formatUnknown(value: unknown): string {
  const seen = new WeakSet<object>()

  const canonical = (input: unknown): unknown => {
    if (typeof input === 'bigint') return String(input)
    if (typeof input === 'function') return '(función)'
    if (typeof input === 'symbol') return String(input)
    if (typeof input === 'number' && !Number.isFinite(input)) return String(input)
    if (input instanceof Date) return input.toISOString()
    if (Array.isArray(input)) return input.map(canonical)
    if (isPlainObject(input)) {
      if (seen.has(input)) return '(referencia circular)'
      seen.add(input)
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(input).sort()) {
        out[key] = canonical(input[key])
      }
      return out
    }
    return input
  }

  try {
    const serialized = JSON.stringify(canonical(value))
    if (serialized === undefined) return UNREPRESENTABLE
    return truncate(serialized)
  } catch {
    return UNREPRESENTABLE
  }
}

/**
 * Convierte cualquier valor de `AuditLog` en un string apto para React.
 *
 * @param value valor crudo tomado de `log.before[key]` o `log.after[key]`
 * @param key   nombre del campo, usado para elegir un presentador de dominio
 */
export function formatAuditValue(value: unknown, key?: string): string {
  if (value === undefined) return ABSENT_VALUE
  if (value === null) return NULL_VALUE

  if (typeof value === 'string') return value.length === 0 ? EMPTY_STRING : truncate(value)

  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'bigint') return String(value)
  if (typeof value === 'symbol') return String(value)
  if (typeof value === 'function') return '(función)'
  if (value instanceof Date) return value.toISOString()

  if (Array.isArray(value)) {
    if (value.length === 0) return EMPTY_LIST

    const presenter = key ? ITEM_PRESENTERS[key] : undefined
    const parts: string[] = []

    for (const item of value) {
      if (presenter && isPlainObject(item)) {
        const label = presenter(item)
        // Si el presentador de dominio no encuentra su campo, se degrada al
        // tratamiento genérico en vez de perder la entrada.
        parts.push(label ?? formatUnknown(item))
        continue
      }

      const scalar = scalarToText(item)
      parts.push(scalar ?? (item === null ? NULL_VALUE : formatUnknown(item)))
    }

    return truncate(parts.join(', '))
  }

  return formatUnknown(value)
}

/**
 * Igualdad por VALOR, no por referencia.
 *
 * El código anterior comparaba con `before === value`. Para arrays y objetos eso
 * es siempre `false` aunque el contenido sea idéntico, así que TODA entrada
 * `UPDATE` listaba `incidenceTypes`/`experienceTags` como cambiados sin haber
 * cambiado. Ahogar el diff real en cambios fantasma es perder información.
 */
export function auditValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined) return false
  if (a === null || b === null) return false

  const bothStructured =
    (Array.isArray(a) || isPlainObject(a)) && (Array.isArray(b) || isPlainObject(b))
  if (!bothStructured) return false

  return formatUnknown(a) === formatUnknown(b)
}

/**
 * Diff presentable entre dos snapshots de auditoría.
 *
 * Devuelve sólo los campos con un cambio real, con ambos lados ya convertidos a
 * string. Incluye las claves presentes en un único lado (por ejemplo
 * `supportLinks`, que el snapshot `before` omite y el `after` incluye — asimetría
 * ya documentada en §14.7/§15.7, ajena a C-01 y no corregida aquí).
 */
export function getAuditChanges(before: unknown, after: unknown): AuditChange[] {
  if (!isPlainObject(before) || !isPlainObject(after)) return []

  const keys: string[] = Object.keys(after)
  for (const key of Object.keys(before)) {
    if (!keys.includes(key)) keys.push(key)
  }

  const changes: AuditChange[] = []
  for (const key of keys) {
    const beforeValue = before[key]
    const afterValue = after[key]
    if (auditValuesEqual(beforeValue, afterValue)) continue

    changes.push({
      key,
      before: formatAuditValue(beforeValue, key),
      after: formatAuditValue(afterValue, key),
    })
  }

  return changes
}
