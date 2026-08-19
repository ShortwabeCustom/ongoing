// @vitest-environment node
/**
 * ADR-001 D8 — el reporte público y su contador comparten UNA definición de
 * "evidencia públicamente renderizable".
 *
 * Este test verifica la regla contra la FORMA de las queries que la ruta emite:
 * el `where` del contador y el de la lista anidada deben ser el mismo predicado
 * (salvo la cláusula del finding, que en la lista garantiza la query padre).
 * Si divergen, el contador filtraría la existencia de evidencia privada por un
 * endpoint anónimo.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ evidenceCount: [] as unknown[], findingFindMany: [] as unknown[] }))

const db = vi.hoisted(() => ({
  finding: {
    count: vi.fn(async () => 0),
    findMany: vi.fn(async (args: unknown) => {
      calls.findingFindMany.push(args)
      return []
    }),
  },
  evidence: {
    count: vi.fn(async (args: unknown) => {
      calls.evidenceCount.push(args)
      return 0
    }),
  },
  testSession: { findMany: vi.fn(async () => []) },
}))

vi.mock('@/lib/db-lazy', () => ({ getDb: () => db }))

const { GET } = await import('@/app/api/public/report/route')

beforeEach(() => {
  vi.clearAllMocks()
  calls.evidenceCount.length = 0
  calls.findingFindMany.length = 0
})

function countWhere(): any {
  return (calls.evidenceCount[0] as any).where
}

function listWhere(): any {
  return (calls.findingFindMany[0] as any).select.evidence.where
}

describe('regla única de renderizabilidad pública', () => {
  it('el contador y la lista aplican el MISMO predicado de evidencia', async () => {
    await GET()

    const forCount = { ...countWhere() }
    // La lista no repite la cláusula del finding: la impone la query padre.
    delete forCount.finding

    expect(forCount).toEqual(listWhere())
  })

  it('ambos exigen evidencia activa (deletedAt: null)', async () => {
    await GET()
    expect(countWhere().deletedAt).toBeNull()
    expect(listWhere().deletedAt).toBeNull()
  })

  it('incluye evidencia confirmada sin restringirla al prefijo legacy', async () => {
    await GET()
    expect(countWhere()).not.toHaveProperty('storageKey')
    expect(listWhere()).not.toHaveProperty('storageKey')
  })

  it('ambos exigen url != null y url != ""', async () => {
    await GET()
    for (const where of [countWhere(), listWhere()]) {
      expect(where.url).toEqual({ not: null })
      expect(where.NOT).toEqual({ url: '' })
    }
  })

  it('el contador exige además que el finding esté activo', async () => {
    await GET()
    expect(countWhere().finding).toEqual({ deletedAt: null })
  })

  it('la query padre de findings ya restringe a findings activos', async () => {
    await GET()
    expect((calls.findingFindMany[0] as any).where).toMatchObject({ deletedAt: null })
  })

  it('selecciona storageKey solo para elegir la URL de entrega', async () => {
    await GET()
    const select = (calls.findingFindMany[0] as any).select.evidence.select
    expect(select.storageKey).toBe(true)
  })
})

describe('contrato público conservado', () => {
  it('sigue respondiendo 200 de forma anónima y con la forma esperada', async () => {
    const response = await GET()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toHaveProperty('stats')
    expect(body.stats).toHaveProperty('evidenceCount')
    expect(body).toHaveProperty('rounds')
    expect(body).toHaveProperty('findings')
  })
})
