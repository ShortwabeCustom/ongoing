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

describe('cleanup de temporales D15-bis.2', () => {
  it('dry-run no borra y execute elimina solo temporales válidos antiguos', async () => {
    const dir = path.join(root, 'findings/f1/e1')
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    for (const part of ['findings', 'findings/f1', 'findings/f1/e1']) fs.chmodSync(path.join(root, part), 0o700)
    const old = path.join(dir, '.tmp-AbC_123.part')
    const recent = path.join(dir, '.tmp-recent.part')
    const near = path.join(dir, '.tmp-a.part.bak')
    const final = path.join(dir, 'final.png')
    for (const file of [old, recent, near, final]) fs.writeFileSync(file, 'x', { mode: 0o600 })
    fs.utimesSync(old, new Date(0), new Date(0))
    const cutoff = new Date(Date.now() - 60_000)

    const dry = await PrivateFileStore.cleanupTemporaries({ cutoff })
    expect(dry.scanned).toBe(1)
    expect(fs.existsSync(old)).toBe(true)

    const run = await PrivateFileStore.cleanupTemporaries({ cutoff, execute: true })
    expect(run.cleaned).toBe(1)
    expect(fs.existsSync(old)).toBe(false)
    expect(fs.existsSync(recent)).toBe(true)
    expect(fs.existsSync(near)).toBe(true)
    expect(fs.existsSync(final)).toBe(true)
  })

  it('no sigue symlinks ni borra directorios con nombre temporal', async () => {
    const outside = path.join(makeValidRoot(), 'outside')
    fs.writeFileSync(outside, 'secret', { mode: 0o600 })
    fs.symlinkSync(outside, path.join(root, '.tmp-link.part'))
    fs.mkdirSync(path.join(root, '.tmp-dir.part'), { mode: 0o700 })
    await PrivateFileStore.cleanupTemporaries({ cutoff: new Date(), execute: true })
    expect(fs.readFileSync(outside, 'utf8')).toBe('secret')
    expect(fs.lstatSync(path.join(root, '.tmp-link.part')).isSymbolicLink()).toBe(true)
    expect(fs.statSync(path.join(root, '.tmp-dir.part')).isDirectory()).toBe(true)
  })

  it('incluye exactamente mtime === cutoff', async () => {
    const target = path.join(root, '.tmp-boundary.part')
    const cutoff = new Date('2026-08-17T12:00:00.000Z')
    fs.writeFileSync(target, 'x', { mode: 0o600 })
    fs.utimesSync(target, cutoff, cutoff)

    const result = await PrivateFileStore.cleanupTemporaries({ cutoff, execute: true })

    expect(result).toMatchObject({ scanned: 1, cleaned: 1, failed: 0 })
    expect(fs.existsSync(target)).toBe(false)
  })

  it('continúa después de un error individual de unlink', async () => {
    const first = path.join(root, '.tmp-a.part')
    const second = path.join(root, '.tmp-b.part')
    fs.writeFileSync(first, 'a', { mode: 0o600 })
    fs.writeFileSync(second, 'b', { mode: 0o600 })
    const unlink = vi.spyOn(fs.promises, 'unlink')
    const realUnlink = unlink.getMockImplementation()
    unlink.mockImplementation(async (target) => {
      if (target === first) throw Object.assign(new Error('unlink failed'), { code: 'EIO' })
      if (realUnlink) return realUnlink(target)
      return fs.promises.rm(target)
    })

    const result = await PrivateFileStore.cleanupTemporaries({ cutoff: new Date(), execute: true })

    unlink.mockRestore()
    expect(result).toMatchObject({ scanned: 2, cleaned: 1, failed: 1 })
    expect(fs.existsSync(first)).toBe(true)
    expect(fs.existsSync(second)).toBe(false)
  })

  it.each([
    ['primera', 1],
    ['segunda', 2],
  ] as const)('continúa cuando falla la %s entrada procesada por lstat', async (_label, failingCall) => {
    const first = path.join(root, '.tmp-a.part')
    const second = path.join(root, '.tmp-b.part')
    fs.writeFileSync(first, 'a', { mode: 0o600 })
    fs.writeFileSync(second, 'b', { mode: 0o600 })
    const old = new Date(0)
    fs.utimesSync(first, old, old)
    fs.utimesSync(second, old, old)
    const originalLstat = fs.promises.lstat.bind(fs.promises)
    let candidateCall = 0
    const lstat = vi.spyOn(fs.promises, 'lstat').mockImplementation(async (target) => {
      if (target === first || target === second) {
        candidateCall += 1
        if (candidateCall === failingCall) {
          throw Object.assign(new Error('lstat failed'), { code: 'EIO' })
        }
      }
      return originalLstat(target)
    })

    const result = await PrivateFileStore.cleanupTemporaries({
      cutoff: new Date('2026-08-18T00:00:00.000Z'),
      execute: true,
    })

    lstat.mockRestore()
    expect(result).toMatchObject({ scanned: 1, cleaned: 1, failed: 1 })
    expect([first, second].filter((target) => fs.existsSync(target))).toHaveLength(1)
  })

  it('registra fallo de subdirectorio y continúa con otros candidatos', async () => {
    const blocked = path.join(root, 'blocked')
    const candidate = path.join(root, '.tmp-after.part')
    fs.mkdirSync(blocked, { mode: 0o700 })
    fs.writeFileSync(path.join(blocked, '.tmp-inside.part'), 'x', { mode: 0o600 })
    fs.writeFileSync(candidate, 'x', { mode: 0o600 })
    const originalReaddir = fs.promises.readdir.bind(fs.promises)
    const readdir = vi.spyOn(fs.promises, 'readdir').mockImplementation(async (target, options) => {
      if (target === blocked) throw Object.assign(new Error('readdir failed'), { code: 'EACCES' })
      return originalReaddir(target, options as { withFileTypes: true })
    }) as ReturnType<typeof vi.spyOn>

    const result = await PrivateFileStore.cleanupTemporaries({ cutoff: new Date(), execute: true })

    readdir.mockRestore()
    expect(result).toMatchObject({ cleaned: 1, failed: 1 })
    expect(fs.existsSync(path.join(blocked, '.tmp-inside.part'))).toBe(true)
    expect(fs.existsSync(candidate)).toBe(false)
  })
})

