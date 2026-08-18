// @vitest-environment node
/**
 * ADR-001 — D3 (frontera estricta) y D15 (permisos).
 *
 * `resolveSafePath` opera sobre CADENAS: `path.resolve` / `path.relative` no
 * consultan el filesystem, así que por sí solos NO protegen contra un symlink
 * preexistente en cualquier componente de la ruta. Estos tests fijan el
 * contrato de contención real contra el filesystem.
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
const BODY = Buffer.from('contenido')

let root: string
let outside: string
let originalUmask: number

beforeEach(() => {
  root = makeValidRoot()
  outside = makeValidRoot()
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

function modeOf(target: string): number {
  return fs.lstatSync(target).mode & 0o777
}

describe('C) subdirectorios PREEXISTENTES', () => {
  it('un subdirectorio con 0755 es fail-closed y NO se chmodea automáticamente', async () => {
    const dir = path.join(root, 'findings')
    fs.mkdirSync(dir, { mode: 0o700 })
    fs.chmodSync(dir, 0o755)

    await expect(
      PrivateFileStore.put('findings/f1/e1/x.png', BODY),
    ).rejects.toBeInstanceOf(StorageIOError)

    // El modo NO debe haber sido "reparado" por la aplicación.
    expect(modeOf(dir)).toBe(0o755)
  })

  it('un subdirectorio que es un symlink hacia fuera del root es rechazado', async () => {
    const target = path.join(outside, 'destino')
    fs.mkdirSync(target, { mode: 0o700 })
    fs.symlinkSync(target, path.join(root, 'findings'))

    await expect(
      PrivateFileStore.put('findings/f1/e1/x.png', BODY),
    ).rejects.toBeInstanceOf(StorageIOError)
  })

  it('un symlink intermedio hacia fuera NO permite escribir fuera del root', async () => {
    const target = path.join(outside, 'destino')
    fs.mkdirSync(target, { recursive: true, mode: 0o700 })
    fs.mkdirSync(path.join(root, 'findings'), { mode: 0o700 })
    fs.symlinkSync(target, path.join(root, 'findings', 'f1'))

    await expect(
      PrivateFileStore.put('findings/f1/e1/x.png', BODY),
    ).rejects.toBeInstanceOf(StorageIOError)

    // Nada debe haberse materializado fuera del root.
    expect(fs.existsSync(path.join(target, 'e1'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'e1', 'x.png'))).toBe(false)
  })

  it('un subdirectorio con owner correcto y 0700 sí se acepta', async () => {
    fs.mkdirSync(path.join(root, 'findings', 'f1', 'e1'), {
      recursive: true,
      mode: 0o700,
    })
    for (const p of ['findings', 'findings/f1', 'findings/f1/e1']) {
      fs.chmodSync(path.join(root, p), 0o700)
    }
    await expect(PrivateFileStore.put('findings/f1/e1/x.png', BODY)).resolves.toBeUndefined()
  })
})

describe('B) subdirectorios creados por la aplicación', () => {
  it('quedan con 0700 y el fichero final con 0600, bajo umask permisivo', async () => {
    await PrivateFileStore.put('findings/f9/e9/x.png', BODY)
    expect(modeOf(path.join(root, 'findings'))).toBe(0o700)
    expect(modeOf(path.join(root, 'findings/f9'))).toBe(0o700)
    expect(modeOf(path.join(root, 'findings/f9/e9'))).toBe(0o700)
    expect(modeOf(path.join(root, 'findings/f9/e9/x.png'))).toBe(0o600)
  })
})

describe('D) el objeto final no puede ser un symlink', () => {
  it('stat NO sigue un symlink que sustituye al objeto', async () => {
    const secret = path.join(outside, 'secreto.txt')
    fs.writeFileSync(secret, 'contenido-secreto-mucho-mas-largo', { mode: 0o600 })

    fs.mkdirSync(path.join(root, 'findings/f2/e2'), { recursive: true, mode: 0o700 })
    for (const p of ['findings', 'findings/f2', 'findings/f2/e2']) {
      fs.chmodSync(path.join(root, p), 0o700)
    }
    fs.symlinkSync(secret, path.join(root, 'findings/f2/e2/x.png'))

    await expect(PrivateFileStore.stat('findings/f2/e2/x.png')).rejects.toBeInstanceOf(
      StorageIOError,
    )
  })

  it('exists NO sigue un symlink que sustituye al objeto', async () => {
    const secret = path.join(outside, 'secreto2.txt')
    fs.writeFileSync(secret, 'x', { mode: 0o600 })

    fs.mkdirSync(path.join(root, 'findings/f3/e3'), { recursive: true, mode: 0o700 })
    for (const p of ['findings', 'findings/f3', 'findings/f3/e3']) {
      fs.chmodSync(path.join(root, p), 0o700)
    }
    fs.symlinkSync(secret, path.join(root, 'findings/f3/e3/x.png'))

    await expect(PrivateFileStore.exists('findings/f3/e3/x.png')).rejects.toBeInstanceOf(
      StorageIOError,
    )
  })

  it('put no sobrescribe a través de un symlink final: el destino externo queda intacto', async () => {
    const secret = path.join(outside, 'secreto3.txt')
    fs.writeFileSync(secret, 'ORIGINAL', { mode: 0o600 })

    fs.mkdirSync(path.join(root, 'findings/f4/e4'), { recursive: true, mode: 0o700 })
    for (const p of ['findings', 'findings/f4', 'findings/f4/e4']) {
      fs.chmodSync(path.join(root, p), 0o700)
    }
    fs.symlinkSync(secret, path.join(root, 'findings/f4/e4/x.png'))

    await expect(PrivateFileStore.put('findings/f4/e4/x.png', BODY)).rejects.toBeInstanceOf(
      StorageIOError,
    )
    expect(fs.readFileSync(secret, 'utf8')).toBe('ORIGINAL')
  })

  it('delete rechaza un symlink final en lugar de operar sobre él', async () => {
    const secret = path.join(outside, 'secreto4.txt')
    fs.writeFileSync(secret, 'ORIGINAL', { mode: 0o600 })

    fs.mkdirSync(path.join(root, 'findings/f5/e5'), { recursive: true, mode: 0o700 })
    for (const p of ['findings', 'findings/f5', 'findings/f5/e5']) {
      fs.chmodSync(path.join(root, p), 0o700)
    }
    fs.symlinkSync(secret, path.join(root, 'findings/f5/e5/x.png'))

    await expect(PrivateFileStore.delete('findings/f5/e5/x.png')).rejects.toBeInstanceOf(
      StorageIOError,
    )
    expect(fs.existsSync(secret)).toBe(true)
  })
})

describe('E) ninguna operación atraviesa componentes symlink', () => {
  it('stat / exists / delete fallan si un componente intermedio es symlink', async () => {
    const target = path.join(outside, 'destino2')
    fs.mkdirSync(path.join(target, 'e6'), { recursive: true, mode: 0o700 })
    fs.writeFileSync(path.join(target, 'e6', 'x.png'), 'fuera', { mode: 0o600 })

    fs.mkdirSync(path.join(root, 'findings'), { mode: 0o700 })
    fs.symlinkSync(target, path.join(root, 'findings', 'f6'))

    const key = 'findings/f6/e6/x.png'
    await expect(PrivateFileStore.stat(key)).rejects.toBeInstanceOf(StorageIOError)
    await expect(PrivateFileStore.exists(key)).rejects.toBeInstanceOf(StorageIOError)
    await expect(PrivateFileStore.delete(key)).rejects.toBeInstanceOf(StorageIOError)

    // El fichero externo sigue intacto.
    expect(fs.existsSync(path.join(target, 'e6', 'x.png'))).toBe(true)
  })
})
