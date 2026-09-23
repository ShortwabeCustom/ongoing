import { describe, expect, it } from 'vitest'
import { buildReportFacets, normalizeChannel, orderCategories } from '@/lib/services/report-facets'

describe('report facets', () => {
  it('cuenta cada valor tal cual, en el orden del catálogo, y omite los hallazgos sin dato', () => {
    const facets = buildReportFacets([
      { categories: ['COPY', 'DESIGN'], findingType: 'FINDING', channel: 'BAZ' },
      { categories: ['DESIGN'], findingType: 'IMPROVEMENT', channel: 'Elektra' },
      { categories: ['FUNCTIONALITY'], findingType: null, channel: null },
      { categories: [], findingType: 'FINDING', channel: 'BAZ' },
    ])

    expect(facets.categories).toEqual([
      { value: 'DESIGN', label: 'Diseño', count: 2 },
      { value: 'FUNCTIONALITY', label: 'Funcionalidad', count: 1 },
      { value: 'COPY', label: 'Copy', count: 1 },
    ])
    expect(facets.types).toEqual([
      { value: 'FINDING', label: 'Hallazgo', count: 2 },
      { value: 'IMPROVEMENT', label: 'Mejora', count: 1 },
    ])
    expect(facets.channels).toEqual([
      { value: 'BAZ', label: 'BAZ', count: 2 },
      { value: 'Elektra', label: 'Elektra', count: 1 },
    ])
  })

  it('no crea opciones para valores que no existen', () => {
    const facets = buildReportFacets([{ categories: [], findingType: null, channel: null }])

    expect(facets).toEqual({
      statuses: [],
      priorities: [],
      severities: [],
      categories: [],
      types: [],
      channels: [],
      assignment: [],
    })
  })

  it('canales fuera del catálogo se conservan tal cual, después de los conocidos', () => {
    const facets = buildReportFacets([
      { categories: [], findingType: null, channel: 'Zeta' },
      { categories: [], findingType: null, channel: 'Shopinbaz' },
      { categories: [], findingType: null, channel: 'Alfa' },
    ])

    expect(facets.channels.map((c) => c.value)).toEqual(['Shopinbaz', 'Alfa', 'Zeta'])
  })

  it('orderCategories ordena por catálogo, sin duplicados ni valores desconocidos', () => {
    expect(orderCategories(['COPY', 'DESIGN', 'COPY', 'NOPE', 'BUSINESS_RULE'])).toEqual([
      'DESIGN',
      'BUSINESS_RULE',
      'COPY',
    ])
  })

  it('normalizeChannel recorta y trata el vacío como sin dato', () => {
    expect(normalizeChannel('  BAZ ')).toBe('BAZ')
    expect(normalizeChannel('   ')).toBeNull()
    expect(normalizeChannel(null)).toBeNull()
  })

  it('ordena estado, prioridad y severidad, y cuenta la asignación sin exponer nombres', () => {
    const facets = buildReportFacets([
      {
        categories: [], findingType: null, channel: null, workflowStatus: 'CLOSED',
        priority: 'HIGH', severity: 'BLOCKER', assignmentState: 'assigned',
      },
      {
        categories: [], findingType: null, channel: null, workflowStatus: 'OPEN',
        priority: 'LOW', severity: 'MINOR', assignmentState: 'unassigned',
      },
    ])

    expect(facets.statuses.map((item) => item.value)).toEqual(['OPEN', 'CLOSED'])
    expect(facets.priorities.map((item) => item.value)).toEqual(['LOW', 'HIGH'])
    expect(facets.severities.map((item) => item.value)).toEqual(['MINOR', 'BLOCKER'])
    expect(facets.assignment.map((item) => item.label)).toEqual(['Con responsable', 'Sin responsable'])
  })
})
