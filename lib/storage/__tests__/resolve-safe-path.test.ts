// @vitest-environment node
/**
 * ADR-001 — D3 (`resolveSafePath` obligatorio) y D9 (legacy fuera del almacén
 * privado).
 *
 * El orden de los pasos es normativo: los segmentos `..` se detectan sobre la
 * cadena YA DECODIFICADA y ANTES de normalizar. Por eso hay casos que deben
 * rechazarse aunque su ruta resuelta caiga dentro del root.
 */

import { afterAll, describe, expect, it } from 'vitest'
import path from 'node:path'
import { InvalidStorageKeyError } from '../storage-errors'
import { resolveSafePath } from '../private-file-store'
import { cleanupRoots, makeValidRoot } from './test-roots'

const ROOT = makeValidRoot()

afterAll(() => {
  cleanupRoots()
})

function expectRejected(key: unknown) {
  expect(() => resolveSafePath(ROOT, key)).toThrow(InvalidStorageKeyError)
  try {
    resolveSafePath(ROOT, key)
  } catch (error) {
    expect((error as InvalidStorageKeyError).code).toBe('INVALID_STORAGE_KEY')
  }
}

describe('(a) validación de la cadena cruda', () => {
  it.each([
    ['cadena vacía', ''],
    ['solo espacios', '   '],
    ['no es string (null)', null],
    ['no es string (número)', 42],
    ['no es string (undefined)', undefined],
  ])('rechaza %s', (_label, key) => {
    expectRejected(key)
  })

  it.each([
    ['NUL', 'findings/a\u0000b.png'],
    ['control 0x01', 'findings/a\u0001b.png'],
    ['newline', 'findings/a\nb.png'],
    ['DEL 0x7f', 'findings/a\u007fb.png'],
    ['C1 0x80', 'findings/a\u0080b.png'],
    ['C1 0x9f', 'findings/a\u009fb.png'],
  ])('rechaza caracteres de control: %s', (_label, key) => {
    expectRejected(key)
  })

  it('rechaza NUL introducido por percent-encoding (%00)', () => {
    expectRejected('findings/a%00b.png')
  })

  it('rechaza un C1 introducido por percent-encoding (%C2%80 = U+0080)', () => {
    expectRejected('findings/a%C2%80b.png')
  })
})

describe('(b) rutas absolutas, unidades Windows y backslashes', () => {
  it.each([
    ['absoluta unix', '/etc/passwd'],
    ['unidad Windows', 'C:\\Windows\\system32'],
    ['unidad Windows sin backslash', 'C:/Windows'],
    ['backslash', 'findings\\x\\y.png'],
  ])('rechaza %s', (_label, key) => {
    expectRejected(key)
  })

  it('rechaza backslash introducido por percent-encoding (%5c)', () => {
    expectRejected('findings%5c..%5cetc')
  })
})

describe('(c) percent-encoding malformado', () => {
  it.each([
    ['%zz', 'findings/%zz.png'],
    ['% suelto', 'findings/%.png'],
    ['%2 incompleto', 'findings/%2'],
    ['%E0%A4 truncado', 'findings/%E0%A4'],
  ])('rechaza %s', (_label, key) => {
    expectRejected(key)
  })
})

describe('(d) segmentos ".." — rechazados ANTES de normalizar', () => {
  it.each([
    ['a/../b', 'a/../b'],
    ['findings/x/../y', 'findings/x/../y'],
    ['a/%2e%2e/b', 'a/%2e%2e/b'],
    ['%2e%2e%2fetc', '%2e%2e%2fetc'],
    ['findings/../../etc/passwd', 'findings/../../etc/passwd'],
    ['..', '..'],
    ['../x', '../x'],
    ['findings/./../../x', 'findings/./../../x'],
  ])('rechaza %s', (_label, key) => {
    expectRejected(key)
  })

  it('a/../b se rechaza AUNQUE resolvería dentro del root', () => {
    // Prueba explícita del motivo del orden: path.resolve(ROOT, 'a/../b')
    // devuelve <ROOT>/b, perfectamente contenido. Si normalizáramos antes de
    // buscar "..", este caso pasaría inadvertido.
    expect(path.resolve(ROOT, 'a/../b')).toBe(path.join(ROOT, 'b'))
    expectRejected('a/../b')
  })

  it('acepta un fichero cuyo nombre empieza por puntos pero no es traversal', () => {
    expect(() => resolveSafePath(ROOT, 'findings/a/..foo.png')).not.toThrow()
    expect(() => resolveSafePath(ROOT, 'findings/a/...png')).not.toThrow()
  })
})

describe('(e) claves legacy (D9)', () => {
  it.each([
    ['legacy/foo.png', 'legacy/foo.png'],
    ['legacy anidado', 'legacy/findings/x/y.png'],
    ['legacy por percent-encoding', 'legacy%2Ffoo.png'],
  ])('rechaza %s', (_label, key) => {
    expectRejected(key)
  })

  it.each([
    ['./legacy/foo.png', './legacy/foo.png'],
    ['%2e/legacy/foo.png', '%2e/legacy/foo.png'],
    ['././legacy/foo.png', '././legacy/foo.png'],
    ['legacy//foo.png', 'legacy//foo.png'],
    ['./legacy/anidado/x.png', './legacy/anidado/x.png'],
  ])('rechaza la forma canónicamente equivalente %s', (_label, key) => {
    // Ninguna contiene ".." ni empieza literalmente por "legacy/", pero todas
    // resuelven a <root>/legacy/... El namespace legacy se comprueba sobre la
    // forma canónica, no sobre la cadena cruda.
    expectRejected(key)
  })

  it('no confunde un prefijo parecido que no es legacy', () => {
    expect(() => resolveSafePath(ROOT, 'legacy-notes/foo.png')).not.toThrow()
  })
})

describe('(g) contención final en el root', () => {
  it('rechaza una clave que resolvería al propio root', () => {
    expectRejected('.')
  })

  it('acepta una clave válida y la resuelve dentro del root', () => {
    const key = 'findings/find_123/ev_456/captura.png'
    const resolved = resolveSafePath(ROOT, key)
    expect(resolved).toBe(path.join(ROOT, key))
    expect(resolved.startsWith(ROOT + path.sep)).toBe(true)
  })

  it('acepta claves con caracteres seguros percent-encoded', () => {
    // %20 decodifica a espacio, que es legítimo en un nombre de fichero.
    const resolved = resolveSafePath(ROOT, 'findings/a/b/mi%20captura.png')
    expect(resolved).toBe(path.join(ROOT, 'findings/a/b/mi captura.png'))
  })
})
