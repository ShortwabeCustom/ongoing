// @vitest-environment node
/**
 * ADR-001 D13 / D15 — lectura segura del objeto final.
 *
 * `getStream` abre con `O_RDONLY | O_NOFOLLOW` y valida los invariantes sobre
 * un `fstat` del descriptor ya abierto, de modo que el componente final no
 * tiene ventana TOCTOU.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { StorageIOError } from '../storage-errors'
import { PrivateFileStore } from '../private-file-store'
import {
  EVIDENCE_STORAGE_DIR_ENV,
  __resetEvidenceStorageRootForTests,
} from '../storage-root'
import { cleanupRoots, makeValidRoot } from './test-roots'

const ORIGINAL = process.env[EVIDENCE_STORAGE_DIR_ENV]
const KEY = 'findings/find_1/ev_1/captura.png'
const BODY = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz')

let root: string
let originalUmask: number

beforeEach(() => {
  root = makeValidRoot()
  process.env[EVIDENCE_STORAGE_DIR_ENV] = root
  __resetEvidenceStorageRootForTests()
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

async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer))
  return Buffer.concat(chunks)
}

/** Descriptores abiertos por este proceso, para detectar fugas. */
function openFdCount(): number {
  try {
    return fs.readdirSync(`/dev/fd`).length
  } catch {
    return -1
  }
}

describe('getStream — lectura completa', () => {
  it('devuelve todos los bytes y el tamaño real', async () => {
    await PrivateFileStore.put(KEY, BODY)

    const { stream, size } = await PrivateFileStore.getStream(KEY)
    expect(size).toBe(BODY.length)
    expect(await collect(stream)).toEqual(BODY)
  })
})

describe('getStream — rangos', () => {
  beforeEach(async () => {
    await PrivateFileStore.put(KEY, BODY)
  })

  it.each([
    ['inicio', 0, 9],
    ['medio', 10, 19],
    ['final', 26, 35],
    ['un solo byte', 5, 5],
    ['objeto completo explícito', 0, 35],
  ])('lee exactamente el fragmento %s', async (_label, start, end) => {
    const { stream } = await PrivateFileStore.getStream(KEY, start, end)
    expect(await collect(stream)).toEqual(BODY.subarray(start, end + 1))
  })
})

describe('getStream — invariantes del objeto final (D15)', () => {
  it('rechaza un symlink final y NUNCA sirve los bytes externos', async () => {
    const outside = makeValidRoot()
    const secret = path.join(outside, 'secreto.txt')
    fs.writeFileSync(secret, 'CONTENIDO-EXTERNO-SECRETO', { mode: 0o600 })

    const dir = path.join(root, path.dirname(KEY))
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    for (const p of ['findings', 'findings/find_1', 'findings/find_1/ev_1']) {
      fs.chmodSync(path.join(root, p), 0o700)
    }
    fs.symlinkSync(secret, path.join(root, KEY))

    await expect(PrivateFileStore.getStream(KEY)).rejects.toBeInstanceOf(StorageIOError)

    // Y el fichero externo sigue intacto.
    expect(fs.readFileSync(secret, 'utf8')).toBe('CONTENIDO-EXTERNO-SECRETO')
  })

  it('rechaza un fichero con modo distinto de 0600', async () => {
    await PrivateFileStore.put(KEY, BODY)
    fs.chmodSync(path.join(root, KEY), 0o644)

    await expect(PrivateFileStore.getStream(KEY)).rejects.toThrow(/0600/)
  })

  it('rechaza algo que no sea un fichero regular', async () => {
    const dir = path.join(root, path.dirname(KEY))
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    for (const p of ['findings', 'findings/find_1', 'findings/find_1/ev_1']) {
      fs.chmodSync(path.join(root, p), 0o700)
    }
    // El "objeto" es un directorio.
    fs.mkdirSync(path.join(root, KEY), { mode: 0o600 })

    await expect(PrivateFileStore.getStream(KEY)).rejects.toBeInstanceOf(StorageIOError)
  })

  it('objeto ausente ⇒ StorageIOError con errno ENOENT', async () => {
    try {
      await PrivateFileStore.getStream(KEY)
      expect.unreachable('debería haber fallado')
    } catch (error) {
      expect(error).toBeInstanceOf(StorageIOError)
      expect((error as StorageIOError).errno).toBe('ENOENT')
    }
  })

  it('clave inválida ⇒ rechazada sin tocar el filesystem', async () => {
    await expect(PrivateFileStore.getStream('a/../b')).rejects.toThrow(/traversal/)
  })
})

describe('getStream — no filtra descriptores', () => {
  it('cierra el handle cuando una validación posterior al open falla', async () => {
    await PrivateFileStore.put(KEY, BODY)
    fs.chmodSync(path.join(root, KEY), 0o644)

    const before = openFdCount()
    for (let i = 0; i < 30; i++) {
      await PrivateFileStore.getStream(KEY).catch(() => {})
    }
    const after = openFdCount()

    // Sin cierre, 30 aperturas dejarían 30 descriptores abiertos.
    if (before >= 0) expect(after - before).toBeLessThan(5)
  })
})

describe('stat — invariantes de lectura', () => {
  it('acepta un objeto válido y devuelve el tamaño real del filesystem', async () => {
    await PrivateFileStore.put(KEY, BODY)
    expect((await PrivateFileStore.stat(KEY)).size).toBe(BODY.length)
  })

  it('rechaza modo distinto de 0600', async () => {
    await PrivateFileStore.put(KEY, BODY)
    fs.chmodSync(path.join(root, KEY), 0o666)
    await expect(PrivateFileStore.stat(KEY)).rejects.toThrow(/0600/)
  })
})
