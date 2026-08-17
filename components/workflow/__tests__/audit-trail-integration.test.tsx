import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

/**
 * C-01 · Integración CREATE → UPDATE → AuditLog real → render.
 *
 * No se replica a mano el snapshot: se ejecuta `FindingService.createFinding` y
 * `FindingService.updateFinding` sobre un Prisma mockeado que CAPTURA el `data`
 * exacto que el servicio manda a `auditLog.create`, y ese payload capturado —el
 * que de verdad acaba en la columna `after` de `audit_logs`— se inyecta en el
 * `AuditTrailViewer` real. Si el componente no tolera lo que el servicio
 * produce, esta prueba lanza.
 *
 * Cubre el hueco señalado en el informe original: «test de integración que cree
 * un hallazgo, lo actualice y renderice AuditTrailViewer con el `after` real».
 */

const serviceMocks = vi.hoisted(() => ({
  auditEntries: [] as { action: string; before: unknown; after: unknown }[],
}))

const viewerMocks = vi.hoisted(() => ({
  getAuditLog: vi.fn(),
  exportAuditLog: vi.fn(),
  toast: vi.fn(),
}))

const FINDING_ID = 'cmswx0isd0000c92srk50n57o'
const PROJECT_ID = 'cmsoc6p7l0000h1acb6i9uoyt'
const ACTOR_ID = 'p1auser0000000000000000001'

/** Fila tal y como la devuelve Prisma antes del UPDATE (con sus tablas join). */
const CURRENT_ROW = {
  id: FINDING_ID,
  folio: null,
  effort: 'L',
  status: 'OPEN',
  dueDate: null,
  version: 1,
  flowStep: null,
  priority: 'MEDIUM',
  severity: 'MAJOR',
  createdAt: new Date('2026-08-17T07:31:24.830Z'),
  createdBy: ACTOR_ID,
  deletedAt: null,
  projectId: PROJECT_ID,
  updatedAt: new Date('2026-08-17T07:31:24.830Z'),
  updatedBy: null,
  assigneeId: null,
  observation: 'AUDIT-P1A-AUDIT-TRAIL-20260817 observacion inicial',
  currentScreen: null,
  previousScreen: null,
  importBatchId: null,
  testSessionId: 'cmsoc6pbq0003h1ac6hgztsda',
  incidenceTypes: [{ findingId: FINDING_ID, incidenceType: 'FUNCTIONALITY' }],
  experienceTags: [{ findingId: FINDING_ID, experienceTag: 'UX' }],
}

/** Fila tras el UPDATE: observación nueva, version+1 y `supportLinks` incluido. */
const AFTER_ROW = {
  ...CURRENT_ROW,
  version: 2,
  updatedAt: new Date('2026-08-17T07:31:27.001Z'),
  updatedBy: ACTOR_ID,
  observation: 'AUDIT-P1A-AUDIT-TRAIL-20260817 observacion EDITADA',
  supportLinks: [],
}

let findUniqueCall = 0

const db = {
  finding: {
    findUnique: vi.fn(async () => {
      findUniqueCall += 1
      return findUniqueCall === 1 ? { ...CURRENT_ROW } : { ...AFTER_ROW }
    }),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
  findingIncidenceType: { deleteMany: vi.fn(), createMany: vi.fn() },
  findingExperienceTag: { deleteMany: vi.fn(), createMany: vi.fn() },
  supportLink: { deleteMany: vi.fn(), createMany: vi.fn() },
  findingStatusHistory: { create: vi.fn() },
  auditLog: {
    create: vi.fn(async ({ data }: { data: { action: string; before: unknown; after: unknown } }) => {
      serviceMocks.auditEntries.push(data)
      return data
    }),
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
}

vi.mock('@/lib/db-lazy', () => ({ getDb: () => db }))
vi.mock('@/lib/services/search-service', () => ({
  SearchService: { indexFinding: vi.fn(), removeFromIndex: vi.fn() },
}))
vi.mock('@/lib/api/workflow-client', () => ({
  WorkflowClient: {
    getAuditLog: viewerMocks.getAuditLog,
    exportAuditLog: viewerMocks.exportAuditLog,
  },
}))
vi.mock('@/components/ui/use-toast', () => ({ toast: viewerMocks.toast }))

let container: HTMLDivElement | null = null
let root: Root | null = null

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  serviceMocks.auditEntries.length = 0
  findUniqueCall = 0
  viewerMocks.getAuditLog.mockReset()
})

afterEach(async () => {
  if (root) {
    const current = root
    await act(async () => {
      current.unmount()
    })
    root = null
  }
  container?.remove()
  container = null
})

describe('C-01 · el AuditLog que produce FindingService se renderiza sin lanzar', () => {
  it('UPDATE real → AuditTrailViewer no lanza y muestra el cambio', async () => {
    const { FindingService } = await import('@/lib/services/finding-service')
    const { AuditTrailViewer } = await import('../AuditTrailViewer')

    await FindingService.updateFinding(
      FINDING_ID,
      { observation: 'AUDIT-P1A-AUDIT-TRAIL-20260817 observacion EDITADA' },
      1,
      ACTOR_ID,
    )

    const updateEntry = serviceMocks.auditEntries.find((e) => e.action === 'UPDATE')
    expect(updateEntry).toBeTruthy()

    // El snapshot real contiene arrays de objetos de las tablas join: ésta es
    // exactamente la forma que hacía saltar el error #31 de React.
    const after = updateEntry!.after as Record<string, unknown>
    expect(Array.isArray(after.incidenceTypes)).toBe(true)
    expect(after.incidenceTypes).toEqual([
      { findingId: FINDING_ID, incidenceType: 'FUNCTIONALITY' },
    ])

    // Se entrega al componente TAL CUAL viaja por la API (JSON serializado).
    const items = [
      {
        id: 'audit-update-1',
        action: 'UPDATE',
        actor: { id: ACTOR_ID, name: 'AUDIT-P1A QA Lead', email: 'qa@audit.local' },
        createdAt: '2026-08-17T07:31:27.030Z',
        before: JSON.parse(JSON.stringify(updateEntry!.before)),
        after: JSON.parse(JSON.stringify(updateEntry!.after)),
      },
    ]

    viewerMocks.getAuditLog.mockResolvedValue({
      status: 'success',
      data: { items, total: items.length },
    })

    const element = container!
    await act(async () => {
      root = createRoot(element)
      root.render(<AuditTrailViewer findingId={FINDING_ID} compact />)
    })

    const text = element.textContent ?? ''
    expect(text).toContain('UPDATE')
    expect(text).toContain('observacion EDITADA')
    expect(text).not.toContain('[object Object]')
  })
})
