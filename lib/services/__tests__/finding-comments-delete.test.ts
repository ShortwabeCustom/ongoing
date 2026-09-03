import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  comment: {
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  // Usado por FindingService.assertFindingAccess (guard de proyecto).
  finding: {
    findFirst: vi.fn(),
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

const requestingUser = { id: 'author-1', role: 'DEVELOPER' }

describe('FindingService.deleteComment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.comment.findFirst.mockResolvedValue(comment)
    mocks.comment.delete.mockResolvedValue(comment)
    mocks.finding.findFirst.mockResolvedValue({ id: 'finding-1', projectId: 'proj-1' })
    mocks.auditLog.create.mockResolvedValue({ id: 'audit-1' })
  })

  it('permite al autor eliminar su comentario y registra auditoría', async () => {
    await expect(
      FindingService.deleteComment('finding-1', 'comment-1', 'author-1', 'DEVELOPER', requestingUser),
    ).resolves.toEqual({ id: 'comment-1' })

    expect(mocks.comment.delete).toHaveBeenCalledWith({ where: { id: 'comment-1' } })
    expect(mocks.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'DELETE', actorId: 'author-1' }),
    })
  })

  it('permite a OWNER eliminar comentarios de otros usuarios', async () => {
    await expect(
      FindingService.deleteComment('finding-1', 'comment-1', 'owner-1', 'OWNER', {
        id: 'owner-1',
        role: 'OWNER',
      }),
    ).resolves.toEqual({ id: 'comment-1' })
  })

  it('rechaza a un colaborador que no es el autor', async () => {
    await expect(
      FindingService.deleteComment('finding-1', 'comment-1', 'other-1', 'DEVELOPER', {
        id: 'other-1',
        role: 'DEVELOPER',
      }),
    ).rejects.toThrow('FORBIDDEN')

    expect(mocks.comment.delete).not.toHaveBeenCalled()
  })
})
