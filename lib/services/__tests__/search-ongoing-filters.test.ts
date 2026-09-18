import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFinding = vi.hoisted(() => ({
  findMany: vi.fn().mockResolvedValue([]),
  count: vi.fn().mockResolvedValue(0),
  groupBy: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/db-lazy', () => ({ getDb: () => ({ finding: mockFinding }) }))
vi.mock('@/lib/es-lazy', () => ({ getEsClient: vi.fn() }))

import { SearchService } from '@/lib/services/search-service'

describe('SearchService — filtros Tipo, Canal y Categoría (PostgreSQL)', () => {
  beforeEach(() => {
    vi.stubEnv('ELASTICSEARCH_ENABLED', 'false')
    mockFinding.findMany.mockClear()
    mockFinding.count.mockClear()
  })

  it('traduce los tres filtros a la cláusula where', async () => {
    await SearchService.search(
      {
        findingType: ['FINDING'],
        channel: ['BAZ', 'Elektra'],
        incidenceType: ['DESIGN'],
        limit: 20,
        offset: 0,
      },
      null,
    )

    const { where } = mockFinding.findMany.mock.calls[0][0]
    expect(where.findingType).toEqual({ in: ['FINDING'] })
    expect(where.channel).toEqual({ in: ['BAZ', 'Elektra'] })
    expect(where.incidenceTypes).toEqual({ some: { incidenceType: { in: ['DESIGN'] } } })
  })

  it('devuelve Tipo, Canal e ID Jira de cada resultado', async () => {
    mockFinding.findMany.mockResolvedValueOnce([
      {
        id: 'f1',
        observation: 'obs',
        status: 'OPEN',
        priority: 'HIGH',
        severity: 'MINOR',
        assigneeId: null,
        projectId: 'p1',
        findingType: 'IMPROVEMENT',
        channel: 'BAZ',
        jiraId: 'CREODM-1',
        experienceTags: [],
        incidenceTypes: [],
        createdAt: new Date('2026-09-18T00:00:00Z'),
      },
    ])

    const result = await SearchService.search({ limit: 20, offset: 0 }, null)

    expect(result.items[0]).toMatchObject({ findingType: 'IMPROVEMENT', channel: 'BAZ', jiraId: 'CREODM-1' })
  })
})
