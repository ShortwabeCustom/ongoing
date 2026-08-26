import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  finding: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: { create: vi.fn() },
}))

const db = {
  ...mocks,
  $transaction: vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)),
}

vi.mock('@/lib/db-lazy', () => ({ getDb: () => db }))
vi.mock('@/lib/services/search-service', () => ({
  SearchService: { indexFinding: vi.fn(), removeFromIndex: vi.fn(), bulkIndexFindings: vi.fn() },
}))

import { FindingService } from '@/lib/services/finding-service'

const activeFinding = { id: 'finding-1', deletedAt: null }

describe('FindingService.deleteFinding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.finding.findUnique.mockResolvedValue(activeFinding)
    mocks.finding.updateMany.mockResolvedValue({ count: 1 })
    mocks.auditLog.create.mockResolvedValue({ id: 'audit-1' })
  })

  it('hace soft delete del finding activo y registra auditoría', async () => {
    const result = await FindingService.deleteFinding('finding-1', 'owner-1')

    expect(result.id).toBe('finding-1')
    expect(mocks.finding.updateMany).toHaveBeenCalledWith({
      where: { id: 'finding-1', deletedAt: null },
      data: expect.objectContaining({ updatedBy: 'owner-1' }),
    })
    expect(mocks.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Finding',
        entityId: 'finding-1',
        action: 'DELETE',
        actorId: 'owner-1',
      }),
    })
  })

  it('rechaza un finding inexistente', async () => {
    mocks.finding.findUnique.mockResolvedValue(null)

    await expect(FindingService.deleteFinding('missing', 'owner-1')).rejects.toThrow('NOT_FOUND')
    expect(mocks.finding.updateMany).not.toHaveBeenCalled()
  })

  it('rechaza un finding ya eliminado', async () => {
    mocks.finding.findUnique.mockResolvedValue({ id: 'finding-1', deletedAt: new Date('2026-08-18T00:00:00.000Z') })

    await expect(FindingService.deleteFinding('finding-1', 'owner-1')).rejects.toThrow('ALREADY_DELETED')
    expect(mocks.finding.updateMany).not.toHaveBeenCalled()
  })

  it('rechaza una carrera donde el finding se elimina entre el lookup y el update', async () => {
    mocks.finding.updateMany.mockResolvedValue({ count: 0 })

    await expect(FindingService.deleteFinding('finding-1', 'owner-1')).rejects.toThrow('ALREADY_DELETED')
    expect(mocks.auditLog.create).not.toHaveBeenCalled()
  })
})
