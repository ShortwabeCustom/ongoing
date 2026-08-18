// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { restoreEvidence, type RestoreDependencies } from '../evidence-restore-service'

const NOW = new Date('2026-08-17T12:00:00Z')
function row(overrides: Record<string, unknown> = {}) {
  return { id: 'ev_1', findingId: 'f_1', storageKey: 'findings/f_1/ev_1/x.png', deletedAt: new Date('2026-08-10T12:00:00Z'), finding: { deletedAt: null }, ...overrides }
}
function harness(value: ReturnType<typeof row> | null = row()) {
  const evidence = { findUnique: vi.fn().mockResolvedValue(value), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }
  const auditLog = { create: vi.fn().mockResolvedValue({}) }
  const db = { evidence, auditLog, $transaction: vi.fn(async (fn: any) => fn({ evidence, auditLog })) }
  const validateStorage = vi.fn()
  const statObject = vi.fn().mockResolvedValue({ size: 1 })
  return { deps: { db, validateStorage, statObject } as unknown as RestoreDependencies, db, evidence, auditLog, validateStorage, statObject }
}

describe('manual evidence restore', () => {
  it('missing, legacy, inactive finding, and active are distinguished', async () => {
    await expect(restoreEvidence('ev', {}, harness(null).deps)).rejects.toThrow('NOT_FOUND')
    await expect(restoreEvidence('ev', {}, harness(row({ storageKey: 'legacy/x.png' })).deps)).rejects.toThrow('LEGACY_NOT_RESTORABLE')
    await expect(restoreEvidence('ev', {}, harness(row({ finding: { deletedAt: new Date() } })).deps)).rejects.toThrow('FINDING_INACTIVE')
    const active = harness(row({ deletedAt: null }))
    await expect(restoreEvidence('ev_1', { execute: true }, active.deps)).resolves.toMatchObject({ status: 'already-active' })
    expect(active.db.$transaction).not.toHaveBeenCalled()
  })

  it('storage invalid and missing object cause zero DB writes', async () => {
    const invalid = harness(); invalid.validateStorage.mockImplementation(() => { throw new Error('bad storage') })
    await expect(restoreEvidence('ev_1', { execute: true }, invalid.deps)).rejects.toThrow('bad storage')
    expect(invalid.db.$transaction).not.toHaveBeenCalled()

    const missing = harness(); missing.statObject.mockRejectedValue({ errno: 'ENOENT' })
    await expect(restoreEvidence('ev_1', { execute: true }, missing.deps)).rejects.toThrow('OBJECT_ALREADY_PURGED')
    expect(missing.db.$transaction).not.toHaveBeenCalled()
  })

  it('dry-run checks eligibility without writes', async () => {
    const h = harness()
    await expect(restoreEvidence('ev_1', { now: NOW }, h.deps)).resolves.toMatchObject({ status: 'eligible' })
    expect(h.db.$transaction).not.toHaveBeenCalled()
  })

  it('restores atomically, re-stats under lock, and audits UPDATE RESTORE', async () => {
    const h = harness()
    const result = await restoreEvidence('ev_1', { execute: true, actorId: 'operator', now: NOW }, h.deps)
    expect(result.status).toBe('restored')
    expect(h.evidence.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { deletedAt: null, deletedBy: null, url: '/api/evidence/ev_1/file' } }))
    expect(h.statObject).toHaveBeenCalledTimes(2)
    expect(h.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'UPDATE', after: expect.objectContaining({ phase: 'RESTORE' }) }) })
  })

  it('outside 30d is allowed with warning per ADR', async () => {
    const h = harness(row({ deletedAt: new Date('2026-07-01T00:00:00Z') }))
    expect(await restoreEvidence('ev_1', { execute: true, now: NOW }, h.deps)).toMatchObject({ outsideRetentionWindow: true })
    const boundary = harness(row({ deletedAt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000) }))
    expect(await restoreEvidence('ev_1', { execute: true, now: NOW }, boundary.deps)).toMatchObject({ outsideRetentionWindow: true })
  })

  it('race loss or object disappearance rolls back before audit', async () => {
    const race = harness(); race.evidence.updateMany.mockResolvedValue({ count: 0 })
    await expect(restoreEvidence('ev_1', { execute: true }, race.deps)).rejects.toThrow('STATE_CHANGED')
    expect(race.auditLog.create).not.toHaveBeenCalled()

    const gone = harness(); gone.statObject.mockResolvedValueOnce({ size: 1 }).mockRejectedValueOnce({ errno: 'ENOENT' })
    await expect(restoreEvidence('ev_1', { execute: true }, gone.deps)).rejects.toThrow('OBJECT_ALREADY_PURGED')
    expect(gone.auditLog.create).not.toHaveBeenCalled()
  })

  it('después de un purge fallido sin bytes, restore no puede quedar activo', async () => {
    const h = harness()
    h.statObject.mockRejectedValue({ errno: 'ENOENT' })

    await expect(restoreEvidence('ev_1', { execute: true }, h.deps)).rejects.toThrow('OBJECT_ALREADY_PURGED')
    expect(h.evidence.updateMany).not.toHaveBeenCalled()
    expect(h.auditLog.create).not.toHaveBeenCalled()
  })
})
