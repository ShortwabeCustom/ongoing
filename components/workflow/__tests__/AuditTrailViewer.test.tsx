import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AuditTrailViewer } from '../AuditTrailViewer'

/**
 * C-01 · AuditTrailViewer — renderizado del diff de auditoría.
 *
 * El defecto original insertaba `log.before[key]` y `log.after[key]` directamente
 * como hijos de React (`{key}: {before} → {value}`). Cuando el snapshot de
 * `UPDATE` contenía un campo con valor objeto/array —lo normal, porque
 * `toAuditJson(current)` vuelca la fila entera con sus tablas join—, React
 * lanzaba el error #31 y derribaba TODO el detalle del hallazgo, no sólo la
 * tarjeta de auditoría.
 *
 * Estas pruebas montan el componente REAL con `createRoot` + `act` sobre el
 * jsdom que ya usa la suite. No se usa @testing-library: falta su peer
 * `@testing-library/dom` (deuda preexistente, familia B-03) y no se añade
 * ninguna dependencia nueva para esto.
 *
 * Los payloads son los capturados de una fila `audit_logs` REAL, producida por
 * `FindingService.updateFinding` en un clúster PostgreSQL aislado restaurado
 * desde el backup P0-A (hallazgo `cmswx0isd0000c92srk50n57o`).
 */

const mocks = vi.hoisted(() => ({
  getAuditLog: vi.fn(),
  exportAuditLog: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('@/lib/api/workflow-client', () => ({
  WorkflowClient: {
    getAuditLog: mocks.getAuditLog,
    exportAuditLog: mocks.exportAuditLog,
  },
}))

vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }))

const FINDING_ID = 'cmswx0isd0000c92srk50n57o'
const ACTOR = { id: 'p1auser0000000000000000001', name: 'AUDIT-P1A QA Lead', email: 'qa@audit.local' }

/** Snapshot `before` real de la entrada UPDATE (fila entera + tablas join). */
const REAL_BEFORE = {
  id: FINDING_ID,
  folio: null,
  effort: 'L',
  status: 'OPEN',
  dueDate: null,
  version: 1,
  flowStep: null,
  priority: 'MEDIUM',
  severity: 'MAJOR',
  createdAt: '2026-08-17T07:31:24.830Z',
  createdBy: 'p1auser0000000000000000001',
  deletedAt: null,
  projectId: 'cmsoc6p7l0000h1acb6i9uoyt',
  sourceRow: null,
  updatedAt: '2026-08-17T07:31:24.830Z',
  updatedBy: null,
  assigneeId: null,
  observation: 'AUDIT-P1A-AUDIT-TRAIL-20260817 observacion inicial',
  sourceSheet: null,
  currentScreen: null,
  importBatchId: null,
  testSessionId: 'cmsoc6pbq0003h1ac6hgztsda',
  experienceTags: [{ findingId: FINDING_ID, experienceTag: 'UX' }],
  incidenceTypes: [{ findingId: FINDING_ID, incidenceType: 'FUNCTIONALITY' }],
  previousScreen: null,
  sourceFingerprint: null,
}

/** Snapshot `after` real: observación cambiada, version+1 y `supportLinks` presente. */
const REAL_AFTER = {
  ...REAL_BEFORE,
  version: 2,
  updatedAt: '2026-08-17T07:31:27.001Z',
  updatedBy: 'p1auser0000000000000000001',
  observation: 'AUDIT-P1A-AUDIT-TRAIL-20260817 observacion EDITADA',
  supportLinks: [],
}

function logEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cmswx0khi0003c92s9a2aborc',
    action: 'UPDATE',
    actor: ACTOR,
    createdAt: '2026-08-17T07:31:27.030Z',
    before: REAL_BEFORE,
    after: REAL_AFTER,
    ...overrides,
  }
}

let container: HTMLDivElement | null = null
let root: Root | null = null

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  mocks.getAuditLog.mockReset()
  mocks.toast.mockReset()
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

/**
 * Monta el componente real y espera al `useEffect` que carga la auditoría.
 * Devuelve el texto renderizado. Si React lanza (error #31), lanza aquí.
 */
async function renderViewer(items: unknown[]) {
  mocks.getAuditLog.mockResolvedValue({
    status: 'success',
    data: { items, total: items.length },
  })

  const element = container!
  await act(async () => {
    root = createRoot(element)
    root.render(<AuditTrailViewer findingId={FINDING_ID} compact />)
  })

  return element.textContent ?? ''
}

