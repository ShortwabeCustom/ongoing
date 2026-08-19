import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ removeFromIndex: vi.fn(), db: {} as any }))
vi.mock('@/lib/db-lazy', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/services/search-service', () => ({ SearchService: { removeFromIndex: mocks.removeFromIndex, indexFinding: vi.fn(), bulkIndexFindings: vi.fn() } }))

import { FindingService } from '../finding-service'

function setup(activeIds: string[]) {
  const tx = {
    finding: {
      findMany: vi.fn().mockResolvedValue(activeIds.map((id) => ({ id, deletedAt: null }))),
      updateMany: vi.fn().mockResolvedValue({ count: activeIds.length }),
    },
    auditLog: { createMany: vi.fn().mockResolvedValue({ count: activeIds.length }) },
  }
  mocks.db = { $transaction: vi.fn(async (callback: any) => callback(tx)) }
  return tx
}

describe('FindingService.bulkDeleteFindings', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.removeFromIndex.mockResolvedValue(undefined) })

  it('deduplica, hace soft delete y crea una auditoría DELETE por Finding', async () => {
    const tx = setup(['finding-a', 'finding-b'])
    const result = await FindingService.bulkDeleteFindings(['finding-a', 'finding-a', 'finding-b'], 'actor')
    expect(tx.finding.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['finding-a', 'finding-b'] }, deletedAt: null },
      data: expect.objectContaining({ deletedAt: expect.any(Date), updatedBy: 'actor' }),
    }))
    expect(tx.auditLog.createMany.mock.calls[0][0].data).toHaveLength(2)
    expect(tx.auditLog.createMany.mock.calls[0][0].data.every((row: any) => row.action === 'DELETE')).toBe(true)
    expect((tx.finding as any).delete).toBeUndefined()
    expect(result).toMatchObject({ deleted: 2, ids: ['finding-a', 'finding-b'] })
  })

  it('aborta antes de mutar si falta o ya está eliminado uno de los IDs', async () => {
    const tx = setup(['finding-a'])
    await expect(FindingService.bulkDeleteFindings(['finding-a', 'missing'], 'actor')).rejects.toThrow('NOT_FOUND')
    expect(tx.finding.updateMany).not.toHaveBeenCalled()
    expect(tx.auditLog.createMany).not.toHaveBeenCalled()
    expect(mocks.removeFromIndex).not.toHaveBeenCalled()
  })

  it('confirma PostgreSQL antes de limpiar Elasticsearch', async () => {
    const order: string[] = []
    const tx = setup(['finding-a'])
    tx.auditLog.createMany.mockImplementation(async () => { order.push('postgres-commit'); return { count: 1 } })
    mocks.removeFromIndex.mockImplementation(async () => { order.push('elasticsearch-cleanup') })
    await FindingService.bulkDeleteFindings(['finding-a'], 'actor')
    expect(order).toEqual(['postgres-commit', 'elasticsearch-cleanup'])
  })
})
