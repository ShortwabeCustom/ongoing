// @vitest-environment node
/**
 * Contrato NO-CLOBBER de la publicación (ADR-001 D15-bis.1).
 *
 * La `storageKey` de runtime es INMUTABLE: `put` nunca sobrescribe un objeto
 * final ya publicado.
 *
 * `O_EXCL` protege la creación del TEMPORAL, no la publicación del objeto
 * final. La garantía de no-clobber la aporta `link(2)`, que crea la entrada
 * final de forma atómica y falla con `EEXIST` si ya existe — a diferencia de
 * `rename(2)`, que reemplaza el destino en silencio.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { StorageIOError } from '../storage-errors'
import { PrivateFileStore, TEMP_FILE_PATTERN } from '../private-file-store'
import {
  EVIDENCE_STORAGE_DIR_ENV,
  __resetEvidenceStorageRootForTests,
} from '../storage-root'
import { cleanupRoots, makeValidRoot } from './test-roots'

const ORIGINAL = process.env[EVIDENCE_STORAGE_DIR_ENV]
const KEY = 'findings/find_1/ev_1/captura.png'

let root: string
let originalUmask: number

beforeEach(() => {
  root = makeValidRoot()
  process.env[EVIDENCE_STORAGE_DIR_ENV] = root
  __resetEvidenceStorageRootForTests()
  originalUmask = process.umask(0o000)
})

afterEach(() => {
  vi.restoreAllMocks()
  process.umask(originalUmask)
  if (ORIGINAL === undefined) delete process.env[EVIDENCE_STORAGE_DIR_ENV]
  else process.env[EVIDENCE_STORAGE_DIR_ENV] = ORIGINAL
  __resetEvidenceStorageRootForTests()
})

afterAll(() => {
  cleanupRoots()
})

function leftoverTemps(): string[] {
  const dir = path.join(root, path.dirname(KEY))
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((name) => TEMP_FILE_PATTERN.test(name))
}

describe('A) no-clobber secuencial', () => {
  it('un segundo put sobre la misma clave falla con errno EEXIST y NO sobrescribe', async () => {
    await PrivateFileStore.put(KEY, Buffer.from('primero'))

    try {
      await PrivateFileStore.put(KEY, Buffer.from('segundo'))
      expect.unreachable('el segundo put debería haber fallado')
    } catch (error) {
      expect(error).toBeInstanceOf(StorageIOError)
      expect((error as StorageIOError).errno).toBe('EEXIST')
    }

    expect(fs.readFileSync(path.join(root, KEY), 'utf8')).toBe('primero')
  })

  it('el objeto publicado conserva modo 0600 tras el intento rechazado', async () => {
    await PrivateFileStore.put(KEY, Buffer.from('primero'))
    await PrivateFileStore.put(KEY, Buffer.from('segundo')).catch(() => {})

    expect(fs.lstatSync(path.join(root, KEY)).mode & 0o777).toBe(0o600)
  })
})

describe('B) no-clobber concurrente', () => {
  it('exactamente uno publica, el otro falla EEXIST, y el final no es una mezcla', async () => {
    const a = Buffer.alloc(30, 0x41)
    const b = Buffer.alloc(40, 0x42)

    const results = await Promise.allSettled([
      PrivateFileStore.put(KEY, a),
      PrivateFileStore.put(KEY, b),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const reason = (rejected[0] as PromiseRejectedResult).reason
    expect(reason).toBeInstanceOf(StorageIOError)
    expect((reason as StorageIOError).errno).toBe('EEXIST')

    // El contenido final debe ser ÍNTEGRAMENTE uno de los dos buffers.
    const final = fs.readFileSync(path.join(root, KEY))
    expect(final.equals(a) || final.equals(b)).toBe(true)
  })
})

describe('C) el temporal del escritor rechazado se limpia', () => {
  it('tras un EEXIST secuencial no quedan temporales huérfanos', async () => {
    await PrivateFileStore.put(KEY, Buffer.from('primero'))
    await PrivateFileStore.put(KEY, Buffer.from('segundo')).catch(() => {})

    expect(leftoverTemps()).toEqual([])
  })

  it('tras un EEXIST concurrente no quedan temporales huérfanos', async () => {
    await Promise.allSettled([
      PrivateFileStore.put(KEY, Buffer.alloc(10, 0x41)),
      PrivateFileStore.put(KEY, Buffer.alloc(20, 0x42)),
    ])

    expect(leftoverTemps()).toEqual([])
  })
})

describe('D) fallo del unlink DESPUÉS de un link exitoso', () => {
  it('el put se considera publicado y el objeto final queda íntegro', async () => {
    const body = Buffer.from('publicado-correctamente')

    // El unlink del temporal falla, pero el link ya publicó el objeto final.
    const spy = vi
      .spyOn(fs.promises, 'unlink')
      .mockRejectedValue(Object.assign(new Error('boom'), { code: 'EIO' }))

    await expect(PrivateFileStore.put(KEY, body)).resolves.toBeUndefined()
    spy.mockRestore()

    expect(fs.readFileSync(path.join(root, KEY))).toEqual(body)
    expect(fs.lstatSync(path.join(root, KEY)).mode & 0o777).toBe(0o600)
  })

  it('el temporal huérfano queda para el cleanup posterior (D15-bis.2)', async () => {
    const spy = vi
      .spyOn(fs.promises, 'unlink')
      .mockRejectedValue(Object.assign(new Error('boom'), { code: 'EIO' }))

    await PrivateFileStore.put(KEY, Buffer.from('x'))
    spy.mockRestore()

    // Sigue existiendo un temporal que casa con el patrón interno: es
    // exactamente el caso que D15-bis.2 debe recoger.
    expect(leftoverTemps()).toHaveLength(1)
  })
})

describe('E) symlink en el destino final', () => {
  it('nunca se sobrescribe ni se sigue', async () => {
    const outside = makeValidRoot()
    const secret = path.join(outside, 'secreto.txt')
    fs.writeFileSync(secret, 'ORIGINAL', { mode: 0o600 })

    const dir = path.join(root, path.dirname(KEY))
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    for (const p of ['findings', 'findings/find_1', 'findings/find_1/ev_1']) {
      fs.chmodSync(path.join(root, p), 0o700)
    }
    fs.symlinkSync(secret, path.join(root, KEY))

    await expect(PrivateFileStore.put(KEY, Buffer.from('intruso'))).rejects.toBeInstanceOf(
      StorageIOError,
    )

    // Ni el destino externo ni el propio enlace se han tocado.
    expect(fs.readFileSync(secret, 'utf8')).toBe('ORIGINAL')
    expect(fs.lstatSync(path.join(root, KEY)).isSymbolicLink()).toBe(true)
  })
})