describe('storage release preflight', () => {
  it('comprueba hard links y limpia completamente su artefacto controlado', async () => {
    await expect(PrivateFileStore.preflight()).resolves.toBeUndefined()
    expect(fs.readdirSync(root).filter((name) => name.startsWith('.preflight-'))).toEqual([])
  })

  it('cierra el handle y limpia si falla después de abrir source', async () => {
    const originalOpen = fs.promises.open.bind(fs.promises)
    let close: ReturnType<typeof vi.spyOn> | undefined
    const open = vi.spyOn(fs.promises, 'open').mockImplementationOnce(async (...args) => {
      const handle = await originalOpen(...args)
      close = vi.spyOn(handle, 'close')
      vi.spyOn(handle, 'writeFile').mockRejectedValueOnce(Object.assign(new Error('write failed'), { code: 'EIO' }))
      return handle
    })

    await expect(PrivateFileStore.preflight()).rejects.toBeInstanceOf(StorageIOError)

    open.mockRestore()
    expect(close).toHaveBeenCalledTimes(1)
    expect(fs.readdirSync(root).filter((name) => name.startsWith('.preflight-'))).toEqual([])
  })

  it('un fallo de fsync rechaza y limpia', async () => {
    const originalOpen = fs.promises.open.bind(fs.promises)
    const open = vi.spyOn(fs.promises, 'open').mockImplementationOnce(async (...args) => {
      const handle = await originalOpen(...args)
      vi.spyOn(handle, 'sync').mockRejectedValueOnce(Object.assign(new Error('sync failed'), { code: 'EIO' }))
      return handle
    })
    await expect(PrivateFileStore.preflight()).rejects.toBeInstanceOf(StorageIOError)
    open.mockRestore()
    expect(fs.readdirSync(root).filter((name) => name.startsWith('.preflight-'))).toEqual([])
  })

  it('un fallo de hard link limpia source', async () => {
    const link = vi.spyOn(fs.promises, 'link').mockRejectedValueOnce(Object.assign(new Error('link failed'), { code: 'EIO' }))
    await expect(PrivateFileStore.preflight()).rejects.toBeInstanceOf(StorageIOError)
    link.mockRestore()
    expect(fs.readdirSync(root).filter((name) => name.startsWith('.preflight-'))).toEqual([])
  })

  it('un fallo de inode limpia source y linked', async () => {
    const originalLstat = fs.promises.lstat.bind(fs.promises)
    const lstat = vi.spyOn(fs.promises, 'lstat').mockImplementation(async (target) => {
      const stats = await originalLstat(target)
      if (path.basename(String(target)) === 'linked') return Object.assign(Object.create(Object.getPrototypeOf(stats)), stats, { ino: stats.ino + 1 })
      return stats
    })
    await expect(PrivateFileStore.preflight()).rejects.toBeInstanceOf(StorageIOError)
    lstat.mockRestore()
    expect(fs.readdirSync(root).filter((name) => name.startsWith('.preflight-'))).toEqual([])
  })

  it('rechaza si unlink de cleanup falla con error distinto de ENOENT', async () => {
    const originalUnlink = fs.promises.unlink.bind(fs.promises)
    const unlink = vi.spyOn(fs.promises, 'unlink').mockImplementation(async (target) => {
      if (path.basename(String(target)) === 'linked') throw Object.assign(new Error('unlink failed'), { code: 'EIO' })
      return originalUnlink(target)
    })
    await expect(PrivateFileStore.preflight()).rejects.toBeInstanceOf(StorageIOError)
    unlink.mockRestore()
  })

  it('rechaza si rmdir de cleanup falla', async () => {
    const rmdir = vi.spyOn(fs.promises, 'rmdir').mockRejectedValueOnce(Object.assign(new Error('rmdir failed'), { code: 'EIO' }))
    await expect(PrivateFileStore.preflight()).rejects.toBeInstanceOf(StorageIOError)
    rmdir.mockRestore()
  })

  it('tolera ENOENT durante cleanup como éxito idempotente', async () => {
    const originalUnlink = fs.promises.unlink.bind(fs.promises)
    const unlink = vi.spyOn(fs.promises, 'unlink').mockImplementation(async (target) => {
      if (path.basename(String(target)) === 'linked') {
        await originalUnlink(target)
        throw Object.assign(new Error('already absent'), { code: 'ENOENT' })
      }
      return originalUnlink(target)
    })
    await expect(PrivateFileStore.preflight()).resolves.toBeUndefined()
    unlink.mockRestore()
    expect(fs.readdirSync(root).filter((name) => name.startsWith('.preflight-'))).toEqual([])
  })
})