describe('AuditTrailViewer · valores no escalares en el diff (C-01)', () => {
  it('NO lanza con el `after.incidenceTypes` real (array de objetos de la tabla join)', async () => {
    const text = await renderViewer([logEntry()])
    expect(text).toContain('UPDATE')
  })

  it('renderiza `incidenceTypes` de forma legible, sin "[object Object]" ni el findingId repetido', async () => {
    const text = await renderViewer([
      logEntry({
        before: { ...REAL_BEFORE, incidenceTypes: [{ findingId: FINDING_ID, incidenceType: 'DESIGN' }] },
        after: { ...REAL_AFTER, incidenceTypes: [{ findingId: FINDING_ID, incidenceType: 'FUNCTIONALITY' }] },
      }),
    ])

    expect(text).not.toContain('[object Object]')
    expect(text).toContain('DESIGN')
    expect(text).toContain('FUNCTIONALITY')
    expect(text).not.toContain(FINDING_ID)
  })

  it('caso crítico del encargo: after.incidenceTypes = [{findingId, incidenceType:"DESIGN"}] no rompe', async () => {
    const text = await renderViewer([
      logEntry({
        before: { observation: 'previa', incidenceTypes: [] },
        after: {
          observation: 'previa',
          incidenceTypes: [{ findingId: FINDING_ID, incidenceType: 'DESIGN' }],
        },
      }),
    ])

    expect(text).toContain('DESIGN')
    expect(text).not.toContain('[object Object]')
  })

  it('renderiza `supportLinks` con su forma real (array de objetos)', async () => {
    const text = await renderViewer([
      logEntry({
        before: { supportLinks: [] },
        after: {
          supportLinks: [
            {
              id: 'lnk1',
              title: 'Especificación',
              url: 'https://example.com/spec',
              createdAt: '2026-08-17T07:31:27.001Z',
              updatedAt: '2026-08-17T07:31:27.001Z',
            },
          ],
        },
      }),
    ])

    expect(text).not.toContain('[object Object]')
    expect(text).toContain('https://example.com/spec')
  })

  it('tolera la asimetría conocida de `supportLinks` (ausente en before, presente en after)', async () => {
    // Hallazgo separado ya documentado en §14.7/§15.7 — NO se corrige aquí,
    // pero el visor no debe romperse por ello.
    const text = await renderViewer([
      logEntry({ before: REAL_BEFORE, after: REAL_AFTER }),
    ])
    expect(text).toContain('supportLinks')
  })

  it('soporta valores null sin romper', async () => {
    const text = await renderViewer([
      logEntry({
        before: { assigneeId: 'user-1', folio: 'F-1' },
        after: { assigneeId: null, folio: null },
      }),
    ])
    expect(text).toContain('assigneeId')
    expect(text).not.toContain('[object Object]')
  })

  it('soporta array de strings, número, booleano y objeto anidado', async () => {
    const text = await renderViewer([
      logEntry({
        before: { tags: ['a', 'b'], version: 1, activo: false, meta: { k: 1 } },
        after: { tags: ['a', 'c'], version: 2, activo: true, meta: { k: 2, n: { z: 3 } } },
      }),
    ])
    expect(text).not.toContain('[object Object]')
    expect(text).toContain('version')
    expect(text).toContain('2')
  })

  it('no pierde información: un humano distingue el valor anterior del nuevo', async () => {
    const text = await renderViewer([
      logEntry({
        before: { observation: 'texto ANTERIOR' },
        after: { observation: 'texto NUEVO' },
      }),
    ])
    expect(text).toContain('texto ANTERIOR')
    expect(text).toContain('texto NUEVO')
  })

  it('no lista como cambiados los campos cuyo valor no cambió', async () => {
    const text = await renderViewer([
      logEntry({
        before: { observation: 'igual', incidenceTypes: [{ findingId: FINDING_ID, incidenceType: 'DESIGN' }] },
        after: { observation: 'igual', incidenceTypes: [{ findingId: FINDING_ID, incidenceType: 'DESIGN' }] },
      }),
    ])
    expect(text).not.toContain('observation')
    expect(text).not.toContain('incidenceTypes')
  })
})

describe('AuditTrailViewer · historial completo y casos límite (C-01, regresión)', () => {
  it('hallazgo sin ninguna entrada de auditoría', async () => {
    const text = await renderViewer([])
    expect(text).toContain('Sin historial de auditoría')
  })

  it('sólo CREATE (before = null) — el caso que hoy sí funciona, no debe regresar', async () => {
    const text = await renderViewer([
      logEntry({ id: 'c1', action: 'CREATE', before: null, after: REAL_AFTER }),
    ])
    expect(text).toContain('CREATE')
  })

  it('una única entrada UPDATE', async () => {
    const text = await renderViewer([logEntry()])
    expect(text).toContain('UPDATE')
  })

  it('varias entradas UPDATE', async () => {
    const text = await renderViewer([
      logEntry({ id: 'u1' }),
      logEntry({ id: 'u2', after: { ...REAL_AFTER, version: 3, priority: 'HIGH' } }),
      logEntry({ id: 'u3', after: { ...REAL_AFTER, version: 4, severity: 'BLOCKER' } }),
    ])
    expect(text).toContain('UPDATE')
    expect(text).not.toContain('[object Object]')
  })

  it('historial completo CREATE + UPDATE + STATUS_CHANGE', async () => {
    const text = await renderViewer([
      logEntry({ id: 'c1', action: 'CREATE', before: null, after: REAL_AFTER }),
      logEntry({ id: 'u1', action: 'UPDATE' }),
      logEntry({
        id: 's1',
        action: 'STATUS_CHANGE',
        before: { status: 'OPEN', version: 2 },
        after: { status: 'TRIAGED', version: 3, reason: 'triaje inicial' },
      }),
    ])
    expect(text).toContain('CREATE')
    expect(text).toContain('UPDATE')
    expect(text).toContain('STATUS_CHANGE')
    expect(text).toContain('TRIAGED')
  })

  it('forma desconocida/futura en before/after no rompe React', async () => {
    const text = await renderViewer([
      logEntry({
        before: { campoFuturo: { a: [1, { b: 2 }], c: null } },
        after: {
          campoFuturo: { a: [9, { b: 8, deep: { deeper: ['x', { y: 'z' }] } }], c: 'algo' },
          otroCampoNuevo: [[1, 2], [3, 4]],
        },
      }),
    ])
    expect(text).toContain('campoFuturo')
    expect(text).not.toContain('[object Object]')
  })
})
