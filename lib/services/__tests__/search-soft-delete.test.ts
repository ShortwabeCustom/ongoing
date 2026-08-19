import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ search: vi.fn(), remove: vi.fn(), db: {} as any, deleted: false }))
vi.mock('@/lib/es-lazy', () => ({ getEsClient: () => ({ search: mocks.search, delete: mocks.remove }) }))
vi.mock('@/lib/elasticsearch/findings-index', () => ({ FINDINGS_INDEX: 'findings', ensureIndexExists: vi.fn() }))
vi.mock('@/lib/db-lazy', () => ({ getDb: () => mocks.db }))

import { FindingService } from '../finding-service'
import { SearchService } from '../search-service'

describe('soft delete con Elasticsearch obsoleto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deleted = false
    process.env.ELASTICSEARCH_ENABLED = 'true'
    process.env.ELASTICSEARCH_URL = 'http://unused.local'
    mocks.search.mockResolvedValue({ hits: { total: { value: 1 }, hits: [
      { _source: { id: 'finding-a', observation: 'A', status: 'OPEN', priority: 'HIGH', severity: 'MAJOR', projectId: 'project-a', createdAt: '2026-08-19T00:00:00Z' } },
    ] }, aggregations: { status: { buckets: [{ key: 'OPEN', doc_count: 1 }] } } })
    mocks.remove.mockRejectedValue(new Error('Elasticsearch unavailable'))

    const finding = {
      findMany: vi.fn(async () => mocks.deleted ? [] : [{ id: 'finding-a', deletedAt: null }]),
      updateMany: vi.fn(async () => { mocks.deleted = true; return { count: 1 } }),
      count: vi.fn(async () => mocks.deleted ? 0 : 1),
      groupBy: vi.fn(async ({ by }: any) => {
        if (mocks.deleted) return []
        const key = by[0]
        return [{ [key]: key === 'status' ? 'OPEN' : key === 'priority' ? 'HIGH' : key === 'severity' ? 'MAJOR' : key === 'assigneeId' ? null : 'project-a', _count: 1 }]
      }),
    }
    const tx = { finding, auditLog: { createMany: vi.fn().mockResolvedValue({ count: 1 }) } }
    mocks.db = { finding, $transaction: vi.fn(async (callback: any) => callback(tx)) }
  })

  it('soft delete → fallo removeFromIndex → búsqueda excluye hit, total y facets stale', async () => {
    await FindingService.bulkDeleteFindings(['finding-a'], 'actor-a')
    expect(mocks.deleted).toBe(true)
    expect(mocks.remove).toHaveBeenCalledWith({ index: 'findings', id: 'finding-a' })

    const result = await SearchService.search({ limit: 20, offset: 0 })
    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
    expect(result.facets).toEqual({ status: {}, priority: {}, severity: {}, assignee: [], project: [] })
  })
})
