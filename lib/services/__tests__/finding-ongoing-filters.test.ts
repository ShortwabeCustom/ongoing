import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db-lazy', () => ({ getDb: () => ({}) }))

import { FindingService } from '@/lib/services/finding-service'

const ownerUser = { id: 'test-owner', role: 'OWNER' } as never

describe('FindingService.buildWhereClause — filtros ONGOING', () => {
  it('filtra por Tipo y Canal con `in`', () => {
    const where = FindingService.buildWhereClause(
      { findingType: ['FINDING', 'INCIDENT'], channel: ['BAZ'] },
      ownerUser,
    )

    expect(where.findingType).toEqual({ in: ['FINDING', 'INCIDENT'] })
    expect(where.channel).toEqual({ in: ['BAZ'] })
  })

  it('no agrega condiciones cuando los filtros no vienen', () => {
    const where = FindingService.buildWhereClause({}, ownerUser)

    expect(where).not.toHaveProperty('findingType')
    expect(where).not.toHaveProperty('channel')
  })

  it('la búsqueda libre incluye el ID Jira', () => {
    const where = FindingService.buildWhereClause({ search: 'CREODM-22636' }, ownerUser)
    const or = (where.AND as Array<{ OR: Array<Record<string, unknown>> }>)[0].OR

    expect(or.some((clause) => 'jiraId' in clause)).toBe(true)
  })
})
