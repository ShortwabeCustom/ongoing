// @vitest-environment node
/**
 * ADR-001 — D1 (root fuera de repo/build/tmp), D14 (fail-closed + memoización),
 * D15 (permisos y owner del root).
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { StorageConfigError } from '../storage-errors'
import {
  EVIDENCE_STORAGE_DIR_ENV,
  __resetEvidenceStorageRootForTests,
  getEvidenceStorageRoot,
} from '../storage-root'
import { cleanupRoots, makeMissingPath, makeValidRoot } from './test-roots'

const ORIGINAL = process.env[EVIDENCE_STORAGE_DIR_ENV]

function setEnv(value: string | undefined) {
  if (value === undefined) delete process.env[EVIDENCE_STORAGE_DIR_ENV]
  else process.env[EVIDENCE_STORAGE_DIR_ENV] = value
}

beforeEach(() => {
  __resetEvidenceStorageRootForTests()
  vi.restoreAllMocks()
})

afterEach(() => {
  setEnv(ORIGINAL)
})

afterAll(() => {
  cleanupRoots()
})

describe('getEvidenceStorageRoot — configuración ausente o mal formada', () => {
  it('falla si EVIDENCE_STORAGE_DIR no está definida', () => {
    setEnv(undefined)
    expect(() => getEvidenceStorageRoot()).toThrow(StorageConfigError)
    expect(() => getEvidenceStorageRoot()).toThrow(/no está definida/)
  })

  it('falla si EVIDENCE_STORAGE_DIR está vacía', () => {
    setEnv('   ')
    expect(() => getEvidenceStorageRoot()).toThrow(StorageConfigError)
  })

  it('rechaza una ruta relativa', () => {
    setEnv('./evidence')
    expect(() => getEvidenceStorageRoot()).toThrow(/absoluta/)
  })
})

describe('getEvidenceStorageRoot — zonas prohibidas (D1)', () => {
  it('rechaza un root dentro del repositorio / process.cwd()', () => {
    setEnv(path.join(process.cwd(), 'evidence-store'))
    expect(() => getEvidenceStorageRoot()).toThrow(/no puede estar dentro/)
  })

  it('rechaza <cwd>/public', () => {
    setEnv(path.join(process.cwd(), 'public'))
    expect(() => getEvidenceStorageRoot()).toThrow(/no puede estar dentro/)
  })

  it('rechaza <cwd>/.next', () => {
    setEnv(path.join(process.cwd(), '.next'))
    expect(() => getEvidenceStorageRoot()).toThrow(/no puede estar dentro/)
  })

  it('rechaza un root bajo /tmp', () => {
    setEnv('/tmp/evidence-store')
    expect(() => getEvidenceStorageRoot()).toThrow(/no puede estar dentro/)
  })

  it('rechaza un root bajo /var/tmp', () => {
    setEnv('/var/tmp/evidence-store')
    expect(() => getEvidenceStorageRoot()).toThrow(/no puede estar dentro/)
  })

  it('rechaza un symlink que apunta dentro de /tmp (se resuelve realpath antes de comparar)', () => {
    const container = makeValidRoot()
    const target = path.join('/tmp', `p1b-symlink-target-${Date.now()}`)
    fs.mkdirSync(target, { recursive: true, mode: 0o700 })
    const link = path.join(container, 'link-to-tmp')
    fs.symlinkSync(target, link)

    setEnv(link)
    try {
      expect(() => getEvidenceStorageRoot()).toThrow(/no puede estar dentro/)
    } finally {
      fs.rmSync(target, { recursive: true, force: true })
    }
  })

  it('ACEPTA un vecino con prefijo compartido: /tmpfoo no está dentro de /tmp', () => {
    // Comprobación de que la contención se calcula por segmentos y no por
    // prefijo de cadena. Se verifica sobre la función de contención real
    // usando un root válido cuyo nombre comparte prefijo con su hermano.
    const root = makeValidRoot()
    const sibling = `${root}foo`
    fs.mkdirSync(sibling, { mode: 0o700 })
    try {
      setEnv(sibling)
      expect(getEvidenceStorageRoot()).toBe(fs.realpathSync(sibling))
    } finally {
      fs.rmSync(sibling, { recursive: true, force: true })
    }
  })
})

describe('getEvidenceStorageRoot — estado del directorio', () => {
  it('rechaza un root inexistente', () => {
    setEnv(makeMissingPath())
    expect(() => getEvidenceStorageRoot()).toThrow(/inexistente o inaccesible/)
  })

  it('rechaza un root que es un fichero, no un directorio', () => {
    const root = makeValidRoot()
    const file = path.join(root, 'soy-un-fichero')
    fs.writeFileSync(file, 'x', { mode: 0o600 })
    setEnv(file)
    expect(() => getEvidenceStorageRoot()).toThrow(/debe apuntar a un directorio/)
  })

  it('rechaza un root sin permiso de escritura', () => {
    const root = makeValidRoot(0o500)
    setEnv(root)
    // Un proceso root ignoraría los bits de permiso; en ese caso el caso no aplica.
    if (typeof process.getuid === 'function' && process.getuid() === 0) return
    expect(() => getEvidenceStorageRoot()).toThrow(StorageConfigError)
  })
})

describe('getEvidenceStorageRoot — permisos y owner (D15)', () => {
  it.each([0o755, 0o777, 0o750, 0o701])('rechaza permisos laxos 0%s', (mode) => {
    const root = makeValidRoot(mode)
    setEnv(root)
    expect(() => getEvidenceStorageRoot()).toThrow(/permisos 0700/)
  })

  it('acepta un root válido con 0700 y owner correcto', () => {
    const root = makeValidRoot(0o700)
    setEnv(root)
    expect(getEvidenceStorageRoot()).toBe(fs.realpathSync(root))
  })
})

describe('getEvidenceStorageRoot — memoización por proceso (D14.1)', () => {
  it('memoiza el ÉXITO: no vuelve a consultar el filesystem', () => {
    const root = makeValidRoot()
    setEnv(root)
    expect(getEvidenceStorageRoot()).toBe(fs.realpathSync(root))

    const spy = vi.spyOn(fs, 'statSync')
    expect(getEvidenceStorageRoot()).toBe(fs.realpathSync(root))
    expect(spy).not.toHaveBeenCalled()
  })

  it('memoiza el ERROR: corregir el directorio en disco no basta, hace falta restart', () => {
    const root = makeValidRoot(0o755)
    setEnv(root)
    expect(() => getEvidenceStorageRoot()).toThrow(/permisos 0700/)

    // Se corrige el problema real en disco...
    fs.chmodSync(root, 0o700)

    // ...y aun así el proceso sigue viendo el mismo error: la memoización de
    // error es deliberada y codifica "hace falta restart/reload".
    expect(() => getEvidenceStorageRoot()).toThrow(/permisos 0700/)

    // Solo un reinicio (aquí simulado por el reset) recoge el cambio.
    __resetEvidenceStorageRootForTests()
    expect(getEvidenceStorageRoot()).toBe(fs.realpathSync(root))
  })

  it('devuelve la misma instancia de error en llamadas sucesivas', () => {
    setEnv(undefined)
    const first = (() => {
      try {
        getEvidenceStorageRoot()
      } catch (error) {
        return error
      }
    })()
    const second = (() => {
      try {
        getEvidenceStorageRoot()
      } catch (error) {
        return error
      }
    })()
    expect(first).toBe(second)
  })
})

describe('laziness en tiempo de import (D14.1)', () => {
  it('importar el módulo sin EVIDENCE_STORAGE_DIR no lanza', async () => {
    setEnv(undefined)
    vi.resetModules()
    await expect(import('../storage-root')).resolves.toBeDefined()
  })

  it('importar private-file-store sin EVIDENCE_STORAGE_DIR no lanza', async () => {
    setEnv(undefined)
    vi.resetModules()
    await expect(import('../private-file-store')).resolves.toBeDefined()
  })
})
