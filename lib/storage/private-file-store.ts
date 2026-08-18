/**
 * Almacén privado de evidencias en filesystem local.
 *
 * ADR-001 (P1-B) — D3 (frontera estricta + resolveSafePath), D15 (permisos),
 * D15-bis.1 (escritura atómica con temporales seguros).
 *
 * Esta clase es la ÚNICA frontera de path/fs del almacén privado: ninguna otra
 * capa construye rutas de fichero, resuelve paths ni llama a `fs` directamente.
 *
 * Desde P1-B.2 es el almacén productivo de la evidencia de runtime:
 * `StorageService` escribe aquí siguiendo la máquina FASE 0-3 (D5.2). El
 * cliente antiguo sobre `public/evidence` queda sin caller productivo.
 *
 * NO existe `getStream` todavía: se añade en P1-B.3, con READ y HTTP Range.
 */

import { randomBytes } from 'node:crypto'
import { constants as fsConstants, promises as fs, type Stats } from 'node:fs'
import path from 'node:path'
import { InvalidStorageKeyError, StorageIOError, errnoOf } from './storage-errors'
import { isLegacyStorageKey } from './storage-key'
import {
  REQUIRED_DIR_MODE,
  REQUIRED_FILE_MODE,
  getEvidenceStorageRoot,
} from './storage-root'

// NUL y caracteres de control C0 (0x00-0x1f), DEL (0x7f) y C1 (0x80-0x9f).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/
const WINDOWS_DRIVE = /^[A-Za-z]:/

/** Patrón exacto de los temporales de escritura atómica (D15-bis.2). */
export const TEMP_FILE_PATTERN = /^\.tmp-[A-Za-z0-9_-]+\.part$/

/**
 * Resuelve una clave de almacenamiento a una ruta absoluta segura dentro de
 * `root`, o lanza `InvalidStorageKeyError` (D3).
 *
 * EL ORDEN DE LOS PASOS ES NORMATIVO:
 *   decode una vez -> rechazar `..` ANTES de normalizar -> forma canónica
 *   relativa -> comprobar el namespace legacy sobre ESA forma -> resolve ->
 *   contención final.
 *
 * La detección de `..` va antes de normalizar porque `path.normalize` colapsa
 * `a/../b` en `b`: normalizar primero haría desaparecer el `..` antes de poder
 * rechazarlo. Se rechazan claves con `..` aunque no lleguen a escapar del root.
 *
 * La comprobación de legacy va DESPUÉS de canonizar, porque de lo contrario
 * `./legacy/...` o `%2e/legacy/...` esquivarían el prefijo literal y entrarían
 * al almacén privado apuntando al namespace legacy.
 */
