import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * C-05 · PATCH parcial de un hallazgo.
 *
 * Recorre el camino real ruta → FindingUpdateSchema → FindingService.updateFinding
 * → objeto `data` de Prisma, sobre un doble de Prisma con estado que aplica los
 * cambios igual que lo haría PostgreSQL (incluida la semántica real de Prisma:
 * un valor `undefined` en `data` es un no-op, no un borrado).
 *
 * Línea base persistida en todos los tests:
 *   priority=MEDIUM  severity=MAJOR  effort=L  version=3
 */

const findingMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  indexFinding: vi.fn(),
  updateManyData: [] as Record<string, unknown>[],
  auditEntries: [] as Record<string, unknown>[],
  statusHistory: [] as Record<string, unknown>[],
  row: {} as Record<string, unknown>,
}))

const BASELINE = {
  id: 'cmswc3f5u0000to2sgyavp8xh',
  projectId: 'proj-1',
  testSessionId: 'sess-1',
  folio: 'F-042',
  observation: 'Observación original del hallazgo auditado',
  status: 'OPEN',
  priority: 'MEDIUM',
  severity: 'MAJOR',
  effort: 'L',
  previousScreen: 'Pantalla previa',
  currentScreen: 'Pantalla actual',
  flowStep: 'Paso 2',
  assigneeId: 'user-assignee-1',
  dueDate: null,
  version: 3,
  deletedAt: null,
  createdBy: 'user-1',
  updatedBy: null,
  createdAt: new Date('2026-08-16T00:00:00.000Z'),
  updatedAt: new Date('2026-08-16T10:00:00.000Z'),
}

function resetRow() {
  findingMocks.row = { ...BASELINE }
  findingMocks.updateManyData = []
  findingMocks.auditEntries = []
  findingMocks.statusHistory = []
}

/** Aplica `data` igual que Prisma: `{increment}` suma, `undefined` es no-op. */
function applyPrismaData(row: Record<string, unknown>, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue
    if (value && typeof value === 'object' && 'increment' in (value as object)) {
      row[key] = (row[key] as number) + (value as { increment: number }).increment
      continue
    }
    row[key] = value
  }
}

const relations = {
  incidenceTypes: [{ findingId: BASELINE.id, incidenceType: 'DESIGN' }],
  experienceTags: [{ findingId: BASELINE.id, experienceTag: 'UI' }],
  supportLinks: [] as unknown[],
  evidence: [] as unknown[],
}

function fakeDb() {
  const finding = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      if (where.id !== BASELINE.id) return null
      return { ...findingMocks.row, ...relations }
    }),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string; version?: number; deletedAt?: unknown }
        data: Record<string, unknown>
      }) => {
        findingMocks.updateManyData.push(data)
        const row = findingMocks.row
        if (where.id !== row.id) return { count: 0 }
        if (where.version !== undefined && where.version !== row.version) return { count: 0 }
        if (row.deletedAt !== null) return { count: 0 }
        applyPrismaData(row, data)
        return { count: 1 }
      },
    ),
  }

  const noopCollection = {
    deleteMany: vi.fn(async () => ({ count: 0 })),
    createMany: vi.fn(async () => ({ count: 0 })),
    create: vi.fn(async () => ({})),
  }

  return {
    finding,
    findingIncidenceType: { ...noopCollection },
    findingExperienceTag: { ...noopCollection },
    supportLink: { ...noopCollection },
    findingStatusHistory: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        findingMocks.statusHistory.push(data)
        return data
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        findingMocks.auditEntries.push(data)
        return data
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  }
}

let db = fakeDb()

vi.mock('@/lib/auth/lucia', () => ({
  getSession: findingMocks.getSession,
}))

vi.mock('@/lib/db-lazy', () => ({
  getDb: () => db,
}))

vi.mock('@/lib/services/search-service', () => ({
  SearchService: {
    indexFinding: findingMocks.indexFinding,
    removeFromIndex: vi.fn(),
    bulkIndexFindings: vi.fn(),
  },
}))

import { PATCH } from '../route'

const params = Promise.resolve({ id: BASELINE.id })

