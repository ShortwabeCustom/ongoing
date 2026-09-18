// @vitest-environment node
/**
 * Filtros categóricos del reporte público: cada hallazgo expone sus categorías,
 * tipo y canal tal como están en el registro, y `facets` cuenta esos mismos
 * valores. El detalle (`metaLine`) muestra todas las categorías, no solo
 * Diseño y Copy.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'

const ROWS = [
  {
    id: 'f1',
    observation: 'Uno',
    status: 'OPEN',
    sourceRow: 5,
    testSessionId: 's1',
    testSession: { name: 'Enero' },
    findingType: 'FINDING',
    channel: ' BAZ ',
    incidenceTypes: [{ incidenceType: 'COPY' }, { incidenceType: 'FUNCTIONALITY' }],
    evidence: [],
  },
  {
    id: 'f2',
    observation: 'Dos',
    status: 'VALIDATED',
    sourceRow: null,
    testSessionId: null,
    testSession: null,
    findingType: null,
    channel: null,
    incidenceTypes: [],
    evidence: [],
  },
]

vi.mock('@/lib/db-lazy', () => ({
  getDb: () => ({
    finding: { count: vi.fn(async () => ROWS.length), findMany: vi.fn(async () => ROWS) },
    evidence: { count: vi.fn(async () => 0) },
    testSession: { findMany: vi.fn(async () => []) },
  }),
}))

let GET: typeof import('@/app/api/public/report/route').GET

beforeAll(async () => {
  ;({ GET } = await import('@/app/api/public/report/route'))
})

describe('GET /api/public/report — campos categóricos', () => {
  it('expone categorías, tipo y canal por hallazgo, sin inventar valores para los que no tienen', async () => {
    const body = await (await GET()).json()
    const [f1, f2] = body.findings

    expect(f1.categories).toEqual(['FUNCTIONALITY', 'COPY'])
    expect(f1.findingType).toBe('FINDING')
    expect(f1.channel).toBe('BAZ')
    expect(f2.categories).toEqual([])
    expect(f2.findingType).toBeNull()
    expect(f2.channel).toBeNull()
  })

  it('facets cuenta los mismos valores; los hallazgos sin dato no crean opciones', async () => {
    const { facets } = await (await GET()).json()

    expect(facets.categories).toEqual([
      { value: 'FUNCTIONALITY', label: 'Funcionalidad', count: 1 },
      { value: 'COPY', label: 'Copy', count: 1 },
    ])
    expect(facets.types).toEqual([{ value: 'FINDING', label: 'Hallazgo', count: 1 }])
    expect(facets.channels).toEqual([{ value: 'BAZ', label: 'BAZ', count: 1 }])
  })

  it('el detalle lista todas las categorías, tipo y canal, sin separadores sobrantes', async () => {
    const { findings } = await (await GET()).json()

    expect(findings[0].metaLine).toBe('Enero · Fila 5 · Funcionalidad · Copy · Hallazgo · BAZ')
    expect(findings[1].metaLine).toBe('')
    // Los chips visibles del resumen no cambian: solo Diseño y Copy.
    expect(findings[0].tags).toEqual(['Copy'])
  })
})
