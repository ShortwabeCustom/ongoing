/**
 * Resolución y validación del root del almacén privado de evidencias.
 *
 * ADR-001 (P1-B) — D1 (almacén privado durable fuera de repo/build/tmp),
 * D14 (configuración fail-closed y memoizada por proceso), D15 (permisos).
 *
 * IMPORTANTE (D14.1): la validación es LAZY. Este módulo no lee
 * `process.env` ni toca el filesystem en tiempo de import, de modo que
 * `next build` no requiere `EVIDENCE_STORAGE_DIR`.
 *
 * DORMANT en P1-B.1: ningún código productivo llama todavía a
 * `getEvidenceStorageRoot()`. La conmutación ocurre en P1-B.2.
 */

import fs from 'node:fs'
import path from 'node:path'
import { StorageConfigError } from './storage-errors'

export const EVIDENCE_STORAGE_DIR_ENV = 'EVIDENCE_STORAGE_DIR'

/** Modo exacto exigido al root y a sus subdirectorios (D15). */
export const REQUIRED_DIR_MODE = 0o700

/** Modo exacto exigido a los ficheros de evidencia (D15). */
export const REQUIRED_FILE_MODE = 0o600

type RootResolution =
  | { ok: true; root: string }
  | { ok: false; error: StorageConfigError }

/**
 * Memoización por proceso del resultado de la validación (D14.1).
 *
 * Se memoiza TANTO el éxito COMO el error: un root inválido no se revalida en
 * cada petición. La consecuencia operativa es deliberada — corregir path,
 * permisos u owner exige un restart/reload del proceso, no se recoge en
 * caliente.
 */
let memo: RootResolution | undefined

/**
 * Resuelve symlinks. Si la ruta no existe todavía, devuelve la original:
 * el fallo por inexistencia se reporta después, con su propio mensaje.
 */
function realpathOrSelf(target: string): string {
  try {
    return fs.realpathSync(target)
  } catch {
    return target
  }
}

/**
 * ¿`child` está dentro de `parent`, o es el propio `parent`?
 *
 * Comparación por segmentos, NUNCA por prefijo de cadena: `/tmpfoo` no está
 * dentro de `/tmp`, aunque comparta prefijo textual.
 */
function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child)
  if (rel === '') return true
  if (path.isAbsolute(rel)) return false
  // `..` exacto o `../algo` ⇒ fuera. Un directorio llamado `..foo` sí está dentro.
  if (rel === '..' || rel.startsWith(`..${path.sep}`)) return false
  return true
}

/**
 * Zonas prohibidas para el root (D1).
 *
 * `process.cwd()` cubre por contención el repositorio completo, `public/` y el
 * árbol de build `.next/`. Se incluyen los realpath porque en macOS `/tmp` y
 * `/var/tmp` son symlinks a `/private/...`.
 */
function forbiddenZones(): string[] {
  const zones = [process.cwd(), '/tmp', '/var/tmp']
  const withReal = zones.flatMap((zone) => [zone, realpathOrSelf(zone)])
  return Array.from(new Set(withReal))
}

function resolveRoot(): RootResolution {
  const raw = process.env[EVIDENCE_STORAGE_DIR_ENV]

  // 1. Presente y no vacío.
  if (!raw || raw.trim() === '') {
    return {
      ok: false,
      error: new StorageConfigError(
        `${EVIDENCE_STORAGE_DIR_ENV} no está definida. El almacén de evidencias es obligatorio y no tiene fallback.`,
      ),
    }
  }

  const candidate = raw.trim()

  // 2. Absoluta.
  if (!path.isAbsolute(candidate)) {
    return {
      ok: false,
      error: new StorageConfigError(
        `${EVIDENCE_STORAGE_DIR_ENV} debe ser una ruta absoluta.`,
      ),
    }
  }

  // 3. Resolver symlinks ANTES de comparar zonas prohibidas: si no, un symlink
  //    que apunte dentro de /tmp burlaría la comprobación.
  const root = realpathOrSelf(path.normalize(candidate))

  // 4. Zonas prohibidas.
  for (const zone of forbiddenZones()) {
    if (isInside(zone, root)) {
      return {
        ok: false,
        error: new StorageConfigError(
          `${EVIDENCE_STORAGE_DIR_ENV} no puede estar dentro de ${zone} (repositorio, árbol de build o directorio temporal).`,
        ),
      }
    }
  }

  // 5. Existe y es un directorio.
  let stats: fs.Stats
  try {
    stats = fs.statSync(root)
  } catch (error) {
    return {
      ok: false,
      error: new StorageConfigError(
        `${EVIDENCE_STORAGE_DIR_ENV} apunta a una ruta inexistente o inaccesible.`,
        { cause: error },
      ),
    }
  }

  if (!stats.isDirectory()) {
    return {
      ok: false,
      error: new StorageConfigError(
        `${EVIDENCE_STORAGE_DIR_ENV} debe apuntar a un directorio.`,
      ),
    }
  }

  // 6. Legible y escribible por el proceso.
  try {
    fs.accessSync(root, fs.constants.R_OK | fs.constants.W_OK)
  } catch (error) {
    return {
      ok: false,
      error: new StorageConfigError(
        `${EVIDENCE_STORAGE_DIR_ENV} no es legible y escribible por el proceso.`,
        { cause: error },
      ),
    }
  }

  // 7. Owner y permisos exactos (D15). La aplicación NUNCA hace chown ni
  //    corrige el modo: un root preexistente inseguro es fail closed.
  if (typeof process.getuid === 'function' && stats.uid !== process.getuid()) {
    return {
      ok: false,
      error: new StorageConfigError(
        `${EVIDENCE_STORAGE_DIR_ENV} debe pertenecer al usuario que ejecuta el proceso.`,
      ),
    }
  }

  const mode = stats.mode & 0o777
  if (mode !== REQUIRED_DIR_MODE) {
    return {
      ok: false,
      error: new StorageConfigError(
        `${EVIDENCE_STORAGE_DIR_ENV} debe tener permisos 0700; tiene 0${mode.toString(8)}.`,
      ),
    }
  }

  return { ok: true, root }
}

/**
 * Devuelve el root validado del almacén privado.
 *
 * Lanza `StorageConfigError` si la configuración no es utilizable (D14).
 * El resultado —éxito o error— se memoiza por proceso.
 */
export function getEvidenceStorageRoot(): string {
  if (memo === undefined) {
    memo = resolveRoot()
  }
  if (!memo.ok) {
    throw memo.error
  }
  return memo.root
}

/**
 * Limpia la memoización. EXCLUSIVAMENTE para tests: en producción, invalidar
 * la configuración en caliente contradiría D14.1 (hace falta restart/reload).
 */
export function __resetEvidenceStorageRootForTests(): void {
  memo = undefined
}
