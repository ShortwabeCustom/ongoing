import { describe, it, expect } from 'vitest'
import { formatAuditValue, auditValuesEqual, getAuditChanges } from '@/lib/utils/audit-format'

/**
 * C-01 · Presentación de valores de `AuditLog`.
 *
 * `formatAuditValue` es la única frontera entre el JSON arbitrario que guarda
 * `audit_logs` y el árbol de React. Contrato:
 *   - devuelve SIEMPRE un string (nunca un objeto, nunca `[object Object]`)
 *   - es determinista: la misma entrada produce la misma salida
 *   - no oculta campos: un valor problemático se muestra, no se descarta
 *   - no infla el historial con volcados JSON gigantes
 */

const FID = 'cmswx0isd0000c92srk50n57o'

describe('formatAuditValue · escalares', () => {
  it('string se muestra tal cual', () => {
    expect(formatAuditValue('observación nueva')).toBe('observación nueva')
  })

  it('string vacío se marca explícitamente', () => {
    expect(formatAuditValue('')).toBe('(cadena vacía)')
  })

  it('number y boolean', () => {
    expect(formatAuditValue(0)).toBe('0')
    expect(formatAuditValue(42)).toBe('42')
    expect(formatAuditValue(-1.5)).toBe('-1.5')
    expect(formatAuditValue(true)).toBe('true')
    expect(formatAuditValue(false)).toBe('false')
  })

  it('null y undefined se distinguen entre sí', () => {
    expect(formatAuditValue(null)).toBe('(vacío)')
    expect(formatAuditValue(undefined)).toBe('(sin dato)')
    expect(formatAuditValue(null)).not.toBe(formatAuditValue(undefined))
  })

  it('todos los escalares devuelven string', () => {
    for (const v of ['x', 1, true, false, null, undefined, '']) {
      expect(typeof formatAuditValue(v)).toBe('string')
    }
  })
})

describe('formatAuditValue · arrays', () => {
  it('array vacío', () => {
    expect(formatAuditValue([])).toBe('(lista vacía)')
  })

  it('array de strings se une de forma legible', () => {
    expect(formatAuditValue(['DESIGN', 'COPY'])).toBe('DESIGN, COPY')
  })

  it('array de números', () => {
    expect(formatAuditValue([1, 2, 3])).toBe('1, 2, 3')
  })
})

describe('formatAuditValue · formas reales del dominio', () => {
  it('incidenceTypes: muestra los tipos, no el volcado con findingId repetido', () => {
    const value = [
      { findingId: FID, incidenceType: 'DESIGN' },
      { findingId: FID, incidenceType: 'FUNCTIONALITY' },
    ]
    const out = formatAuditValue(value, 'incidenceTypes')

    expect(out).toBe('DESIGN, FUNCTIONALITY')
    expect(out).not.toContain(FID)
    expect(out).not.toContain('[object Object]')
  })

  it('caso crítico del encargo: [{findingId, incidenceType:"DESIGN"}]', () => {
    expect(formatAuditValue([{ findingId: FID, incidenceType: 'DESIGN' }], 'incidenceTypes')).toBe(
      'DESIGN',
    )
  })

  it('experienceTags: mismo tratamiento que incidenceTypes', () => {
    const value = [
      { findingId: FID, experienceTag: 'UX' },
      { findingId: FID, experienceTag: 'UI' },
    ]
    expect(formatAuditValue(value, 'experienceTags')).toBe('UX, UI')
  })

  it('supportLinks: título y URL, sin ids ni timestamps de ruido', () => {
    const value = [
      {
        id: 'lnk1',
        title: 'Especificación',
        url: 'https://example.com/spec',
        createdAt: '2026-08-17T07:31:27.001Z',
        updatedAt: '2026-08-17T07:31:27.001Z',
      },
    ]
    const out = formatAuditValue(value, 'supportLinks')

    expect(out).toContain('https://example.com/spec')
    expect(out).toContain('Especificación')
    expect(out).not.toContain('lnk1')
    expect(out).not.toContain('[object Object]')
  })

  it('supportLinks sin título cae a la URL sola', () => {
    expect(formatAuditValue([{ url: 'https://example.com/a' }], 'supportLinks')).toBe(
      'https://example.com/a',
    )
  })

  it('supportLinks vacío (la mitad "after" de la asimetría conocida)', () => {
    expect(formatAuditValue([], 'supportLinks')).toBe('(lista vacía)')
  })
})

