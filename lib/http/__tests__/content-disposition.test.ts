// @vitest-environment node
/**
 * ADR-001 §3.1 — `Content-Disposition: inline` con filename saneado y RFC 5987.
 *
 * El valor de entrada procede de la BD y puede ser histórico o manipulado: el
 * helper debe ser defensivo por sí solo, sin confiar en el saneado del upload.
 */

import { describe, expect, it } from 'vitest'
import { inlineContentDisposition } from '../content-disposition'

/** Una cabecera no puede contener CR ni LF bajo ninguna circunstancia. */
function assertNoHeaderInjection(value: string) {
  expect(value).not.toContain('\r')
  expect(value).not.toContain('\n')
  // Las comillas solo pueden ser las dos que delimitan filename="…".
  expect(value.split('"').length - 1).toBe(2)
}

describe('nombres ASCII simples', () => {
  it('se conservan', () => {
    const value = inlineContentDisposition('captura.png')
    expect(value).toBe(`inline; filename="captura.png"; filename*=UTF-8''captura.png`)
    assertNoHeaderInjection(value)
  })

  it('siempre empieza por inline', () => {
    expect(inlineContentDisposition('x.png').startsWith('inline;')).toBe(true)
  })
})

describe('unicode / RFC 5987', () => {
  it('acentos: fallback ASCII saneado + filename* codificado', () => {
    const value = inlineContentDisposition('cañón año.png')

    expect(value).toContain('filename="ca_n_a_o.png"')
    expect(value).toContain("filename*=UTF-8''")
    expect(value).toContain('%C3%B1') // ñ
    assertNoHeaderInjection(value)
  })

  it('emoji y CJK no rompen la cabecera', () => {
    const value = inlineContentDisposition('（テスト）📎.png')
    assertNoHeaderInjection(value)
    expect(value).toContain("filename*=UTF-8''")
  })

  it('un nombre íntegramente no ASCII conserva un fallback utilizable', () => {
    const value = inlineContentDisposition('日本語')
    assertNoHeaderInjection(value)
    expect(value).toMatch(/filename="[^"]+"/)
  })
})

describe('RFC 8187 — filename* solo contiene attr-char y tripletes %HH', () => {
  /** attr-char (RFC 8187 §3.2.1): ALPHA / DIGIT / ! # $ & + - . ^ _ ` | ~ */
  const ATTR_CHAR = /[A-Za-z0-9!#$&+\-.^_`|~]/

  function extValue(header: string): string {
    return /filename\*=UTF-8''(.*)$/.exec(header)![1]
  }

  /** Tras retirar los tripletes válidos, no debe quedar nada fuera de attr-char. */
  function assertOnlyAttrCharAndTriplets(ext: string) {
    const stripped = ext.replace(/%[0-9A-Fa-f]{2}/g, '')
    const offenders = [...new Set([...stripped].filter((c) => !ATTR_CHAR.test(c)))]
    expect(offenders).toEqual([])
  }

  it.each([
    ["O'Reilly.png", 'O%27Reilly.png'],
    ['a*b.png', 'a%2Ab.png'],
    ['a(b).png', 'a%28b%29.png'],
    ['a%b.png', 'a%25b.png'],
    ['café final.png', 'caf%C3%A9%20final.png'],
  ])('%s ⇒ %s', (input, expected) => {
    const header = inlineContentDisposition(input)
    expect(extValue(header)).toBe(expected)
    assertOnlyAttrCharAndTriplets(extValue(header))
    assertNoHeaderInjection(header)
  })

  it('NO escapa `!`, que sí es attr-char válido', () => {
    expect(extValue(inlineContentDisposition('a!b.png'))).toBe('a!b.png')
  })

  it.each([
    ['comillas dobles', 'a"b.png'],
    ['backslash', 'a\\b.png'],
    ['punto y coma', 'a;b.png'],
    ['emoji', '📎.png'],
    ['CJK', '日本語.png'],
    ['espacios', 'a b c.png'],
  ])('la salida sigue siendo válida para %s', (_label, input) => {
    assertOnlyAttrCharAndTriplets(extValue(inlineContentDisposition(input)))
  })
})

describe('inyección de cabeceras', () => {
  it.each([
    ['CRLF + cabecera falsa', 'evil\r\nSet-Cookie: a=b'],
    ['solo CR', 'evil\rX: 1'],
    ['solo LF', 'evil\nX: 1'],
    ['NUL', 'evil\u0000.png'],
    ['C1 0x85', 'evil\u0085.png'],
  ])('neutraliza %s', (_label, filename) => {
    const value = inlineContentDisposition(filename)
    // Lo determinante es que no sobreviva ningún CR/LF: sin ellos, el texto
    // "Set-Cookie" queda como parte del filename y no puede ser una cabecera.
    assertNoHeaderInjection(value)
    expect(value.startsWith('inline; filename="')).toBe(true)
  })
})

describe('comillas y backslashes', () => {
  it('comillas dobles no escapan del parámetro', () => {
    const value = inlineContentDisposition('a"b".png')
    assertNoHeaderInjection(value)
    expect(value).toContain('filename="a_b_.png"')
    expect(value).toContain('%22')
  })

  it('backslashes no generan escapes', () => {
    const value = inlineContentDisposition('a\\b.png')
    assertNoHeaderInjection(value)
    expect(value).not.toContain('\\')
  })

  it('punto y coma no crea un parámetro nuevo', () => {
    const value = inlineContentDisposition('a;filename=evil.png')
    assertNoHeaderInjection(value)

    // Ni `;` ni `=` sobreviven dentro del filename ASCII, así que no pueden
    // abrir un parámetro adicional en la cabecera.
    const ascii = /filename="([^"]+)"/.exec(value)![1]
    expect(ascii).not.toContain(';')
    expect(ascii).not.toContain('=')
  })
})

describe('casos degenerados', () => {
  it.each([
    ['cadena vacía', ''],
    ['solo espacios', '   '],
    ['solo puntos', '...'],
    ['null', null],
    ['undefined', undefined],
    ['solo caracteres no seguros', '///'],
  ])('%s ⇒ fallback "evidence"', (_label, filename) => {
    const value = inlineContentDisposition(filename as string)
    assertNoHeaderInjection(value)
    expect(value).toContain('filename="evidence"')
  })

  it('trunca nombres desmesurados', () => {
    const value = inlineContentDisposition(`${'a'.repeat(5000)}.png`)
    assertNoHeaderInjection(value)
    const ascii = /filename="([^"]+)"/.exec(value)![1]
    expect(ascii.length).toBeLessThanOrEqual(120)
  })

  it('no permite que un nombre oculto (.htaccess) empiece por punto', () => {
    const value = inlineContentDisposition('.htaccess')
    expect(value).toContain('filename="htaccess"')
  })
})
