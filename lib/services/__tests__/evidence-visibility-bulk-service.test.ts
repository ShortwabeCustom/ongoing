// @vitest-environment node
/**
 * ADR-001 D12-bis — backfill masivo de `Evidence.visibility`.
 *
 * Se mockean la BD y `PrivateFileStore.exists`; la mutación reutiliza
 * `setEvidenceVisibility` real (sin mock) contra la misma BD falsa, así que
 * estos tests cubren también la integración entre ambos servicios.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockStore = vi.hoisted(() => ({
  exists: vi.fn(),
  put: vi.fn(),
  stat: vi.fn(),
  getStream: vi.fn(),
}))

vi.mock('@/lib/storage/private-file-store', () => ({ PrivateFileStore: mockStore }))

const { setAllActiveRuntimeVisibility } = await import('../evidence-visibility-bulk-service')

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ev_1',
    storageKey: 'findings/f_1/ev_1/x.png',
    url: '/api/evidence/ev_1/file',
    visibility: 'PRIVATE',
    type: 'IMAGE',
    deletedAt: null,
    finding: { deletedAt: null },
    ...overrides,
  }
}

function harness(rows: ReturnType<typeof row>[]) {
  const byId = new Map(rows.map((r) => [r.id, { ...r }]))

  const evidence = {
    findMany: vi.fn(async () => Array.from(byId.values()).map((r) => ({ ...r }))),
    findUnique: vi.fn(async ({ where }: any) => {
      const found = byId.get(where.id)
      if (!found) return null
      return { ...found }
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const found = byId.get(where.id)
      if (!found) return { count: 0 }
      if (where.visibility !== undefined && found.visibility !== where.visibility) return { count: 0 }
      if (where.deletedAt !== null ? false : found.deletedAt !== null) return { count: 0 }
      Object.assign(found, data)
      return { count: 1 }
    }),
  }
  const auditLog = { create: vi.fn(async () => ({})) }
  const db = {
    evidence,
    auditLog,
    $transaction: vi.fn(async (fn: any) => fn({ evidence, auditLog })),
  }
  return { deps: { db } as any, db, evidence, auditLog, byId }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStore.exists.mockResolvedValue(true)
})

describe('backfill masivo de visibilidad (D12-bis)', () => {
  it('dry-run no escribe nada (sin $transaction, sin updateMany, sin auditLog)', async () => {
    const h = harness([row({ id: 'ev_1' })])
    const result = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', {}, h.deps)

    expect(result).toMatchObject({ mode: 'dry-run', eligible: 1, total: 1 })
    expect(h.db.$transaction).not.toHaveBeenCalled()
    expect(h.evidence.updateMany).not.toHaveBeenCalled()
    expect(h.auditLog.create).not.toHaveBeenCalled()
  })

  it('execute publica las elegibles y audita cada cambio', async () => {
    const h = harness([row({ id: 'ev_1' }), row({ id: 'ev_2', storageKey: 'findings/f_1/ev_2/y.png' })])
    const result = await setAllActiveRuntimeVisibility(
      'PUBLIC_REPORT',
      { execute: true, reason: 'REPORT_POLICY_BACKFILL' },
      h.deps,
    )

    expect(result).toMatchObject({ mode: 'execute', changed: 2, unchanged: 0, skipped: 0, failed: 0, total: 2 })
    expect(h.byId.get('ev_1')?.visibility).toBe('PUBLIC_REPORT')
    expect(h.byId.get('ev_2')?.visibility).toBe('PUBLIC_REPORT')
    expect(h.auditLog.create).toHaveBeenCalledTimes(2)
    expect(h.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Evidence',
        action: 'UPDATE',
        after: expect.objectContaining({
          phase: 'VISIBILITY_CHANGE',
          visibility: 'PUBLIC_REPORT',
          reason: 'REPORT_POLICY_BACKFILL',
        }),
      }),
    })
  })

  it('idempotente: correrlo dos veces no vuelve a cambiar las ya publicadas', async () => {
    const h = harness([row({ id: 'ev_1' })])
    await setAllActiveRuntimeVisibility('PUBLIC_REPORT', { execute: true }, h.deps)
    h.evidence.updateMany.mockClear()
    h.auditLog.create.mockClear()

    const second = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', { execute: true }, h.deps)
    expect(second).toMatchObject({ changed: 0, unchanged: 1, failed: 0 })
    expect(h.evidence.updateMany).not.toHaveBeenCalled()
    expect(h.auditLog.create).not.toHaveBeenCalled()
  })

  it('ya PUBLIC_REPORT queda excluida del changed count (dry-run y execute)', async () => {
    const h = harness([row({ id: 'ev_1', visibility: 'PUBLIC_REPORT' })])
    const dry = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', {}, h.deps)
    expect(dry).toMatchObject({ eligible: 0, alreadyTarget: 1 })

    const exec = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', { execute: true }, h.deps)
    expect(exec).toMatchObject({ changed: 0, unchanged: 1 })
  })

  it('PENDING (url null) excluida', async () => {
    const h = harness([row({ id: 'ev_1', url: null })])
    const result = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', {}, h.deps)
    expect(result).toMatchObject({ eligible: 0, skippedPending: 1 })
  })

  it('url vacío también cuenta como PENDING', async () => {
    const h = harness([row({ id: 'ev_1', url: '' })])
    const result = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', {}, h.deps)
    expect(result).toMatchObject({ eligible: 0, skippedPending: 1 })
  })

  it('Evidence borrada excluida', async () => {
    const h = harness([row({ id: 'ev_1', deletedAt: new Date() })])
    const result = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', {}, h.deps)
    expect(result).toMatchObject({ eligible: 0, skippedDeleted: 1 })
  })

  it('Finding borrado excluido', async () => {
    const h = harness([row({ id: 'ev_1', finding: { deletedAt: new Date() } })])
    const result = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', {}, h.deps)
    expect(result).toMatchObject({ eligible: 0, skippedDeletedFinding: 1 })
  })

  it('legacy excluida, nunca se consulta PrivateFileStore para ella', async () => {
    const h = harness([row({ id: 'ev_1', storageKey: 'legacy/public/images/x.png' })])
    const result = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', {}, h.deps)
    expect(result).toMatchObject({ eligible: 0, skippedLegacy: 1 })
    expect(mockStore.exists).not.toHaveBeenCalled()
  })

  it('unsupported: storageKey no-legacy sin bytes reales en PrivateFileStore', async () => {
    mockStore.exists.mockResolvedValue(false)
    const h = harness([row({ id: 'ev_1', url: '/evidence-placeholder/evidence-1.svg' })])
    const result = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', {}, h.deps)
    expect(result).toMatchObject({ eligible: 0, skippedUnsupported: 1 })
  })

  it('unsupported: tipos no respaldados por PrivateFileStore (FIGMA_URL/EXTERNAL_URL) nunca consultan bytes', async () => {
    const h = harness([row({ id: 'ev_1', type: 'FIGMA_URL' })])
    const result = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', {}, h.deps)
    expect(result).toMatchObject({ eligible: 0, skippedUnsupported: 1 })
    expect(mockStore.exists).not.toHaveBeenCalled()
  })

  it('nunca toca storageKey ni hace operaciones de filesystem (solo exists, nunca put/stat/getStream)', async () => {
    const h = harness([row({ id: 'ev_1', storageKey: 'findings/f_1/ev_1/original.png' })])
    await setAllActiveRuntimeVisibility('PUBLIC_REPORT', { execute: true }, h.deps)

    expect(h.byId.get('ev_1')?.storageKey).toBe('findings/f_1/ev_1/original.png')
    expect(mockStore.exists).toHaveBeenCalledWith('findings/f_1/ev_1/original.png')
    expect(mockStore.put).not.toHaveBeenCalled()
    expect(mockStore.stat).not.toHaveBeenCalled()
    expect(mockStore.getStream).not.toHaveBeenCalled()
  })

  it('rollback: --visibility=PRIVATE despublica igual de bien', async () => {
    const h = harness([row({ id: 'ev_1', visibility: 'PUBLIC_REPORT' })])
    const result = await setAllActiveRuntimeVisibility('PRIVATE', { execute: true }, h.deps)
    expect(result).toMatchObject({ changed: 1, unchanged: 0 })
    expect(h.byId.get('ev_1')?.visibility).toBe('PRIVATE')
  })

  it('un fallo puntual (CAS/carrera) se cuenta como failed y no aborta el resto del lote', async () => {
    const h = harness([row({ id: 'ev_1' }), row({ id: 'ev_2', storageKey: 'findings/f_1/ev_2/y.png' })])
    const originalUpdateMany = h.evidence.updateMany.getMockImplementation()!
    h.evidence.updateMany.mockImplementation(async (args: any) => {
      if (args.where.id === 'ev_1') return { count: 0 } // simula carrera
      return originalUpdateMany(args)
    })

    const result = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', { execute: true }, h.deps)
    expect(result).toMatchObject({ changed: 1, failed: 1 })
    expect((result as any).failedIds).toEqual(['ev_1'])
    expect(h.byId.get('ev_2')?.visibility).toBe('PUBLIC_REPORT')
  })

  it('total cuenta todas las filas escaneadas, incluidas las excluidas', async () => {
    const h = harness([
      row({ id: 'ev_1' }),
      row({ id: 'ev_2', deletedAt: new Date() }),
      row({ id: 'ev_3', storageKey: 'legacy/x.png' }),
    ])
    const result = await setAllActiveRuntimeVisibility('PUBLIC_REPORT', {}, h.deps)
    expect(result.total).toBe(3)
  })
})
