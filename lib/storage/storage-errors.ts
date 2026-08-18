/**
 * Errores tipados de la capa de almacenamiento privado de evidencias.
 *
 * ADR-001 (P1-B) — docs/DECISIONS/ADR-001-evidence-storage-and-authorized-file-delivery.md
 *
 * Cada error lleva un `code` estable para que las capas superiores puedan
 * clasificarlo sin inspeccionar mensajes ni `unknown`. En particular, D6.2
 * exige distinguir `ENOENT` (éxito idempotente del purge) de
 * `EACCES`/`EIO`/`EPERM` (fallo real que debe propagarse), y `StorageIOError`
 * conserva ese errno original para hacerlo posible.
 */

export type StorageErrorCode =
  | 'STORAGE_UNAVAILABLE'
  | 'INVALID_STORAGE_KEY'
  | 'STORAGE_IO_ERROR'

export class StorageError extends Error {
  readonly code: StorageErrorCode

  constructor(code: StorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = new.target.name
    this.code = code
    if (options && 'cause' in options) {
      // `cause` se asigna explícitamente para no depender del target de TS.
      Object.defineProperty(this, 'cause', {
        value: options.cause,
        configurable: true,
        writable: true,
      })
    }
  }
}

/**
 * La configuración del almacén no es utilizable (D14).
 *
 * Fail closed: nunca hay fallback a `public/`, a un directorio temporal, ni
 * degradación a "servir de todos modos".
 */
export class StorageConfigError extends StorageError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('STORAGE_UNAVAILABLE', message, options)
  }
}

/**
 * La clave de almacenamiento es inválida o insegura (D3).
 *
 * Se lanza desde `resolveSafePath` ANTES de tocar el filesystem. Nunca se
 * "corrige" una clave: se rechaza.
 */
export class InvalidStorageKeyError extends StorageError {
  constructor(message: string) {
    super('INVALID_STORAGE_KEY', message)
  }
}

/**
 * Fallo de E/S del filesystem.
 *
 * `errno` preserva el código original (`EACCES`, `EIO`, `EPERM`, `ENOENT`, …)
 * para que el purge (D6.2) pueda clasificarlo sin re-inspeccionar la causa.
 */
export class StorageIOError extends StorageError {
  readonly errno?: string

  constructor(message: string, options?: { cause?: unknown; errno?: string }) {
    super('STORAGE_IO_ERROR', message, options)
    this.errno = options?.errno
  }
}

/** Extrae el código errno de un error desconocido de `fs`, si lo tiene. */
export function errnoOf(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return undefined
}