function makeRequest(body: unknown) {
  return new NextRequest(`http://127.0.0.1:3000/api/findings/${BASELINE.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function patch(body: unknown) {
  const response = await PATCH(makeRequest(body), { params })
  if (!response) throw new Error('PATCH no devolvió respuesta')
  return response
}

/** Último `data` entregado a `finding.updateMany` (el objeto que ve Prisma). */
function lastPrismaData() {
  return findingMocks.updateManyData[findingMocks.updateManyData.length - 1] ?? {}
}

function lastUpdateAudit() {
  return [...findingMocks.auditEntries].reverse().find((entry) => entry.action === 'UPDATE')
}

describe('PATCH /api/findings/[id] — actualización parcial (C-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db = fakeDb()
    resetRow()
    findingMocks.getSession.mockResolvedValue({
      session: { id: 'sess-1' },
      user: { id: 'user-1', email: 'owner@audit.local', name: 'Owner', role: 'OWNER' },
    })
  })

  it('1· PATCH sólo de `priority` deja `severity` y `effort` intactos', async () => {
    const response = await patch({ version: 3, priority: 'HIGH' })

    expect(response.status).toBe(200)
    expect(findingMocks.row.priority).toBe('HIGH')
    expect(findingMocks.row.severity).toBe('MAJOR')
    expect(findingMocks.row.effort).toBe('L')
    expect(findingMocks.row.version).toBe(4)
  })

  it('1b· el `data` de Prisma no contiene las claves omitidas', async () => {
    await patch({ version: 3, priority: 'HIGH' })

    const data = lastPrismaData()
    expect(Object.prototype.hasOwnProperty.call(data, 'priority')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(data, 'severity')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(data, 'effort')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(data, 'observation')).toBe(false)
    expect(Object.keys(data).sort()).toEqual(
      ['priority', 'updatedAt', 'updatedBy', 'version'].sort(),
    )
  })

  it('2· PATCH sólo de `severity` deja `priority` y `effort` intactos', async () => {
    const response = await patch({ version: 3, severity: 'BLOCKER' })

    expect(response.status).toBe(200)
    expect(findingMocks.row.severity).toBe('BLOCKER')
    expect(findingMocks.row.priority).toBe('MEDIUM')
    expect(findingMocks.row.effort).toBe('L')
    expect(findingMocks.row.version).toBe(4)
  })

  it('3· PATCH sólo de `effort` deja `priority` y `severity` intactos', async () => {
    const response = await patch({ version: 3, effort: 'XL' })

    expect(response.status).toBe(200)
    expect(findingMocks.row.effort).toBe('XL')
    expect(findingMocks.row.priority).toBe('MEDIUM')
    expect(findingMocks.row.severity).toBe('MAJOR')
    expect(findingMocks.row.version).toBe(4)
  })

  it('4· PATCH de otro escalar editable (`observation`) no toca los omitidos', async () => {
    const response = await patch({
      version: 3,
      observation: 'Observación corregida durante la auditoría P0-C',
    })

    expect(response.status).toBe(200)
    expect(findingMocks.row.observation).toBe('Observación corregida durante la auditoría P0-C')
    expect(findingMocks.row.priority).toBe('MEDIUM')
    expect(findingMocks.row.severity).toBe('MAJOR')
    expect(findingMocks.row.effort).toBe('L')
    expect(findingMocks.row.folio).toBe('F-042')
    expect(findingMocks.row.flowStep).toBe('Paso 2')
    expect(findingMocks.row.assigneeId).toBe('user-assignee-1')
  })

  it('5· PATCH con sólo `version` no cambia ningún campo de negocio', async () => {
    const response = await patch({ version: 3 })

    expect(response.status).toBe(200)

    const data = lastPrismaData()
    expect(Object.keys(data).sort()).toEqual(['updatedAt', 'updatedBy', 'version'].sort())

    expect(findingMocks.row.priority).toBe('MEDIUM')
    expect(findingMocks.row.severity).toBe('MAJOR')
    expect(findingMocks.row.effort).toBe('L')
    expect(findingMocks.row.observation).toBe(BASELINE.observation)
    expect(findingMocks.row.folio).toBe('F-042')
    expect(findingMocks.row.status).toBe('OPEN')
    expect(findingMocks.row.assigneeId).toBe('user-assignee-1')
    expect(findingMocks.row.version).toBe(4)
  })

  it('6· forma general: todo campo omitido conserva su valor previo', async () => {
    await patch({ version: 3, priority: 'CRITICAL' })

    const untouched = [
      'observation',
      'status',
      'severity',
      'effort',
      'folio',
      'previousScreen',
      'currentScreen',
      'flowStep',
      'assigneeId',
      'dueDate',
      'createdAt',
      'createdBy',
    ] as const

    for (const field of untouched) {
      expect(findingMocks.row[field], field).toEqual(BASELINE[field])
    }
    expect(findingMocks.row.priority).toBe('CRITICAL')
  })

  it('7· `assigneeId: null` explícito desasigna; omitirlo conserva el responsable', async () => {
    const cleared = await patch({ version: 3, assigneeId: null })

    expect(cleared.status).toBe(200)
    expect(findingMocks.row.assigneeId).toBeNull()
    expect(findingMocks.row.severity).toBe('MAJOR')
    expect(findingMocks.row.effort).toBe('L')

    resetRow()
    const omitted = await patch({ version: 3, priority: 'HIGH' })

    expect(omitted.status).toBe(200)
    expect(findingMocks.row.assigneeId).toBe('user-assignee-1')
    expect(Object.prototype.hasOwnProperty.call(lastPrismaData(), 'assigneeId')).toBe(false)
  })

  it('7b· `flowStep: null` explícito limpia el campo', async () => {
    const response = await patch({ version: 3, flowStep: null })

    expect(response.status).toBe(200)
    expect(findingMocks.row.flowStep).toBeNull()
    expect(findingMocks.row.currentScreen).toBe('Pantalla actual')
    expect(findingMocks.row.previousScreen).toBe('Pantalla previa')
  })

  it('8· payload inválido → 400 y CERO mutaciones', async () => {
    const response = await patch({ version: 3, priority: 'URGENTISIMA' })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe('VALIDATION_ERROR')

    expect(db.finding.updateMany).not.toHaveBeenCalled()
    expect(db.auditLog.create).not.toHaveBeenCalled()
    expect(findingMocks.row).toEqual({ ...BASELINE })
  })

  it('9· `version` obsoleta → 409 VERSION_MISMATCH y CERO mutaciones', async () => {
    const response = await patch({ version: 2, priority: 'HIGH' })

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.code).toBe('VERSION_MISMATCH')

    expect(db.auditLog.create).not.toHaveBeenCalled()
    expect(findingMocks.row).toEqual({ ...BASELINE })
  })

  it('10· claves desconocidas no llegan nunca al `data` de Prisma', async () => {
    const response = await patch({
      version: 3,
      priority: 'HIGH',
      id: 'otro-id',
      projectId: 'otro-proyecto',
      createdBy: 'atacante',
      deletedAt: '2026-01-01T00:00:00.000Z',
      testSessionId: 'otra-sesion',
    })

    expect(response.status).toBe(200)

    const data = lastPrismaData()
    for (const key of ['id', 'projectId', 'createdBy', 'deletedAt', 'testSessionId']) {
      expect(Object.prototype.hasOwnProperty.call(data, key), key).toBe(false)
    }

    expect(findingMocks.row.id).toBe(BASELINE.id)
    expect(findingMocks.row.projectId).toBe('proj-1')
    expect(findingMocks.row.createdBy).toBe('user-1')
    expect(findingMocks.row.deletedAt).toBeNull()
    expect(findingMocks.row.testSessionId).toBe('sess-1')
  })

  it('11· la versión se incrementa exactamente en 1 (sin doble escritura)', async () => {
    await patch({ version: 3, priority: 'HIGH' })

    expect(db.finding.updateMany).toHaveBeenCalledTimes(1)
    expect(findingMocks.row.version).toBe(4)
    expect(lastPrismaData().version).toEqual({ increment: 1 })
  })
})

describe('AuditLog de un PATCH parcial (C-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db = fakeDb()
    resetRow()
    findingMocks.getSession.mockResolvedValue({
      session: { id: 'sess-1' },
      user: { id: 'user-1', email: 'owner@audit.local', name: 'Owner', role: 'OWNER' },
    })
  })

  it('el diff refleja sólo `priority` como cambiado', async () => {
    await patch({ version: 3, priority: 'HIGH' })

    const entry = lastUpdateAudit()
    expect(entry).toBeDefined()

    const before = entry!.before as Record<string, unknown>
    const after = entry!.after as Record<string, unknown>

    expect(before.priority).toBe('MEDIUM')
    expect(after.priority).toBe('HIGH')

    const changed = Object.keys(after).filter(
      (key) => JSON.stringify(after[key]) !== JSON.stringify(before[key]),
    )

    expect(changed).not.toContain('severity')
    expect(changed).not.toContain('effort')
    expect(changed).toContain('priority')
  })

  it('`severity` y `effort` aparecen idénticos en before/after', async () => {
    await patch({ version: 3, priority: 'HIGH' })

    const entry = lastUpdateAudit()!
    const before = entry.before as Record<string, unknown>
    const after = entry.after as Record<string, unknown>

    expect(before.severity).toBe('MAJOR')
    expect(after.severity).toBe('MAJOR')
    expect(before.effort).toBe('L')
    expect(after.effort).toBe('L')
  })

  it('no se emite entrada ASSIGN cuando `assigneeId` no viene en el payload', async () => {
    await patch({ version: 3, priority: 'HIGH' })

    const assigns = findingMocks.auditEntries.filter((entry) => entry.action === 'ASSIGN')
    expect(assigns).toHaveLength(0)
  })

  it('sí se emite entrada ASSIGN cuando `assigneeId: null` viene explícito', async () => {
    await patch({ version: 3, assigneeId: null })

    const assigns = findingMocks.auditEntries.filter((entry) => entry.action === 'ASSIGN')
    expect(assigns).toHaveLength(1)
    expect((assigns[0].after as Record<string, unknown>).assigneeId).toBeNull()
  })

  it('no se emite STATUS_CHANGE cuando `status` no viene en el payload', async () => {
    await patch({ version: 3, priority: 'HIGH' })

    const statusChanges = findingMocks.auditEntries.filter(
      (entry) => entry.action === 'STATUS_CHANGE',
    )
    expect(statusChanges).toHaveLength(0)
    expect(findingMocks.statusHistory).toHaveLength(0)
  })
})