describe('formatAuditValue · objetos y formas desconocidas', () => {
  it('objeto plano nunca produce [object Object]', () => {
    const out = formatAuditValue({ a: 1, b: 'dos' })
    expect(out).not.toContain('[object Object]')
    expect(out).toContain('a')
    expect(out).toContain('1')
  })

  it('objeto anidado se serializa de forma legible', () => {
    const out = formatAuditValue({ k: 2, n: { z: 3 } })
    expect(out).not.toContain('[object Object]')
    expect(out).toContain('z')
  })

  it('array de objetos de forma desconocida no rompe ni produce [object Object]', () => {
    const out = formatAuditValue([{ desconocido: true, anidado: { x: [1, 2] } }])
    expect(typeof out).toBe('string')
    expect(out).not.toContain('[object Object]')
  })

  it('es determinista: misma entrada, misma salida', () => {
    const value = { b: 2, a: [1, { c: 3 }] }
    expect(formatAuditValue(value)).toBe(formatAuditValue(value))
    expect(formatAuditValue(value)).toBe(formatAuditValue({ b: 2, a: [1, { c: 3 }] }))
  })

  it('trunca volcados enormes en vez de inundar el historial', () => {
    const grande = { texto: 'x'.repeat(5000) }
    const out = formatAuditValue(grande)
    expect(out.length).toBeLessThanOrEqual(200)
    expect(out.endsWith('…')).toBe(true)
  })

  it('estructura circular no lanza', () => {
    const circular: Record<string, unknown> = { a: 1 }
    circular.self = circular
    expect(() => formatAuditValue(circular)).not.toThrow()
    expect(typeof formatAuditValue(circular)).toBe('string')
  })

  it('siempre devuelve string, sea cual sea la entrada', () => {
    const entradas: unknown[] = [
      Symbol('s'),
      () => 'fn',
      new Date('2026-08-17T00:00:00.000Z'),
      BigInt(10),
      NaN,
      Infinity,
      [[1, 2], [3, 4]],
    ]
    for (const v of entradas) {
      expect(typeof formatAuditValue(v)).toBe('string')
      expect(formatAuditValue(v)).not.toContain('[object Object]')
    }
  })
})

describe('auditValuesEqual · comparación por valor, no por referencia', () => {
  it('arrays de objetos equivalentes son iguales aunque sean referencias distintas', () => {
    const a = [{ findingId: FID, incidenceType: 'DESIGN' }]
    const b = [{ findingId: FID, incidenceType: 'DESIGN' }]
    expect(a === b).toBe(false)
    expect(auditValuesEqual(a, b)).toBe(true)
  })

  it('detecta diferencias reales', () => {
    expect(
      auditValuesEqual(
        [{ findingId: FID, incidenceType: 'DESIGN' }],
        [{ findingId: FID, incidenceType: 'COPY' }],
      ),
    ).toBe(false)
  })

  it('escalares', () => {
    expect(auditValuesEqual('a', 'a')).toBe(true)
    expect(auditValuesEqual('a', 'b')).toBe(false)
    expect(auditValuesEqual(null, null)).toBe(true)
    expect(auditValuesEqual(null, undefined)).toBe(false)
  })
})

describe('getAuditChanges · diff presentable', () => {
  it('omite los campos sin cambio real y conserva los que sí cambiaron', () => {
    const before = {
      observation: 'igual',
      priority: 'MEDIUM',
      incidenceTypes: [{ findingId: FID, incidenceType: 'DESIGN' }],
    }
    const after = {
      observation: 'igual',
      priority: 'HIGH',
      incidenceTypes: [{ findingId: FID, incidenceType: 'DESIGN' }],
    }

    const changes = getAuditChanges(before, after)
    expect(changes.map((c) => c.key)).toEqual(['priority'])
    expect(changes[0].before).toBe('MEDIUM')
    expect(changes[0].after).toBe('HIGH')
  })

  it('incluye claves presentes sólo en after (asimetría conocida de supportLinks)', () => {
    const changes = getAuditChanges({ observation: 'x' }, { observation: 'x', supportLinks: [] })
    expect(changes.map((c) => c.key)).toEqual(['supportLinks'])
    expect(changes[0].before).toBe('(sin dato)')
    expect(changes[0].after).toBe('(lista vacía)')
  })

  it('todos los valores devueltos son strings (contrato con React)', () => {
    const changes = getAuditChanges(
      { a: 1, b: { x: 1 }, c: [{ findingId: FID, incidenceType: 'DESIGN' }] },
      { a: 2, b: { x: 2 }, c: [{ findingId: FID, incidenceType: 'COPY' }] },
    )
    expect(changes.length).toBe(3)
    for (const change of changes) {
      expect(typeof change.key).toBe('string')
      expect(typeof change.before).toBe('string')
      expect(typeof change.after).toBe('string')
    }
  })

  it('before o after nulos devuelven lista vacía', () => {
    expect(getAuditChanges(null, { a: 1 })).toEqual([])
    expect(getAuditChanges({ a: 1 }, null)).toEqual([])
  })
})