export function resolveSafePath(root: string, key: unknown): string {
  // (a) Validación de la cadena cruda.
  if (typeof key !== 'string' || key.trim() === '') {
    throw new InvalidStorageKeyError('La clave de almacenamiento está vacía o no es una cadena.')
  }
  if (CONTROL_CHARS.test(key)) {
    throw new InvalidStorageKeyError('La clave contiene NUL o caracteres de control.')
  }

  // (b) Rutas absolutas, unidades Windows y separadores peligrosos.
  if (path.isAbsolute(key) || WINDOWS_DRIVE.test(key) || key.includes('\\')) {
    throw new InvalidStorageKeyError('La clave no puede ser absoluta ni contener backslashes.')
  }

  // (c) Decodificación percent-encoding, UNA sola vez, con error explícito.
  let decoded: string
  try {
    decoded = decodeURIComponent(key)
  } catch {
    throw new InvalidStorageKeyError('La clave tiene percent-encoding malformado.')
  }

  // Re-validar tras decodificar: `%00` y `%5c` reintroducen lo filtrado en (a)/(b).
  if (CONTROL_CHARS.test(decoded)) {
    throw new InvalidStorageKeyError('La clave decodificada contiene NUL o caracteres de control.')
  }
  if (path.isAbsolute(decoded) || WINDOWS_DRIVE.test(decoded) || decoded.includes('\\')) {
    throw new InvalidStorageKeyError(
      'La clave decodificada no puede ser absoluta ni contener backslashes.',
    )
  }

  // (d) Segmentos `..` SOBRE LA CADENA DECODIFICADA Y ANTES DE NORMALIZAR.
  if (decoded.split('/').some((segment) => segment === '..')) {
    throw new InvalidStorageKeyError('La clave contiene un segmento de traversal "..".')
  }

  // (e) Forma canónica relativa. `path.posix.normalize` colapsa `./`, `//` y
  //     segmentos vacíos SIN poder reintroducir traversal, porque (d) ya
  //     rechazó cualquier `..`. Es imprescindible hacerlo antes de comprobar el
  //     namespace legacy: `./legacy/foo.png`, `%2e/legacy/foo.png` y
  //     `././legacy/foo.png` no empiezan literalmente por `legacy/` pero
  //     resuelven todas a `<root>/legacy/foo.png`.
  const canonical = path.posix.normalize(decoded)

  // (f) Legacy sobre la FORMA CANÓNICA: el almacén privado no sirve material
  //     legacy en ninguna de sus representaciones equivalentes (D9).
  if (isLegacyStorageKey(canonical)) {
    throw new InvalidStorageKeyError('Las claves legacy no pertenecen al almacén privado.')
  }

  // (g) Resolver.
  const resolved = path.resolve(root, canonical)

  // (h) Red final de contención: el resultado debe caer estrictamente dentro
  //     del root. No sustituye a (d), es la última barrera.
  const rel = path.relative(root, resolved)
  if (rel === '' || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new InvalidStorageKeyError('La clave resuelve fuera del almacén.')
  }

  return resolved
}

function ioError(message: string, error: unknown): StorageIOError {
  return new StorageIOError(message, { cause: error, errno: errnoOf(error) })
}

function containmentError(message: string): StorageIOError {
  return new StorageIOError(message, { errno: 'ESTORAGEUNSAFE' })
}

/**
 * Comprueba que el uid del propietario es el del proceso.
 * En plataformas sin `getuid` (Windows) la comprobación no aplica.
 */
function ownerIsProcessUser(uid: number): boolean {
  if (typeof process.getuid !== 'function') return true
  return uid === process.getuid()
}

/**
 * Recorre la cadena de directorios desde `root` hasta `dir` verificando la
 * contención REAL contra el filesystem.
 *
 * `resolveSafePath` solo valida cadenas: `path.resolve`/`path.relative` no
 * consultan el disco, así que NO protegen contra un symlink preexistente en
 * un componente intermedio. Esta función es la que aporta esa garantía.
 *
 * En cada nivel:
 *   - `mkdir` sin `recursive` (solo si `create`); `EEXIST` ⇒ preexistente;
 *   - `lstat`, NUNCA `stat`: un symlink se detecta en vez de seguirse;
 *   - symlink, no-directorio u owner ajeno ⇒ fail-closed;
 *   - `chmod` SOLO si esta misma invocación acaba de crear el directorio.
 *     Un directorio preexistente con modo != 0700 es un error, jamás se
 *     "repara" en silencio (D15).
 *
 * Devuelve `'missing'` si algún componente no existe y `create` es `false`.
 *
 * LIMITACIÓN CONOCIDA (TOCTOU): entre el `lstat` de un componente y su uso
 * posterior existe una ventana de carrera. Cerrarla por completo exigiría
 * `openat(2)` con `O_NOFOLLOW` por componente, que Node no expone. El
 * componente final sí queda protegido con `O_NOFOLLOW` al abrir el temporal.
 * El riesgo residual sobre los intermedios se acepta porque el root es 0700 y
 * de propiedad exclusiva del usuario del proceso: quien pueda crear symlinks
 * ahí dentro ya posee esa identidad.
 */
