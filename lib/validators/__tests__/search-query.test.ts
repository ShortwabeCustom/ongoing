import { describe, expect, it } from 'vitest'
import { SearchQuerySchema } from '../search-query'

describe('SearchQuerySchema', () => {
  it('preserva OR como arrays dentro de cada categoría y categorías combinables', () => {
    const result = SearchQuerySchema.parse({
      status: 'OPEN,IN_PROGRESS', priority: 'HIGH', severity: 'MAJOR,BLOCKER',
      testSessionIds: 'session-a,session-b', experienceTags: 'UX,UI',
      incidenceTypes: 'DESIGN,FUNCTIONALITY', recent: 'true',
    })
    expect(result).toMatchObject({
      status: ['OPEN', 'IN_PROGRESS'], priority: ['HIGH'], severity: ['MAJOR', 'BLOCKER'],
      testSessionIds: ['session-a', 'session-b'], experienceTags: ['UX', 'UI'],
      incidenceTypes: ['DESIGN', 'FUNCTIONALITY'], recent: true,
    })
  })

  it('rechaza rangos invertidos', () => {
    expect(SearchQuerySchema.safeParse({ dateFrom: '2026-08-20T00:00:00.000Z', dateTo: '2026-08-19T23:59:59.999Z' }).success).toBe(false)
  })

  it('acepta un solo límite del rango', () => {
    expect(SearchQuerySchema.safeParse({ dateTo: '2026-08-19T23:59:59.999Z' }).success).toBe(true)
  })
})
