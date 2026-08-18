// @vitest-environment node
/**
 * ADR-001 D13 — parser de `Range` para un solo rango.
 *
 * Distinción normativa: malformado / no soportado ⇒ IGNORAR (200 completo);
 * bien formado pero no satisfacible ⇒ 416.
 */

import { describe, expect, it } from 'vitest'
import { contentRange, parseRange, unsatisfiedContentRange } from '../range'

const SIZE = 100

describe('sin Range', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['cadena vacía', ''],
    ['solo espacios', '   '],
  ])('%s ⇒ none', (_label, header) => {
    expect(parseRange(header, SIZE)).toEqual({ kind: 'none' })
  })
})

describe('rangos satisfacibles ⇒ 206', () => {
  it('bytes=N-M', () => {
    expect(parseRange('bytes=10-19', SIZE)).toEqual({ kind: 'satisfiable', start: 10, end: 19 })
  })

  it('bytes=N- (open-ended) llega hasta el final', () => {
    expect(parseRange('bytes=90-', SIZE)).toEqual({ kind: 'satisfiable', start: 90, end: 99 })
  })

  it('bytes=-N (sufijo) devuelve los últimos N', () => {
    expect(parseRange('bytes=-10', SIZE)).toEqual({ kind: 'satisfiable', start: 90, end: 99 })
  })

  it('un solo byte', () => {
    expect(parseRange('bytes=0-0', SIZE)).toEqual({ kind: 'satisfiable', start: 0, end: 0 })
  })

  it('el objeto entero', () => {
    expect(parseRange('bytes=0-99', SIZE)).toEqual({ kind: 'satisfiable', start: 0, end: 99 })
  })

  it('end más allá del final se recorta al último byte', () => {
    expect(parseRange('bytes=50-999', SIZE)).toEqual({ kind: 'satisfiable', start: 50, end: 99 })
  })

  it('sufijo MAYOR que el objeto devuelve el objeto completo (sigue siendo 206)', () => {
    expect(parseRange('bytes=-500', SIZE)).toEqual({ kind: 'satisfiable', start: 0, end: 99 })
  })

  it('tolera espacios alrededor', () => {
    expect(parseRange('  bytes = 10-19  ', SIZE)).toEqual({
      kind: 'satisfiable',
      start: 10,
      end: 19,
    })
  })

  it('acepta BYTES en mayúsculas', () => {
    expect(parseRange('BYTES=0-1', SIZE)).toEqual({ kind: 'satisfiable', start: 0, end: 1 })
  })
})

describe('no satisfacibles ⇒ 416', () => {
  it('start > end', () => {
    expect(parseRange('bytes=50-10', SIZE)).toEqual({ kind: 'unsatisfiable' })
  })

  it('start === total', () => {
    expect(parseRange('bytes=100-', SIZE)).toEqual({ kind: 'unsatisfiable' })
  })

  it('start > total', () => {
    expect(parseRange('bytes=500-600', SIZE)).toEqual({ kind: 'unsatisfiable' })
  })

  it('sufijo cero (bytes=-0)', () => {
    expect(parseRange('bytes=-0', SIZE)).toEqual({ kind: 'unsatisfiable' })
  })
})

describe('Range IGNORADO ⇒ 200 completo', () => {
  it.each([
    ['unidad desconocida', 'items=0-1'],
    ['unidad vacía', '=0-1'],
    ['sin signo igual', 'bytes 0-1'],
    ['no numérico', 'bytes=abc'],
    ['solo guion', 'bytes=-'],
    ['vacío tras bytes=', 'bytes='],
    ['negativo con signo', 'bytes=-1-5'],
    ['basura', 'bytes=@@@'],
  ])('malformado: %s', (_label, header) => {
    expect(parseRange(header, SIZE)).toEqual({ kind: 'none' })
  })

  it.each([
    ['dos rangos', 'bytes=0-1,4-5'],
    ['tres rangos', 'bytes=0-1,4-5,8-9'],
    ['rango + sufijo', 'bytes=0-1,-5'],
  ])('rangos múltiples NO soportados, se ignoran: %s', (_label, header) => {
    expect(parseRange(header, SIZE)).toEqual({ kind: 'none' })
  })
})

describe('objeto de tamaño cero', () => {
  it('sin Range ⇒ none (200 con Content-Length: 0)', () => {
    expect(parseRange(null, 0)).toEqual({ kind: 'none' })
  })

  it.each([
    ['bytes=0-0', 'bytes=0-0'],
    ['bytes=0-', 'bytes=0-'],
    ['bytes=-1', 'bytes=-1'],
  ])('Range único válido ⇒ unsatisfiable (416 bytes *\\/0): %s', (_label, header) => {
    expect(parseRange(header, 0)).toEqual({ kind: 'unsatisfiable' })
  })

  it('malformado ⇒ ignorado incluso con size 0', () => {
    expect(parseRange('bytes=abc', 0)).toEqual({ kind: 'none' })
  })

  it('múltiple ⇒ ignorado incluso con size 0', () => {
    expect(parseRange('bytes=0-1,4-5', 0)).toEqual({ kind: 'none' })
  })
})

describe('formateo de Content-Range', () => {
  it('206', () => {
    expect(contentRange(10, 19, 100)).toBe('bytes 10-19/100')
  })

  it('416', () => {
    expect(unsatisfiedContentRange(100)).toBe('bytes */100')
    expect(unsatisfiedContentRange(0)).toBe('bytes */0')
  })
})

describe('robustez numérica', () => {
  it('rechaza números fuera del rango seguro ⇒ ignorado', () => {
    expect(parseRange('bytes=99999999999999999999-', SIZE)).toEqual({ kind: 'none' })
  })

  it('acepta ceros a la izquierda', () => {
    expect(parseRange('bytes=0010-0019', SIZE)).toEqual({
      kind: 'satisfiable',
      start: 10,
      end: 19,
    })
  })
})
