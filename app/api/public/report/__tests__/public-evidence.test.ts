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
  db.finding.count.mockResolvedValue(0)
  db.finding.findMany.mockImplementation(async (args: unknown) => {
    calls.findingFindMany.push(args)
    return []
  })
  db.evidence.count.mockImplementation(async (args: unknown) => {
    calls.evidenceCount.push(args)
    return 0
  })
  db.testSession.findMany.mockResolvedValue([])
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

  it('ambos exigen storageKey legacy: la evidencia de runtime nunca entra', async () => {
    await GET()
    expect(countWhere().storageKey).toEqual({ startsWith: 'legacy/' })
    expect(listWhere().storageKey).toEqual({ startsWith: 'legacy/' })
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

  it('la lista no selecciona storageKey: no se filtra la ruta interna', async () => {
    await GET()
    const select = (calls.findingFindMany[0] as any).select.evidence.select
    expect(select.storageKey).toBeUndefined()
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

  it('incluye findings sin evidencia y sesiones, con estadísticas consistentes', async () => {
    db.finding.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
    db.testSession.findMany.mockResolvedValueOnce([
      { id: 'session-a', name: 'Sesión A', date: new Date('2026-08-10'), _count: { findings: 2 } },
    ] as any)
    db.finding.findMany.mockImplementationOnce(async (args: unknown) => {
      calls.findingFindMany.push(args)
      return [
        {
          id: 'finding-a', observation: 'Sin evidencia', status: 'OPEN', sourceRow: 2,
          testSessionId: 'session-a', testSession: { name: 'Sesión A' }, incidenceTypes: [], evidence: [],
        },
        {
          id: 'finding-b', observation: 'Con legacy pública', status: 'CLOSED', sourceRow: 3,
          testSessionId: 'session-a', testSession: { name: 'Sesión A' }, incidenceTypes: [],
          evidence: [{ id: 'evidence-a', url: '/images/legacy.jpg', originalFilename: 'legacy.jpg' }],
        },
      ]
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.findings).toHaveLength(2)
    expect(body.findings[0].evidence).toEqual([])
    expect(body.findings[1].evidence).toEqual([{ url: '/images/legacy.jpg', filename: 'legacy.jpg' }])
    expect(body.rounds).toEqual([{ id: 'session-a', label: 'Sesión A', count: 2 }])
    expect(body.stats.observations).toBe(body.findings.length)
    expect(body.stats.completed + body.stats.pending).toBe(body.stats.observations)
  })

  it('excluye findings borrados desde la query padre', async () => {
    await GET()
    expect((calls.findingFindMany[0] as any).where.deletedAt).toBeNull()
  })

  it('solo incluye sesiones que conservan findings activos', async () => {
    await GET()
    expect(db.testSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { findings: { some: { deletedAt: null } } },
    }))
  })

  it('no selecciona rutas internas ni storageKey de evidencia privada', async () => {
    await GET()
    const select = (calls.findingFindMany[0] as any).select.evidence.select
    expect(select).toEqual({ id: true, url: true, originalFilename: true })
    expect(select.storageKey).toBeUndefined()
    expect(listWhere()).toMatchObject({ deletedAt: null, storageKey: { startsWith: 'legacy/' } })
  })
})