async function walkDirChain(
  root: string,
  dir: string,
  options: { create: boolean },
): Promise<'ok' | 'missing'> {
  const rel = path.relative(root, dir)
  if (rel === '') return 'ok'

  let current = root
  for (const segment of rel.split(path.sep)) {
    current = path.join(current, segment)

    let created = false
    if (options.create) {
      try {
        await fs.mkdir(current, { mode: REQUIRED_DIR_MODE })
        created = true
      } catch (error) {
        if (errnoOf(error) !== 'EEXIST') {
          throw ioError('No se pudo preparar el directorio de destino.', error)
        }
      }
    }

    let stats: Stats
    try {
      stats = await fs.lstat(current)
    } catch (error) {
      if (!options.create && errnoOf(error) === 'ENOENT') return 'missing'
      throw ioError('No se pudo inspeccionar el directorio del almacén.', error)
    }

    if (stats.isSymbolicLink()) {
      throw containmentError(
        'Un componente de la ruta es un enlace simbólico: el almacén no atraviesa symlinks.',
      )
    }
    if (!stats.isDirectory()) {
      throw containmentError('Un componente de la ruta no es un directorio.')
    }
    if (!ownerIsProcessUser(stats.uid)) {
      throw containmentError(
        'Un componente de la ruta no pertenece al usuario que ejecuta el proceso.',
      )
    }

    if (created) {
      // Solo se ajusta el modo de lo que ACABAMOS de crear: `mkdir({ mode })`
      // está sujeto al umask, que solo puede quitar bits.
      await fs.chmod(current, REQUIRED_DIR_MODE)
    } else if ((stats.mode & 0o777) !== REQUIRED_DIR_MODE) {
      throw containmentError(
        `Un directorio preexistente tiene permisos 0${(stats.mode & 0o777).toString(8)} en lugar de 0700.`,
      )
    }
  }

  return 'ok'
}

/**
 * `lstat` del objeto final, rechazando symlinks y cualquier cosa que no sea un
 * fichero regular. Nunca sigue enlaces (D3).
 */
async function lstatObject(
  filePath: string,
): Promise<Stats | 'missing'> {
  let stats: Stats
  try {
    stats = await fs.lstat(filePath)
  } catch (error) {
    if (errnoOf(error) === 'ENOENT') return 'missing'
    throw ioError('No se pudo inspeccionar el objeto de evidencia.', error)
  }

  if (stats.isSymbolicLink()) {
    throw containmentError(
      'El objeto de evidencia es un enlace simbólico: el almacén no lo sigue.',
    )
  }
  if (!stats.isFile()) {
    throw containmentError('El objeto de evidencia no es un fichero regular.')
  }
  return stats
}

/** Nombre de temporal compatible con `TEMP_FILE_PATTERN`. */
function tempName(): string {
  return `.tmp-${randomBytes(12).toString('base64url')}.part`
}

export interface StoredObjectStat {
  size: number
  mtimeMs: number
}

export class PrivateFileStore {
  /** Root validado. Lanza `StorageConfigError` si la configuración es inválida (D14). */
  private static root(): string {
    return getEvidenceStorageRoot()
  }

