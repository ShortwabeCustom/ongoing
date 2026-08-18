// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { purgeEvidence, type PurgeDependencies } from '../evidence-purge-service'
const CUTOFF = new Date('2026-07-18T00:00:00Z')
const candidate = (overrides: Record<string, unknown> = {}) => ({ id: 'ev_1', findingId: 'f_1', storageKey: 'findings/f_1/ev_1/x', deletedAt: CUTOFF, ...overrides })
function harness(rows = [candidate()]) {
  const evidence = { findMany: vi.fn().mockResolvedValueOnce(rows), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }
  const auditLog = { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) }
  const db = { evidence, auditLog, $transaction: vi.fn(async (fn: any) => fn({ evidence, auditLog })) }
  const validateStorage = vi.fn(); const deleteObject = vi.fn().mockResolvedValue(undefined)
  return { deps: { db, validateStorage, deleteObject } as unknown as PurgeDependencies, db, evidence, auditLog, validateStorage, deleteObject }
}
describe('physical purge core', () => {
  it('execute is impossible while gate is closed', async () => {
    const h = harness()
    await expect(purgeEvidence({ cutoff: CUTOFF, execute: true }, h.deps)).rejects.toThrow('PURGE_GATE_CLOSED')
    expect(h.validateStorage).not.toHaveBeenCalled(); expect(h.evidence.findMany).not.toHaveBeenCalled()
  })
  it('dry-run has zero writes and excludes legacy', async () => {
    const h = harness([candidate(), candidate({ id: 'legacy', storageKey: 'legacy/x' })])
    expect(await purgeEvidence({ cutoff: CUTOFF }, h.deps)).toMatchObject({ scanned: 1, purged: 0 })
    expect(h.db.$transaction).not.toHaveBeenCalled(); expect(h.deleteObject).not.toHaveBeenCalled()
  })
  it('purges at the exact cutoff and audits once', async () => {
    const h = harness()
    const result = await purgeEvidence({ cutoff: CUTOFF, execute: true, gateOpen: true }, h.deps)
    expect(result.purged).toBe(1); expect(h.deleteObject).toHaveBeenCalledTimes(1)
    expect(h.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'DELETE', after: expect.objectContaining({ phase: 'PHYSICAL_PURGE' }) }) })
  })
  it('prior audit and restore/CAS race skip without deleting bytes', async () => {
    const prior = harness(); prior.auditLog.findFirst.mockResolvedValue({ id: 'audit' })
    expect((await purgeEvidence({ cutoff: CUTOFF, execute: true, gateOpen: true }, prior.deps)).skipped).toBe(1)
    expect(prior.deleteObject).not.toHaveBeenCalled()
    const race = harness(); race.evidence.updateMany.mockResolvedValue({ count: 0 })
    expect((await purgeEvidence({ cutoff: CUTOFF, execute: true, gateOpen: true }, race.deps)).skipped).toBe(1)
    expect(race.deleteObject).not.toHaveBeenCalled()
  })
  it('filesystem errors fail individually and batch continues', async () => {
    const h = harness([candidate(), candidate({ id: 'ev_2', storageKey: 'findings/f/ev_2/x' })])
    h.deleteObject.mockRejectedValueOnce(new Error('EIO')).mockResolvedValueOnce(undefined)
    expect(await purgeEvidence({ cutoff: CUTOFF, execute: true, gateOpen: true }, h.deps)).toMatchObject({ failed: 1, purged: 1 })
  })
  it('storage invalid performs zero DB writes', async () => {
    const h = harness(); h.validateStorage.mockImplementation(() => { throw new Error('invalid') })
    await expect(purgeEvidence({ cutoff: CUTOFF }, h.deps)).rejects.toThrow('invalid')
    expect(h.evidence.findMany).not.toHaveBeenCalled(); expect(h.db.$transaction).not.toHaveBeenCalled()
  })

  it('retry after transaction failure accepts missing bytes and completes the audit', async () => {
    const h = harness()
    h.auditLog.create.mockRejectedValueOnce(new Error('transaction rollback')).mockResolvedValueOnce({})

    expect(await purgeEvidence({ cutoff: CUTOFF, execute: true, gateOpen: true }, h.deps)).toMatchObject({ failed: 1, purged: 0 })
    expect(h.deleteObject).toHaveBeenCalledTimes(1)

    h.evidence.findMany.mockResolvedValueOnce([candidate()])
    h.deleteObject.mockResolvedValueOnce(undefined) // PrivateFileStore.delete trata ENOENT como éxito.
    expect(await purgeEvidence({ cutoff: CUTOFF, execute: true, gateOpen: true }, h.deps)).toMatchObject({ failed: 0, purged: 1 })
    expect(h.deleteObject).toHaveBeenCalledTimes(2)
    expect(h.auditLog.create).toHaveBeenCalledTimes(2)
    expect(h.auditLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ after: expect.objectContaining({ phase: 'PHYSICAL_PURGE' }) }),
    })
  })

  it('un segundo worker ve PHYSICAL_PURGE y no duplica delete ni audit', async () => {
    const h = harness()
    h.auditLog.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'audit_1' })

    expect(await purgeEvidence({ cutoff: CUTOFF, execute: true, gateOpen: true }, h.deps)).toMatchObject({ purged: 1 })
    h.evidence.findMany.mockResolvedValueOnce([candidate()])
    expect(await purgeEvidence({ cutoff: CUTOFF, execute: true, gateOpen: true }, h.deps)).toMatchObject({ skipped: 1 })

    expect(h.deleteObject).toHaveBeenCalledTimes(1)
    expect(h.auditLog.create).toHaveBeenCalledTimes(1)
  })
})
