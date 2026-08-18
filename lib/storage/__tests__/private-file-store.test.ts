// @vitest-environment node
/**
 * ADR-001 — D15 (permisos 0700/0600 deterministas) y D15-bis.1 (escritura
 * atómica: temporal exclusivo con `O_CREAT | O_EXCL | O_WRONLY | O_NOFOLLOW`,
 * `fsync`, publicación no-clobber con `link` y `unlink` del temporal, con
 * cleanup best-effort si algo falla antes del `link`).
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { InvalidStorageKeyError, StorageIOError } from '../storage-errors'
import {
  PrivateFileStore,
  TEMP_FILE_PATTERN,
} from '../private-file-store'
import {
  EVIDENCE_STORAGE_DIR_ENV,
  __resetEvidenceStorageRootForTests,
} from '../storage-root'
import { cleanupRoots, makeValidRoot } from './test-roots'

const ORIGINAL = process.env[EVIDENCE_STORAGE_DIR_ENV]
const KEY = 'findings/find_1/ev_1/captura.png'
const BODY = Buffer.from('contenido-de-evidencia')

let root: string
let originalUmask: number

beforeEach(() => {
  root = makeValidRoot()
  process.env[EVIDENCE_STORAGE_DIR_ENV] = root
  __resetEvidenceStorageRootForTests()
  // umask permisivo: si el modo no se fijara con chmod explícito, los ficheros
  // saldrían 0666 y los directorios 0777.
  originalUmask = process.umask(0o000)
})

afterEach(() => {
  process.umask(originalUmask)
  if (ORIGINAL === undefined) delete process.env[EVIDENCE_STORAGE_DIR_ENV]
  else process.env[EVIDENCE_STORAGE_DIR_ENV] = ORIGINAL
  __resetEvidenceStorageRootForTests()
})

afterAll(() => {
  cleanupRoots()
})

function modeOf(target: string): number {
  // lstat, por consistencia con symlink-containment.test.ts: nunca se sigue un
  // enlace para leer permisos.
  return fs.lstatSync(target).mode & 0o777
}

describe('put — escritura atómica y permisos', () => {
  it('escribe el fichero con el contenido correcto', async () => {
    await PrivateFileStore.put(KEY, BODY)
    expect(fs.readFileSync(path.join(root, KEY))).toEqual(BODY)
  })

  it('crea el fichero con modo 0600 y los directorios con 0700, bajo umask permisivo', async () => {
    await PrivateFileStore.put(KEY, BODY)

    expect(modeOf(path.join(root, KEY))).toBe(0o600)
    expect(modeOf(path.join(root, 'findings'))).toBe(0o700)
    expect(modeOf(path.join(root, 'findings/find_1'))).toBe(0o700)
    expect(modeOf(path.join(root, 'findings/find_1/ev_1'))).toBe(0o700)
  })

  it('no deja ningún temporal tras una escritura correcta', async () => {
    await PrivateFileStore.put(KEY, BODY)
    const dir = path.join(root, 'findings/find_1/ev_1')
    const leftovers = fs.readdirSync(dir).filter((name) => TEMP_FILE_PATTERN.test(name))
    expect(leftovers).toEqual([])
  })

  it('el nombre del temporal casa con el patrón exacto de D15-bis.2', () => {
    // Se valida el patrón contra nombres representativos, ya que el temporal
    // no sobrevive a una escritura correcta.
    expect(TEMP_FILE_PATTERN.test('.tmp-AbC123_-xyz.part')).toBe(true)
    expect(TEMP_FILE_PATTERN.test('.tmp-.part')).toBe(false)
    expect(TEMP_FILE_PATTERN.test('.tmp-a.part.bak')).toBe(false)
    expect(TEMP_FILE_PATTERN.test('tmp-a.part')).toBe(false)
    expect(TEMP_FILE_PATTERN.test('captura.png')).toBe(false)
  })

  it('NO sobrescribe una clave ya publicada: la storageKey es inmutable', async () => {
    // Contrato no-clobber (D15-bis.1). El test anterior afirmaba lo contrario
    // —que el segundo put ganaba— porque la publicación usaba `rename`, que
    // reemplaza el destino. Ahora se publica con `link`, que falla con EEXIST.
    await PrivateFileStore.put(KEY, BODY)
    const nuevo = Buffer.from('contenido-nuevo')

    await expect(PrivateFileStore.put(KEY, nuevo)).rejects.toBeInstanceOf(StorageIOError)
    expect(fs.readFileSync(path.join(root, KEY))).toEqual(BODY)
  })

  it('si falla antes del link no deja fichero final y limpia el temporal', async () => {
    // Se fuerza el fallo justo en el link: es el paso de publicación, así que el
    // temporal ya existe en disco y el camino de cleanup queda ejercitado.
    const spy = vi
      .spyOn(fs.promises, 'link')
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'EIO' }))

    const key = 'findings/find_2/ev_2/x.png'
    await expect(PrivateFileStore.put(key, BODY)).rejects.toBeInstanceOf(StorageIOError)
    spy.mockRestore()

    const dir = path.join(root, 'findings/find_2/ev_2')
    expect(fs.existsSync(path.join(root, key))).toBe(false)
    expect(fs.readdirSync(dir).filter((n) => TEMP_FILE_PATTERN.test(n))).toEqual([])
  })

  it('preserva el errno original al envolver el fallo en StorageIOError', async () => {
    const spy = vi
      .spyOn(fs.promises, 'link')
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'EIO' }))
    try {
      await PrivateFileStore.put('findings/find_3/ev_3/y.png', BODY)
      expect.unreachable('put debería haber fallado')
    } catch (error) {
      expect((error as StorageIOError).errno).toBe('EIO')
    } finally {
      spy.mockRestore()
    }
  })

  it('NO repara un subdirectorio preexistente con permisos laxos: es fail-closed', async () => {
    // Contrato de seguridad: solo se chmodea un directorio que ESTA MISMA
    // operación acaba de crear. Un preexistente con modo distinto de 0700 es un
    // error, nunca una reparación silenciosa (D15).
    const dir = path.join(root, 'findings')
    fs.mkdirSync(dir, { mode: 0o700 })
    fs.chmodSync(dir, 0o777)

    await expect(PrivateFileStore.put(KEY, BODY)).rejects.toBeInstanceOf(StorageIOError)
    expect(modeOf(dir)).toBe(0o777)
  })

  it('rechaza claves inválidas sin tocar el filesystem', async () => {
    await expect(PrivateFileStore.put('a/../b', BODY)).rejects.toBeInstanceOf(
      InvalidStorageKeyError,
    )
    expect(fs.readdirSync(root)).toEqual([])
  })
})

describe('stat', () => {
  it('devuelve el tamaño correcto', async () => {
    await PrivateFileStore.put(KEY, BODY)
    const stat = await PrivateFileStore.stat(KEY)
    expect(stat.size).toBe(BODY.length)
    expect(typeof stat.mtimeMs).toBe('number')
  })

  it('lanza StorageIOError con errno ENOENT si no existe', async () => {
    await expect(PrivateFileStore.stat(KEY)).rejects.toBeInstanceOf(StorageIOError)
    try {
      await PrivateFileStore.stat(KEY)
    } catch (error) {
      expect((error as StorageIOError).errno).toBe('ENOENT')
    }
  })
})

describe('exists', () => {
  it('true si existe, false si no', async () => {
    expect(await PrivateFileStore.exists(KEY)).toBe(false)
    await PrivateFileStore.put(KEY, BODY)
    expect(await PrivateFileStore.exists(KEY)).toBe(true)
  })

  it('rechaza claves inválidas', async () => {
    await expect(PrivateFileStore.exists('legacy/foo.png')).rejects.toBeInstanceOf(
      InvalidStorageKeyError,
    )
  })
})

describe('delete', () => {
  it('elimina el objeto', async () => {
    await PrivateFileStore.put(KEY, BODY)
    await PrivateFileStore.delete(KEY)
    expect(fs.existsSync(path.join(root, KEY))).toBe(false)
  })

  it('ENOENT es un éxito idempotente (D6.2)', async () => {
    await expect(PrivateFileStore.delete(KEY)).resolves.toBeUndefined()
    // Y una segunda vez tras borrar de verdad.
    await PrivateFileStore.put(KEY, BODY)
    await PrivateFileStore.delete(KEY)
    await expect(PrivateFileStore.delete(KEY)).resolves.toBeUndefined()
  })

  it('propaga los errores de permisos como StorageIOError (D6.2)', async () => {
    if (typeof process.getuid === 'function' && process.getuid() === 0) return
    await PrivateFileStore.put(KEY, BODY)
    const dir = path.join(root, 'findings/find_1/ev_1')
    fs.chmodSync(dir, 0o500)
    try {
      await expect(PrivateFileStore.delete(KEY)).rejects.toBeInstanceOf(StorageIOError)
    } finally {
      fs.chmodSync(dir, 0o700)
    }
  })
})

describe('fail-closed con configuración inválida (D14.3)', () => {
  it('toda operación falla si el root no es válido', async () => {
    process.env[EVIDENCE_STORAGE_DIR_ENV] = '/tmp/no-vale'
    __resetEvidenceStorageRootForTests()

    await expect(PrivateFileStore.put(KEY, BODY)).rejects.toThrow(/no puede estar dentro/)
    await expect(PrivateFileStore.stat(KEY)).rejects.toThrow(/no puede estar dentro/)
    await expect(PrivateFileStore.exists(KEY)).rejects.toThrow(/no puede estar dentro/)
    await expect(PrivateFileStore.delete(KEY)).rejects.toThrow(/no puede estar dentro/)
  })
})