  /**
   * Escribe un objeto de forma atómica (D15-bis.1).
   *
   * Secuencia: temporal `.tmp-{token}.part` en el MISMO directorio destino
   * (temporal y final comparten directorio y filesystem, condición necesaria
   * para `link`), abierto con `O_CREAT | O_EXCL | O_WRONLY | O_NOFOLLOW` y modo
   * 0600, `write` -> `fsync` -> `link(temp, final)` -> `unlink(temp)`. Si algo
   * falla antes del `link`, el temporal se limpia best-effort.
   *
   * PUBLICACIÓN NO-CLOBBER: la `storageKey` de runtime es INMUTABLE y este
   * método NUNCA sobrescribe un objeto final existente. Por eso se publica con
   * `link` y no con `rename`: `rename(2)` reemplaza atómicamente un destino
   * existente —permitiendo un overwrite silencioso en el que dos escritores
   * concurrentes terminan ambos con éxito y gana el último—, mientras que
   * `link(2)` crea la entrada final de forma atómica y falla con `EEXIST` si ya
   * existe. Ese `EEXIST` se propaga como `StorageIOError`.
   *
   * Nunca se escribe directamente sobre la ruta final: un fallo a mitad de
   * subida no puede dejar un fichero final truncado.
   */
  static async put(key: unknown, body: Buffer): Promise<void> {
    const root = this.root()
    const filePath = resolveSafePath(root, key)
    const dir = path.dirname(filePath)

    await walkDirChain(root, dir, { create: true })

    // Si ya hay algo en el destino final, debe ser un fichero regular: nunca se
    // escribe a través de un symlink que sustituya al objeto. (El no-clobber lo
    // garantiza el `link` de más abajo, no esta comprobación.)
    await lstatObject(filePath)

    const tempPath = path.join(dir, tempName())
    let handle: Awaited<ReturnType<typeof fs.open>> | undefined

    try {
      // O_EXCL impide reutilizar un temporal existente; O_NOFOLLOW impide que
      // el componente final sea un symlink.
      handle = await fs.open(
        tempPath,
        fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW,
        REQUIRED_FILE_MODE,
      )
      await handle.writeFile(body)
      await handle.sync()
      await handle.close()
      handle = undefined

      // Determinista frente al umask (D15).
      await fs.chmod(tempPath, REQUIRED_FILE_MODE)

      // Publicación atómica no-clobber: falla con EEXIST si la clave ya existe.
      await fs.link(tempPath, filePath)
    } catch (error) {
      if (handle) {
        await handle.close().catch(() => {})
      }
      // Cleanup best-effort del temporal: no debe enmascarar el error original.
      // Incluye el caso EEXIST, en el que el destino NO se ha modificado.
      await fs.unlink(tempPath).catch(() => {})
      throw ioError('No se pudo escribir el objeto de evidencia.', error)
    }

    // El objeto final YA está publicado. A partir de aquí el `put` es un éxito
    // pase lo que pase: si el `unlink` del temporal falla —o el proceso muere
    // antes de ejecutarlo—, queda un temporal huérfano que recogerá el cleanup
    // de D15-bis.2. Convertir eso en un fallo de publicación sería incorrecto.
    await fs.unlink(tempPath).catch(() => {})
  }

  /** Metadatos del objeto. Base para la entrega por rangos de P1-B.3. */
  static async stat(key: unknown): Promise<StoredObjectStat> {
    const root = this.root()
    const filePath = resolveSafePath(root, key)

    if ((await walkDirChain(root, path.dirname(filePath), { create: false })) === 'missing') {
      throw new StorageIOError('El objeto de evidencia no existe.', { errno: 'ENOENT' })
    }

    const stats = await lstatObject(filePath)
    if (stats === 'missing') {
      throw new StorageIOError('El objeto de evidencia no existe.', { errno: 'ENOENT' })
    }
    return { size: stats.size, mtimeMs: stats.mtimeMs }
  }

  /**
   * ¿Existe el objeto?
   *
   * `ENOENT` => `false`. Cualquier otro error (p. ej. `EACCES`) se propaga: no
   * se colapsa un problema de permisos en un "no existe", que llevaría a
   * conclusiones falsas en purge y restore.
   */
  static async exists(key: unknown): Promise<boolean> {
    const root = this.root()
    const filePath = resolveSafePath(root, key)

    if ((await walkDirChain(root, path.dirname(filePath), { create: false })) === 'missing') {
      return false
    }
    return (await lstatObject(filePath)) !== 'missing'
  }

  /**
   * Elimina el objeto.
   *
   * `ENOENT` es un ÉXITO IDEMPOTENTE (D6.2): el objetivo es que los bytes no
   * estén; si ya no están, la operación cumplió. `EACCES`/`EIO`/`EPERM` y
   * equivalentes se propagan como `StorageIOError`.
   */
  static async delete(key: unknown): Promise<void> {
    const root = this.root()
    const filePath = resolveSafePath(root, key)

    if ((await walkDirChain(root, path.dirname(filePath), { create: false })) === 'missing') {
      return
    }

    // Un symlink en el destino final es una anomalía: `lstatObject` lanza en
    // lugar de operar sobre él. Borrar el enlace enmascararía la manipulación.
    if ((await lstatObject(filePath)) === 'missing') return

    try {
      await fs.unlink(filePath)
    } catch (error) {
      if (errnoOf(error) === 'ENOENT') return
      throw ioError('No se pudo eliminar el objeto de evidencia.', error)
    }
  }
}
