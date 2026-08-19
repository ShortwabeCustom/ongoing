import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPostgresWhere } from '../search-service'

describe('buildPostgresWhere — matriz de filtros', () => {
  afterEach(() => vi.useRealTimers())

  it('aplica OR dentro de enums y AND implícito entre categorías', () => {
    const where = buildPostgresWhere({
      status: ['OPEN', 'IN_PROGRESS'], priority: ['HIGH'], severity: ['MAJOR'],
      testSessionIds: ['session-1', 'session-2'], experienceTags: ['UX', 'UI'],
      incidenceTypes: ['DESIGN', 'FUNCTIONALITY'],
    })
    expect(where).toMatchObject({
      deletedAt: null,
      status: { in: ['OPEN', 'IN_PROGRESS'] }, priority: { in: ['HIGH'] }, severity: { in: ['MAJOR'] },
      testSessionId: { in: ['session-1', 'session-2'] },
      experienceTags: { some: { experienceTag: { in: ['UX', 'UI'] } } },
      incidenceTypes: { some: { incidenceType: { in: ['DESIGN', 'FUNCTIONALITY'] } } },
    })
  })

  it.each([
    ['created', 'createdAt'], ['updated', 'updatedAt'],
  ] as const)('filtra fecha %s', (dateType, field) => {
    const where = buildPostgresWhere({ dateType, dateFrom: '2026-08-01T00:00:00.000Z', dateTo: '2026-08-02T23:59:59.999Z' })
    expect(where[field]).toEqual({ gte: new Date('2026-08-01T00:00:00.000Z'), lte: new Date('2026-08-02T23:59:59.999Z') })
  })

  it('filtra fecha de sesión mediante TestSession.date', () => {
    expect(buildPostgresWhere({ dateType: 'session', dateFrom: '2026-08-01T00:00:00.000Z' })).toMatchObject({
      testSession: { date: { gte: new Date('2026-08-01T00:00:00.000Z') } },
    })
  })

  it('acepta rangos abiertos desde y hasta', () => {
    expect(buildPostgresWhere({ dateType: 'created', dateFrom: '2026-08-01T00:00:00.000Z' }).createdAt).toEqual({ gte: new Date('2026-08-01T00:00:00.000Z') })
    expect(buildPostgresWhere({ dateType: 'created', dateTo: '2026-08-02T23:59:59.999Z' }).createdAt).toEqual({ lte: new Date('2026-08-02T23:59:59.999Z') })
  })

  it('define recientes como 7 días por updatedAt', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'))
    const where = buildPostgresWhere({ recent: true })
    expect(where.AND).toContainEqual({ updatedAt: { gte: new Date('2026-08-12T12:00:00.000Z') } })
  })
})
