import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { AuditTrailViewer } from '../AuditTrailViewer'

/**
 * C-01 · Aislamiento del fallo: el límite de error contiene la tarjeta.
 *
 * `lib/utils/audit-format.ts` cierra la causa CONOCIDA de C-01, pero el defecto
 * de fondo era estructural: el repositorio sólo tenía límites de error a nivel
 * de segmento de ruta (`app/findings/[id]/error.tsx`), así que CUALQUIER
 * excepción de render del visor de auditoría derribaba el detalle entero y
 * dejaba el hallazgo permanentemente inaccesible.
 *
 * Estas pruebas montan una réplica reducida del árbol de
 * `app/findings/[id]/page.tsx` —secciones hermanas + el visor envuelto en
 * `ErrorBoundary`— y verifican que, ante un fallo de render de la auditoría,
 * degrada SÓLO esa tarjeta y las secciones hermanas siguen montadas.
 *
 * Se cubren las dos vías por las que el visor puede lanzar:
 *   1. Un payload hostil de verdad, con un getter que lanza al ser leído — el
 *      formateador real no puede protegerse de eso (la excepción ocurre al
 *      acceder a la propiedad, antes de que haya un valor que formatear).
 *   2. Un fallo simulado del propio formateador, que representa cualquier
 *      regresión futura dentro de `audit-format.ts`.
 */

const mocks = vi.hoisted(() => ({
  getAuditLog: vi.fn(),
  exportAuditLog: vi.fn(),
  toast: vi.fn(),
  formatterShouldThrow: { value: false },
}))

vi.mock('@/lib/api/workflow-client', () => ({
  WorkflowClient: {
    getAuditLog: mocks.getAuditLog,
    exportAuditLog: mocks.exportAuditLog,
  },
}))

vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }))

vi.mock('@/lib/utils/audit-format', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/audit-format')>()
  return {
    ...actual,
    getAuditChanges: (before: unknown, after: unknown) => {
      if (mocks.formatterShouldThrow.value) {
        throw new Error('fallo simulado del formateador de auditoría')
      }
      return actual.getAuditChanges(before, after)
    },
  }
})

const FINDING_ID = 'cmswx0isd0000c92srk50n57o'
const ACTOR = { id: 'p1auser0000000000000000001', name: 'AUDIT-P1A QA Lead', email: 'qa@audit.local' }

const FALLBACK_MESSAGE =
  'No pudimos mostrar el historial de auditoría de este hallazgo. El resto del detalle sigue disponible.'

/** Texto que sólo existe en las secciones hermanas del detalle. */
const SIBLING_MARKERS = [
  'Observación del hallazgo',
  'Acciones de estado',
  'Flujo de resolución',
]

const BENIGN_BEFORE = {
  version: 1,
  observation: 'AUDIT-P1A-AUDIT-TRAIL-20260817 observacion inicial',
  incidenceTypes: [{ findingId: FINDING_ID, incidenceType: 'FUNCTIONALITY' }],
}

const BENIGN_AFTER = {
  ...BENIGN_BEFORE,
  version: 2,
  observation: 'AUDIT-P1A-AUDIT-TRAIL-20260817 observacion EDITADA',
}

/**
 * Snapshot genuinamente informateable: leer la propiedad lanza. Ningún
 * formateador defensivo puede sobrevivir a esto, que es precisamente el motivo
 * de que el límite de error exista.
 */
function hostileSnapshot() {
  const snapshot: Record<string, unknown> = { version: 2 }
  Object.defineProperty(snapshot, 'incidenceTypes', {
    enumerable: true,
    get() {
      throw new Error('propiedad hostil: acceso denegado')
    },
  })
  return snapshot
}

function logEntry(before: unknown, after: unknown) {
  return {
    id: 'cmswx0khi0003c92s9a2aborc',
    action: 'UPDATE',
    actor: ACTOR,
    createdAt: '2026-08-17T07:31:27.030Z',
    before,
    after,
  }
}

/** Réplica reducida del árbol real de `app/findings/[id]/page.tsx`. */
function FindingDetailStub() {
  return (
    <div>
      <section>{SIBLING_MARKERS[0]}</section>
      <section>{SIBLING_MARKERS[1]}</section>
      <section>{SIBLING_MARKERS[2]}</section>
      <section>
        <ErrorBoundary title="Auditoría" message={FALLBACK_MESSAGE}>
          <AuditTrailViewer findingId={FINDING_ID} compact />
        </ErrorBoundary>
      </section>
    </div>
  )
}

let container: HTMLDivElement | null = null
let root: Root | null = null
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  mocks.getAuditLog.mockReset()
  mocks.toast.mockReset()
  mocks.formatterShouldThrow.value = false
  // React y el propio boundary registran el fallo capturado; es ruido esperado.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
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
  consoleErrorSpy?.mockRestore()
  consoleErrorSpy = null
  mocks.formatterShouldThrow.value = false
})

/**
 * Monta el detalle completo. Si el fallo de la auditoría escapase del límite de
 * error, `act` propagaría la excepción y la prueba fallaría aquí.
 */
async function renderDetail(items: unknown[]) {
  mocks.getAuditLog.mockResolvedValue({
    status: 'success',
    data: { items, total: items.length },
  })

  const element = container!
  await act(async () => {
    root = createRoot(element)
    root.render(<FindingDetailStub />)
  })

  return element.textContent ?? ''
}

describe('C-01 · ErrorBoundary aísla el fallo a la tarjeta de auditoría', () => {
  it('control: sin fallo, la auditoría se muestra y no aparece el texto degradado', async () => {
    const text = await renderDetail([logEntry(BENIGN_BEFORE, BENIGN_AFTER)])

    for (const marker of SIBLING_MARKERS) {
      expect(text).toContain(marker)
    }
    expect(text).toContain('observacion EDITADA')
    expect(text).not.toContain(FALLBACK_MESSAGE)
  })

  it('payload hostil (getter que lanza): degrada sólo la auditoría, el detalle sobrevive', async () => {
    const text = await renderDetail([logEntry({ version: 1 }, hostileSnapshot())])

    // El resto del detalle sigue montado: no se cayó al error boundary global.
    for (const marker of SIBLING_MARKERS) {
      expect(text).toContain(marker)
    }
    // Y la tarjeta de auditoría muestra su estado degradado, no desaparece.
    expect(text).toContain('Auditoría')
    expect(text).toContain(FALLBACK_MESSAGE)
  })

  it('fallo simulado del formateador: mismo aislamiento', async () => {
    mocks.formatterShouldThrow.value = true

    const text = await renderDetail([logEntry(BENIGN_BEFORE, BENIGN_AFTER)])

    for (const marker of SIBLING_MARKERS) {
      expect(text).toContain(marker)
    }
    expect(text).toContain(FALLBACK_MESSAGE)
    // El contenido de la auditoría no se renderizó, pero nada más se perdió.
    expect(text).not.toContain('observacion EDITADA')
  })

  it('el fallo de la auditoría no impide interactuar con el resto del detalle', async () => {
    mocks.formatterShouldThrow.value = true
    await renderDetail([logEntry(BENIGN_BEFORE, BENIGN_AFTER)])

    // Las secciones hermanas siguen siendo nodos vivos del DOM, no restos de
    // un árbol desmontado por el error boundary de ruta.
    const sections = container!.querySelectorAll('section')
    expect(sections.length).toBe(4)
    expect(sections[0].textContent).toContain(SIBLING_MARKERS[0])
  })
})
