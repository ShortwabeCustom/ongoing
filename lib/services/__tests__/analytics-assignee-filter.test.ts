import { describe, expect, it, vi } from 'vitest'
import { AnalyticsService } from '@/lib/services/analytics'

/**
 * FASE 3 (Analytics filters): AnalyticsService now forwards `assigneeId` to
 * FindingService.buildWhereClause, the same field /findings already relies
 * on — this verifies the where-clause actually changes per assigneeId
 * (Recognition over guessing: a wired-but-inert filter would look identical
 * from the UI, so the assertion has to be on the constructed Prisma filter).
 */

const mockFinding = {
  count: vi.fn().mockResolvedValue(0),
  groupBy: vi.fn().mockResolvedValue([]),
  findMany: vi.fn().mockResolvedValue([]),
}
const mockValidation = { groupBy: vi.fn().mockResolvedValue([]) }
const mockFindingStatusHistory = { findMany: vi.fn().mockResolvedValue([]) }

vi.mock('@/lib/db-lazy', () => ({
  getDb: () => ({
    finding: mockFinding,
    validation: mockValidation,
    findingStatusHistory: mockFindingStatusHistory,
  }),
}))

// Rol global OWNER: `buildWhereClause` no restringe por proyecto, así que
// `where.project` queda como `{ id: projectId, deletedAt: null }` sin el OR
// de membresía — igual que antes de este cambio para efectos del test.
const ownerUser = { id: 'test-owner', role: 'OWNER' }

describe('AnalyticsService assigneeId wiring', () => {
  it('includes assigneeId in the where clause used to count/group findings', async () => {
    await AnalyticsService.getKPIs({ assigneeId: 'user-42', granularity: 'day' }, ownerUser)

    expect(mockFinding.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assigneeId: 'user-42' }) }),
    )
  })

  it('omits assigneeId from the where clause when not provided (Sin asignar / no filter)', async () => {
    mockFinding.count.mockClear()
    await AnalyticsService.getKPIs({ granularity: 'day' }, ownerUser)

    const [{ where }] = mockFinding.count.mock.calls.at(-1)!
    expect(where).not.toHaveProperty('assigneeId')
  })

  it('combines assigneeId with status and projectId without dropping either filter', async () => {
    mockFinding.count.mockClear()
    await AnalyticsService.getKPIs(
      {
        assigneeId: 'user-42',
        status: ['OPEN'],
        projectId: 'proj-1',
        granularity: 'day',
      },
      ownerUser,
    )

    const [{ where }] = mockFinding.count.mock.calls.at(-1)!
    expect(where).toMatchObject({
      assigneeId: 'user-42',
      project: { id: 'proj-1' },
      status: { in: ['OPEN'] },
    })
  })
})
