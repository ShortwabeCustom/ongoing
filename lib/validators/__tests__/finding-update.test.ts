import { describe, it, expect } from 'vitest'

import {
  FindingCreateSchema,
  FindingUpdateSchema,
} from '@/lib/validators/finding'

/**
 * C-05 · Una actualización parcial corrompe datos silenciosamente.
 *
 * Invariante que estos tests fijan:
 *   clave ausente en la petición  ⇒  clave ausente en el resultado validado
 *   ⇒ clave ausente en el `data` de Prisma  ⇒ la BD conserva su valor anterior.
 *
 * El contrato de CREATE (con sus `.default()`) queda explícitamente fuera de
 * este cambio y se verifica aquí como red de seguridad anti-regresión.
 */

function keysOf(value: unknown) {
  return Object.keys(value as Record<string, unknown>).sort()
}

describe('FindingUpdateSchema — sin defaults heredados de CREATE (C-05)', () => {
  it('devuelve EXACTAMENTE las claves enviadas para {version, priority}', () => {
    const parsed = FindingUpdateSchema.parse({ version: 3, priority: 'HIGH' })

    expect(keysOf(parsed)).toEqual(['priority', 'version'])
    expect(parsed).toEqual({ version: 3, priority: 'HIGH' })
  })

  it('no inyecta `severity` cuando el cliente no la envía', () => {
    const parsed = FindingUpdateSchema.parse({ version: 3, priority: 'HIGH' })

    expect(Object.prototype.hasOwnProperty.call(parsed, 'severity')).toBe(false)
    expect(parsed.severity).toBeUndefined()
  })

  it('no inyecta `effort` cuando el cliente no lo envía', () => {
    const parsed = FindingUpdateSchema.parse({ version: 3, priority: 'HIGH' })

    expect(Object.prototype.hasOwnProperty.call(parsed, 'effort')).toBe(false)
    expect(parsed.effort).toBeUndefined()
  })

  it('no inyecta `priority` ni `effort` cuando sólo se envía `severity`', () => {
    const parsed = FindingUpdateSchema.parse({ version: 3, severity: 'BLOCKER' })

    expect(keysOf(parsed)).toEqual(['severity', 'version'])
  })

  it('no inyecta `priority` ni `severity` cuando sólo se envía `effort`', () => {
    const parsed = FindingUpdateSchema.parse({ version: 3, effort: 'XL' })

    expect(keysOf(parsed)).toEqual(['effort', 'version'])
  })

  it('no inyecta ningún campo de negocio cuando sólo se envía `version`', () => {
    const parsed = FindingUpdateSchema.parse({ version: 7 })

    expect(keysOf(parsed)).toEqual(['version'])
  })

  it('no inyecta defaults al actualizar un escalar no-enum (`observation`)', () => {
    const parsed = FindingUpdateSchema.parse({
      version: 3,
      observation: 'Observación actualizada por el auditor',
    })

    expect(keysOf(parsed)).toEqual(['observation', 'version'])
  })

  it('acepta null explícito en los campos nullable y lo conserva como null', () => {
    const nullableFields = [
      'folio',
      'assigneeId',
      'dueDate',
      'previousScreen',
      'currentScreen',
      'flowStep',
    ] as const

    for (const field of nullableFields) {
      const parsed = FindingUpdateSchema.parse({ version: 3, [field]: null }) as Record<
        string,
        unknown
      >

      expect(Object.prototype.hasOwnProperty.call(parsed, field), field).toBe(true)
      expect(parsed[field], field).toBeNull()
      expect(keysOf(parsed), field).toEqual([field, 'version'].sort())
    }
  })

  it('distingue omitir `assigneeId` de enviarlo como null explícito', () => {
    const omitted = FindingUpdateSchema.parse({ version: 3, priority: 'HIGH' })
    const cleared = FindingUpdateSchema.parse({ version: 3, assigneeId: null })

    expect(Object.prototype.hasOwnProperty.call(omitted, 'assigneeId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(cleared, 'assigneeId')).toBe(true)
    expect(cleared.assigneeId).toBeNull()
  })

  it('rechaza null en campos NO nullable (no convierte PATCH en borrado)', () => {
    for (const field of ['observation', 'priority', 'severity', 'effort', 'status', 'incidenceTypes']) {
      const result = FindingUpdateSchema.safeParse({ version: 3, [field]: null })
      expect(result.success, field).toBe(false)
    }
  })

  it('valida los campos presentes (opcional-pero-si-viene-debe-ser-válido)', () => {
    expect(FindingUpdateSchema.safeParse({ version: 3, priority: 'URGENTE' }).success).toBe(false)
    expect(FindingUpdateSchema.safeParse({ version: 3, observation: 'abc' }).success).toBe(false)
    expect(FindingUpdateSchema.safeParse({ version: 3, incidenceTypes: [] }).success).toBe(false)
    expect(FindingUpdateSchema.safeParse({ version: 3, effort: 'XXL' }).success).toBe(false)
    expect(FindingUpdateSchema.safeParse({ version: 0 }).success).toBe(false)
  })

  it('descarta claves desconocidas en vez de dejarlas pasar al servicio', () => {
    const parsed = FindingUpdateSchema.parse({
      version: 3,
      priority: 'HIGH',
      id: 'otro-id',
      projectId: 'otro-proyecto',
      createdBy: 'otro-usuario',
      version_: 99,
      deletedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(keysOf(parsed)).toEqual(['priority', 'version'])
  })

  it('no permite reasignar `testSessionId` desde el PATCH', () => {
    const parsed = FindingUpdateSchema.parse({ version: 3, testSessionId: 'cmsw-otra-sesion' })

    expect(Object.prototype.hasOwnProperty.call(parsed, 'testSessionId')).toBe(false)
  })

  it('acepta un PATCH completo sin alterar los valores enviados', () => {
    const payload = {
      version: 3,
      observation: 'Observación completa del hallazgo auditado',
      status: 'TRIAGED' as const,
      priority: 'CRITICAL' as const,
      severity: 'BLOCKER' as const,
      effort: 'XL' as const,
      incidenceTypes: ['DESIGN' as const],
      experienceTags: ['UI' as const],
      folio: 'F-001',
    }

    expect(FindingUpdateSchema.parse(payload)).toEqual(payload)
  })
})

describe('FindingCreateSchema — los defaults de CREATE NO cambian (anti-regresión)', () => {
  it('sigue aplicando los defaults MEDIUM / MINOR / M', () => {
    const parsed = FindingCreateSchema.parse({
      observation: 'Observación mínima válida',
      incidenceTypes: ['DESIGN'],
    })

    expect(parsed.priority).toBe('MEDIUM')
    expect(parsed.severity).toBe('MINOR')
    expect(parsed.effort).toBe('M')
  })

  it('sigue exigiendo `observation` e `incidenceTypes`', () => {
    expect(FindingCreateSchema.safeParse({}).success).toBe(false)
    expect(
      FindingCreateSchema.safeParse({ observation: 'Observación válida', incidenceTypes: [] }).success,
    ).toBe(false)
  })

  it('sigue aceptando `testSessionId` (que UPDATE no expone)', () => {
    const parsed = FindingCreateSchema.parse({
      observation: 'Observación mínima válida',
      incidenceTypes: ['DESIGN'],
      testSessionId: 'cmsw-sesion-1',
    })

    expect(parsed.testSessionId).toBe('cmsw-sesion-1')
  })
})
