// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  reconcilePendingEvidence,
  type ReconciliationDependencies,
} from '@/lib/services/evidence-reconciliation-service'

const CUTOFF = new Date('2026-08-17T10:00:00.000Z')

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ev_1',
    findingId: 'finding_1',
    storageKey: 'findings/finding_1/ev_1/file.png',
    createdAt: new Date('2026-08-17T09:00:00.000Z'),
    ...overrides,
  }
}

function harness(rows = [candidate()]) {
  const evidence = {
    findMany: vi.fn().mockResolvedValueOnce(rows).mockResolvedValueOnce([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  }
  const auditLog = { create: vi.fn().mockResolvedValue({}) }
  const deleteObject = vi.fn().mockResolvedValue(undefined)
  const validateStorage = vi.fn()
  const db = {
    evidence,
    auditLog,
    $transaction: vi.fn(async (fn: (tx: { evidence: typeof evidence; auditLog: typeof auditLog }) => unknown) =>
      fn({ evidence, auditLog }),
    ),
  }
  const dependencies = { db, deleteObject, validateStorage } as unknown as ReconciliationDependencies
  return { dependencies, db, evidence, auditLog, deleteObject, validateStorage }
}

beforeEach(() => vi.clearAllMocks())

describe('selection and dry run', () => {
  it('queries the exact DB-representable PENDING age boundary and paginates stably', async () => {
    const h = harness([])
    await reconcilePendingEvidence({ cutoff: CUTOFF }, h.dependencies)

    expect(h.evidence.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { url: null, deletedAt: null, createdAt: { lte: CUTOFF } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }))
  })

  it('counts old runtime PENDING rows including createdAt === cutoff', async () => {
    const h = harness([candidate(), candidate({ id: 'ev_boundary', createdAt: CUTOFF })])
    const result = await reconcilePendingEvidence({ cutoff: CUTOFF }, h.dependencies)
    expect(result).toMatchObject({ scanned: 2, cleaned: 0, skipped: 0, failed: 0 })
  })

  it('excludes recent, CONFIRMED, and soft-deleted rows', async () => {
    const source = [
      { ...candidate(), url: null, deletedAt: null },
      { ...candidate({ id: 'recent', createdAt: new Date(CUTOFF.getTime() + 1) }), url: null, deletedAt: null },
      { ...candidate({ id: 'confirmed' }), url: '/api/evidence/confirmed/file', deletedAt: null },
      { ...candidate({ id: 'soft-deleted' }), url: null, deletedAt: new Date() },
    ]
    const h = harness([])
    h.evidence.findMany.mockReset().mockImplementationOnce(async ({ where }: any) => source.filter((row) =>
      row.url === where.url &&
      row.deletedAt === where.deletedAt &&
      row.createdAt <= where.createdAt.lte,
    )).mockResolvedValueOnce([])

    const result = await reconcilePendingEvidence({ cutoff: CUTOFF }, h.dependencies)
    expect(result.scanned).toBe(1)
  })

  it('never treats legacy rows as candidates', async () => {
    const h = harness([candidate({ storageKey: 'legacy/old.png' })])
    const result = await reconcilePendingEvidence({ cutoff: CUTOFF }, h.dependencies)
    expect(result.scanned).toBe(0)
    expect(h.db.$transaction).not.toHaveBeenCalled()
  })

  it('dry run performs no DB, filesystem, or audit writes', async () => {
    const h = harness()
    const result = await reconcilePendingEvidence({ cutoff: CUTOFF }, h.dependencies)
    expect(result.scanned).toBe(1)
    expect(h.db.$transaction).not.toHaveBeenCalled()
    expect(h.evidence.deleteMany).not.toHaveBeenCalled()
    expect(h.deleteObject).not.toHaveBeenCalled()
    expect(h.auditLog.create).not.toHaveBeenCalled()
  })

  it('fails closed before querying when storage is invalid', async () => {
    const h = harness()
    h.validateStorage.mockImplementation(() => { throw new Error('invalid storage') })
    await expect(reconcilePendingEvidence({ cutoff: CUTOFF }, h.dependencies)).rejects.toThrow('invalid storage')
    expect(h.evidence.findMany).not.toHaveBeenCalled()
    expect(h.db.$transaction).not.toHaveBeenCalled()
    expect(h.evidence.deleteMany).not.toHaveBeenCalled()
    expect(h.auditLog.create).not.toHaveBeenCalled()
    expect(h.deleteObject).not.toHaveBeenCalled()
  })
})

describe('multi-batch pagination', () => {
  it('advances past a full batch of 100 legacy rows and processes the next candidate', async () => {
    const createdAt = new Date('2026-08-17T08:00:00.000Z')
    const legacy = Array.from({ length: 100 }, (_, index) => candidate({
      id: `legacy_${String(index).padStart(3, '0')}`,
      storageKey: `legacy/${index}.png`,
      createdAt,
    }))
    const runtime = candidate({ id: 'runtime_after_legacy', createdAt: new Date('2026-08-17T09:00:00.000Z') })
    const h = harness([])
    h.evidence.findMany.mockReset()
      .mockResolvedValueOnce(legacy)
      .mockResolvedValueOnce([runtime])

    const result = await reconcilePendingEvidence({ cutoff: CUTOFF, execute: true }, h.dependencies)

    expect(result).toMatchObject({ scanned: 1, cleaned: 1, skipped: 0, failed: 0 })
    expect(h.evidence.findMany).toHaveBeenCalledTimes(2)
    expect(h.evidence.findMany.mock.calls[1][0].where.OR).toEqual([
      { createdAt: { gt: createdAt } },
      { createdAt, id: { gt: 'legacy_099' } },
    ])
  })

  it('advances after a full batch of CAS misses and reaches the next batch', async () => {
    const firstBatch = Array.from({ length: 3 }, (_, index) => candidate({
      id: `skip_${index}`,
      createdAt: new Date('2026-08-17T08:00:00.000Z'),
    }))
    const later = candidate({ id: 'later', createdAt: new Date('2026-08-17T09:00:00.000Z') })
    const h = harness([])
    h.evidence.findMany.mockReset()
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce([later])
    h.evidence.deleteMany.mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })

    const result = await reconcilePendingEvidence(
      { cutoff: CUTOFF, execute: true, batchSize: 3 },
      h.dependencies,
    )

    expect(result).toMatchObject({ scanned: 4, cleaned: 1, skipped: 3, failed: 0 })
    expect(h.evidence.findMany).toHaveBeenCalledTimes(2)
  })

  it('uses id after equal createdAt without duplicating or omitting rows', async () => {
    const createdAt = new Date('2026-08-17T08:00:00.000Z')
    const firstBatch = [candidate({ id: 'a', createdAt }), candidate({ id: 'b', createdAt })]
    const lastBatch = [candidate({ id: 'c', createdAt })]
    const h = harness([])
    h.evidence.findMany.mockReset()
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(lastBatch)

    const result = await reconcilePendingEvidence(
      { cutoff: CUTOFF, execute: true, batchSize: 2 },
      h.dependencies,
    )

    expect(result.cleaned).toBe(3)
    expect(h.deleteObject).toHaveBeenCalledTimes(3)
    expect(h.evidence.findMany.mock.calls[1][0].where.OR).toEqual([
      { createdAt: { gt: createdAt } },
      { createdAt, id: { gt: 'b' } },
    ])
  })

  it('continues after a first-batch failure, processes later rows, and stops on a short last batch', async () => {
    const firstBatch = [candidate({ id: 'fails' }), candidate({ id: 'same_batch' })]
    const lastBatch = [candidate({ id: 'next_batch', createdAt: new Date('2026-08-17T09:30:00.000Z') })]
    const h = harness([])
    h.evidence.findMany.mockReset()
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(lastBatch)
    h.deleteObject.mockRejectedValueOnce(new Error('EIO')).mockResolvedValue(undefined)

    const result = await reconcilePendingEvidence(
      { cutoff: CUTOFF, execute: true, batchSize: 2 },
      h.dependencies,
    )

    expect(result).toMatchObject({ scanned: 3, cleaned: 2, failed: 1 })
    expect(h.deleteObject).toHaveBeenCalledTimes(3)
    expect(h.evidence.findMany).toHaveBeenCalledTimes(2)
  })
})

