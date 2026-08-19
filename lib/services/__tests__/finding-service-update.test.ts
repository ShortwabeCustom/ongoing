import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * C-05 · FindingService.updateFinding — construcción del `data` de Prisma.
 *
 * Verifica la invariante en la capa de servicio, aislada de la ruta y del
 * validador: sólo las claves realmente presentes (y no `undefined`) entran en
 * el `data`. Cubre en particular a los llamadores internos, que no pasan por
 * Zod y sí pueden construir objetos con `undefined` explícito.
 */

const serviceMocks = vi.hoisted(() => ({
  updateManyData: [] as Record<string, unknown>[],
  auditEntries: [] as Record<string, unknown>[],
  statusHistory: [] as Record<string, unknown>[],
}))

const FINDING_ID = 'cmswc3f5u0000to2sgyavp8xh'

const CURRENT = {
  id: FINDING_ID,
  projectId: 'proj-1',
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
  evidence: [],
  incidenceTypes: [],
  experienceTags: [],
}

const db = {
  finding: {
    findUnique: vi.fn(async () => ({ ...CURRENT })),
    updateMany: vi.fn(
      async ({ data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        serviceMocks.updateManyData.push(data)
        return { count: 1 }
      },
    ),
  },
  findingIncidenceType: { deleteMany: vi.fn(), createMany: vi.fn() },
  findingExperienceTag: { deleteMany: vi.fn(), createMany: vi.fn() },
  supportLink: { deleteMany: vi.fn(), createMany: vi.fn() },
  findingStatusHistory: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      serviceMocks.statusHistory.push(data)
      return data
    }),
  },
  auditLog: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      serviceMocks.auditEntries.push(data)
      return data
    }),
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
}

vi.mock('@/lib/db-lazy', () => ({ getDb: () => db }))

vi.mock('@/lib/services/search-service', () => ({
  SearchService: {
    indexFinding: vi.fn(),
    removeFromIndex: vi.fn(),
    bulkIndexFindings: vi.fn(),
  },
}))

import { FindingService } from '@/lib/services/finding-service'

function lastData() {
  return serviceMocks.updateManyData[serviceMocks.updateManyData.length - 1] ?? {}
}

describe('FindingService.updateFinding — claves presentes vs. omitidas (C-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.updateManyData = []
    serviceMocks.auditEntries = []
    serviceMocks.statusHistory = []
  })

  it('sólo escribe las claves recibidas más los metadatos de la actualización', async () => {
    await FindingService.updateFinding(FINDING_ID, { priority: 'HIGH' }, 3, 'user-1')

    expect(Object.keys(lastData()).sort()).toEqual(
      ['priority', 'updatedAt', 'updatedBy', 'version'].sort(),
    )
  })

  it('trata `undefined` explícito como omisión, no como borrado a null', async () => {
    await FindingService.updateFinding(
      FINDING_ID,
      {
        priority: 'HIGH',
        folio: undefined,
        flowStep: undefined,
        assigneeId: undefined,
        currentScreen: undefined,
        previousScreen: undefined,
        dueDate: undefined,
      },
      3,
      'user-1',
    )

    const data = lastData()
    for (const key of ['folio', 'flowStep', 'assigneeId', 'currentScreen', 'previousScreen', 'dueDate']) {
      expect(Object.prototype.hasOwnProperty.call(data, key), key).toBe(false)
    }
    expect(data.priority).toBe('HIGH')
  })

  it('no emite entrada ASSIGN por un `assigneeId: undefined` explícito', async () => {
    await FindingService.updateFinding(FINDING_ID, { assigneeId: undefined }, 3, 'user-1')

    expect(serviceMocks.auditEntries.filter((e) => e.action === 'ASSIGN')).toHaveLength(0)
  })

  it('`null` explícito sí limpia el campo nullable y emite ASSIGN', async () => {
    await FindingService.updateFinding(FINDING_ID, { assigneeId: null, folio: null }, 3, 'user-1')

    const data = lastData()
    expect(data.assigneeId).toBeNull()
    expect(data.folio).toBeNull()
    expect(serviceMocks.auditEntries.filter((e) => e.action === 'ASSIGN')).toHaveLength(1)
  })

  it('mantiene el incremento de versión y el bloqueo optimista por `where`', async () => {
    await FindingService.updateFinding(FINDING_ID, { priority: 'HIGH' }, 3, 'user-1')

    expect(lastData().version).toEqual({ increment: 1 })
    expect(db.finding.updateMany).toHaveBeenCalledTimes(1)
    const call = db.finding.updateMany.mock.calls[0][0]
    expect(call.where.version).toBe(3)
    expect(call.where.id).toBe(FINDING_ID)
    expect(call.where.deletedAt).toBeNull()
  })

  it('`transitionFinding` sigue escribiendo únicamente `status`', async () => {
    await FindingService.transitionFinding(
      FINDING_ID,
      { toStatus: 'TRIAGED', version: 3, reason: 'Triaje' },
      'user-1',
    )

    expect(Object.keys(lastData()).sort()).toEqual(
      ['status', 'updatedAt', 'updatedBy', 'version'].sort(),
    )
    expect(serviceMocks.statusHistory).toHaveLength(1)
  })

  it('permite completar directamente un hallazgo triado', async () => {
    db.finding.findUnique.mockResolvedValueOnce({ ...CURRENT, status: 'TRIAGED' })

    await FindingService.transitionFinding(
      FINDING_ID,
      { toStatus: 'CLOSED', version: 3, reason: 'Hallazgo completado' },
      'user-1',
    )

    expect(lastData().status).toBe('CLOSED')
    expect(serviceMocks.statusHistory.at(-1)).toMatchObject({
      fromStatus: 'TRIAGED',
      toStatus: 'CLOSED',
    })
  })

  it('propaga VERSION_MISMATCH sin escribir cuando la versión no coincide', async () => {
    db.finding.findUnique.mockResolvedValueOnce({ ...CURRENT, version: 9 })

    await expect(
      FindingService.updateFinding(FINDING_ID, { priority: 'HIGH' }, 3, 'user-1'),
    ).rejects.toThrow('VERSION_MISMATCH')

    expect(db.finding.updateMany).not.toHaveBeenCalled()
    expect(db.auditLog.create).not.toHaveBeenCalled()
  })
})
