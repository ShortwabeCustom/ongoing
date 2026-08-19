import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  comment: {
    findFirst: vi.fn(),
    delete: vi.fn(),
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

const comment = {
  id: 'comment-1',
  findingId: 'finding-1',
  text: 'Comentario de prueba',
  createdBy: 'author-1',
  createdAt: new Date('2026-08-19T22:00:00.000Z'),
}

describe('FindingService.deleteComment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.comment.findFirst.mockResolvedValue(comment)
    mocks.comment.delete.mockResolvedValue(comment)
    mocks.auditLog.create.mockResolvedValue({ id: 'audit-1' })
  })

  it('permite al autor eliminar su comentario y registra auditoría', async () => {
    await expect(
      FindingService.deleteComment('finding-1', 'comment-1', 'author-1', 'DEVELOPER'),
    ).resolves.toEqual({ id: 'comment-1' })

    expect(mocks.comment.delete).toHaveBeenCalledWith({ where: { id: 'comment-1' } })
    expect(mocks.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'DELETE', actorId: 'author-1' }),
    })
  })

  it('permite a OWNER eliminar comentarios de otros usuarios', async () => {
    await expect(
      FindingService.deleteComment('finding-1', 'comment-1', 'owner-1', 'OWNER'),
    ).resolves.toEqual({ id: 'comment-1' })
  })

  it('rechaza a un colaborador que no es el autor', async () => {
    await expect(
      FindingService.deleteComment('finding-1', 'comment-1', 'other-1', 'DEVELOPER'),
    ).rejects.toThrow('FORBIDDEN')

    expect(mocks.comment.delete).not.toHaveBeenCalled()
  })
})