describe('execute, CAS, and idempotence', () => {
  it('deletes the row and object and writes the required audit atomically', async () => {
    const h = harness()
    const result = await reconcilePendingEvidence({ cutoff: CUTOFF, execute: true }, h.dependencies)
    expect(result).toMatchObject({ scanned: 1, cleaned: 1, skipped: 0, failed: 0 })
    expect(h.evidence.deleteMany).toHaveBeenCalledWith({ where: expect.objectContaining({
      id: 'ev_1', url: null, deletedAt: null, createdAt: { lte: CUTOFF },
      NOT: { storageKey: { startsWith: 'legacy/' } },
    }) })
    expect(h.deleteObject).toHaveBeenCalledWith('findings/finding_1/ev_1/file.png')
    expect(h.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      entityType: 'Evidence', entityId: 'ev_1', action: 'DELETE', actorId: null,
      after: { phase: 'INCOMPLETE_UPLOAD_CLEANUP' },
    }) })
  })

  it.each(['CONFIRMED concurrently', 'soft-deleted concurrently', 'row gone'])('%s: CAS miss skips without object delete or audit', async () => {
    const h = harness()
    h.evidence.deleteMany.mockResolvedValue({ count: 0 })
    const result = await reconcilePendingEvidence({ cutoff: CUTOFF, execute: true }, h.dependencies)
    expect(result.skipped).toBe(1)
    expect(h.deleteObject).not.toHaveBeenCalled()
    expect(h.auditLog.create).not.toHaveBeenCalled()
  })

  it('missing object is an idempotent success at the store boundary', async () => {
    const h = harness()
    h.deleteObject.mockResolvedValue(undefined)
    const result = await reconcilePendingEvidence({ cutoff: CUTOFF, execute: true }, h.dependencies)
    expect(result.cleaned).toBe(1)
    expect(h.auditLog.create).toHaveBeenCalledTimes(1)
  })

  it('filesystem failure reports failed, does not audit, and continues', async () => {
    const h = harness([candidate(), candidate({ id: 'ev_2', storageKey: 'findings/finding_1/ev_2/file.png' })])
    h.deleteObject.mockRejectedValueOnce(new Error('EIO')).mockResolvedValueOnce(undefined)
    const result = await reconcilePendingEvidence({ cutoff: CUTOFF, execute: true }, h.dependencies)
    expect(result).toMatchObject({ scanned: 2, cleaned: 1, failed: 1 })
    expect(h.db.$transaction).toHaveBeenCalledTimes(2)
    expect(h.auditLog.create).toHaveBeenCalledTimes(1)
  })

  it('filesystem failure rolls the conditional row deletion back', async () => {
    const h = harness()
    let rowExists = true
    h.db.$transaction.mockImplementation(async (fn: any) => {
      const snapshot = rowExists
      const transactionalEvidence = {
        ...h.evidence,
        deleteMany: vi.fn(async () => {
          if (!rowExists) return { count: 0 }
          rowExists = false
          return { count: 1 }
        }),
      }
      try {
        return await fn({ evidence: transactionalEvidence, auditLog: h.auditLog })
      } catch (error) {
        rowExists = snapshot
        throw error
      }
    })
    h.deleteObject.mockRejectedValue(new Error('EACCES'))

    const result = await reconcilePendingEvidence({ cutoff: CUTOFF, execute: true }, h.dependencies)
    expect(result.failed).toBe(1)
    expect(rowExists).toBe(true)
    expect(h.auditLog.create).not.toHaveBeenCalled()
  })

  it('audit/commit failure after file deletion is failed and remains retryable', async () => {
    const h = harness()
    h.auditLog.create.mockRejectedValueOnce(new Error('audit unavailable'))
    const first = await reconcilePendingEvidence({ cutoff: CUTOFF, execute: true }, h.dependencies)
    expect(first.failed).toBe(1)
    expect(first.cleaned).toBe(0)

    h.evidence.findMany.mockReset().mockResolvedValueOnce([candidate()]).mockResolvedValueOnce([])
    h.auditLog.create.mockResolvedValue({})
    h.deleteObject.mockResolvedValue(undefined) // subsequent ENOENT is represented as success
    const retry = await reconcilePendingEvidence({ cutoff: CUTOFF, execute: true }, h.dependencies)
    expect(retry.cleaned).toBe(1)
  })

  it('a repeated run with no row creates no duplicate audit', async () => {
    const h = harness([])
    const result = await reconcilePendingEvidence({ cutoff: CUTOFF, execute: true }, h.dependencies)
    expect(result.scanned).toBe(0)
    expect(h.auditLog.create).not.toHaveBeenCalled()
  })
})
