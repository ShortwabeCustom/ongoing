import { describe, it, expect } from 'vitest'

import { FindingCreateSchema, FindingUpdateSchema } from '@/lib/validators/finding'
import { FindingsQuerySchema } from '@/lib/validators/query'
import { SearchQuerySchema } from '@/lib/validators/search-query'

const baseCreate = { observation: 'Hallazgo de prueba', incidenceTypes: ['FUNCTIONALITY'] }

describe('campos ONGOING — FindingCreateSchema', () => {
  it('acepta Tipo, Canal, ID Jira, Modo y los tres Vobo.', () => {
    const parsed = FindingCreateSchema.parse({
      ...baseCreate,
      findingType: 'IMPROVEMENT',
      channel: 'BAZ',
      jiraId: 'CREODM-22636',
      interfaceMode: 'DARK',
      approvalInternal: true,
      approvalBusiness: false,
      approvalTech: null,
    })

    expect(parsed.findingType).toBe('IMPROVEMENT')
    expect(parsed.channel).toBe('BAZ')
    expect(parsed.jiraId).toBe('CREODM-22636')
    expect(parsed.interfaceMode).toBe('DARK')
    expect(parsed.approvalInternal).toBe(true)
    expect(parsed.approvalBusiness).toBe(false)
    expect(parsed.approvalTech).toBeNull()
  })

  it('son opcionales: no se inyecta ningún valor por defecto', () => {
    const parsed = FindingCreateSchema.parse(baseCreate)

    for (const key of ['findingType', 'channel', 'jiraId', 'interfaceMode', 'approvalInternal', 'approvalBusiness', 'approvalTech']) {
      expect(Object.prototype.hasOwnProperty.call(parsed, key)).toBe(false)
    }
  })

  it('rechaza un Tipo o Modo fuera del catálogo', () => {
    expect(FindingCreateSchema.safeParse({ ...baseCreate, findingType: 'BUG' }).success).toBe(false)
    expect(FindingCreateSchema.safeParse({ ...baseCreate, interfaceMode: 'AUTO' }).success).toBe(false)
  })

  it('rechaza Canal o ID Jira vacíos o demasiado largos', () => {
    expect(FindingCreateSchema.safeParse({ ...baseCreate, channel: '   ' }).success).toBe(false)
    expect(FindingCreateSchema.safeParse({ ...baseCreate, jiraId: 'X'.repeat(61) }).success).toBe(false)
  })
})

describe('campos ONGOING — FindingUpdateSchema (C-05)', () => {
  it('no toca los campos nuevos si el PATCH no los envía', () => {
    const parsed = FindingUpdateSchema.parse({ version: 2, priority: 'HIGH' })

    expect(Object.keys(parsed).sort()).toEqual(['priority', 'version'])
  })

  it('`null` explícito limpia el valor, y `false` se conserva (no se confunde con "sin dato")', () => {
    const parsed = FindingUpdateSchema.parse({
      version: 2,
      channel: null,
      findingType: null,
      approvalTech: false,
    })

    expect(parsed.channel).toBeNull()
    expect(parsed.findingType).toBeNull()
    expect(parsed.approvalTech).toBe(false)
  })
})

describe('campos ONGOING — filtros de consulta', () => {
  it('FindingsQuerySchema: findingType se normaliza a mayúsculas y channel acepta varios valores', () => {
    const parsed = FindingsQuerySchema.parse({ findingType: 'finding,improvement', channel: 'BAZ,Elektra' })

    expect(parsed.findingType).toEqual(['FINDING', 'IMPROVEMENT'])
    expect(parsed.channel).toEqual(['BAZ', 'Elektra'])
  })

  it('FindingsQuerySchema: rechaza un Tipo inválido', () => {
    expect(FindingsQuerySchema.safeParse({ findingType: 'BUG' }).success).toBe(false)
  })

  it('SearchQuerySchema: acepta Tipo, Canal y Categoría, y rechaza valores inválidos', () => {
    const parsed = SearchQuerySchema.parse({
      findingType: 'INCIDENT',
      channel: 'Shopinbaz',
      incidenceType: 'DESIGN,FUNCTIONALITY',
    })

    expect(parsed.findingType).toEqual(['INCIDENT'])
    expect(parsed.channel).toEqual(['Shopinbaz'])
    expect(parsed.incidenceType).toEqual(['DESIGN', 'FUNCTIONALITY'])
    expect(SearchQuerySchema.safeParse({ findingType: 'BUG' }).success).toBe(false)
    expect(SearchQuerySchema.safeParse({ incidenceType: 'OTHER' }).success).toBe(false)
  })
})
