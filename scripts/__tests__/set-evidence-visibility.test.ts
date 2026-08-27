// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const setVisibility = vi.hoisted(() => vi.fn())
const setBulkVisibility = vi.hoisted(() => vi.fn())
vi.mock('../../lib/services/evidence-visibility-service', () => ({
  setEvidenceVisibility: setVisibility,
}))
vi.mock('../../lib/services/evidence-visibility-bulk-service', () => ({
  setAllActiveRuntimeVisibility: setBulkVisibility,
}))

const { main } = await import('../set-evidence-visibility')

beforeEach(() => {
  vi.clearAllMocks()
  setVisibility.mockResolvedValue({ status: 'eligible', evidenceId: 'ev_1', visibility: 'PUBLIC_REPORT' })
  setBulkVisibility.mockResolvedValue({
    mode: 'dry-run',
    eligible: 0,
    alreadyTarget: 0,
    skippedPending: 0,
    skippedDeleted: 0,
    skippedDeletedFinding: 0,
    skippedLegacy: 0,
    skippedUnsupported: 0,
    total: 0,
  })
})

describe('CLI contract — set-evidence-visibility', () => {
  it('--evidence-id es obligatorio', async () => {
    expect(await main(['--visibility=PUBLIC_REPORT'])).toBe(1)
    expect(setVisibility).not.toHaveBeenCalled()
  })

  it('--visibility es obligatorio', async () => {
    expect(await main(['--evidence-id=ev_1'])).toBe(1)
    expect(setVisibility).not.toHaveBeenCalled()
  })

  it('--visibility rechaza valores fuera de PRIVATE|PUBLIC_REPORT', async () => {
    expect(await main(['--evidence-id=ev_1', '--visibility=DELETED'])).toBe(1)
    expect(setVisibility).not.toHaveBeenCalled()
  })

  it('argumento desconocido ⇒ falla antes de invocar el servicio', async () => {
    expect(await main(['--evidence-id=ev_1', '--visibility=PRIVATE', '--force'])).toBe(1)
    expect(setVisibility).not.toHaveBeenCalled()
  })

  it('por defecto es dry-run (execute: false)', async () => {
    expect(await main(['--evidence-id=ev_1', '--visibility=PUBLIC_REPORT'])).toBe(0)
    expect(setVisibility).toHaveBeenCalledWith('ev_1', 'PUBLIC_REPORT', { execute: false })
  })

  it('--execute habilita la escritura', async () => {
    setVisibility.mockResolvedValue({ status: 'changed', evidenceId: 'ev_1', visibility: 'PUBLIC_REPORT' })
    expect(await main(['--evidence-id=ev_1', '--visibility=PUBLIC_REPORT', '--execute'])).toBe(0)
    expect(setVisibility).toHaveBeenCalledWith('ev_1', 'PUBLIC_REPORT', { execute: true })
  })

  it('acepta PRIVATE para despublicar', async () => {
    setVisibility.mockResolvedValue({ status: 'changed', evidenceId: 'ev_1', visibility: 'PRIVATE' })
    expect(await main(['--evidence-id=ev_1', '--visibility=PRIVATE', '--execute'])).toBe(0)
    expect(setVisibility).toHaveBeenCalledWith('ev_1', 'PRIVATE', { execute: true })
  })

  it('un rechazo del servicio (p.ej. LEGACY_NOT_APPLICABLE) ⇒ exit code 1', async () => {
    setVisibility.mockRejectedValueOnce(new Error('LEGACY_NOT_APPLICABLE'))
    expect(await main(['--evidence-id=ev_1', '--visibility=PUBLIC_REPORT', '--execute'])).toBe(1)
  })
})

describe('CLI contract — modo bulk (--all-active-runtime)', () => {
  it('--all-active-runtime y --evidence-id son mutuamente excluyentes', async () => {
    expect(
      await main(['--all-active-runtime', '--evidence-id=ev_1', '--visibility=PUBLIC_REPORT']),
    ).toBe(1)
    expect(setBulkVisibility).not.toHaveBeenCalled()
    expect(setVisibility).not.toHaveBeenCalled()
  })

  it('sin --evidence-id ni --all-active-runtime ⇒ falla', async () => {
    expect(await main(['--visibility=PUBLIC_REPORT'])).toBe(1)
    expect(setBulkVisibility).not.toHaveBeenCalled()
  })

  it('--visibility sigue siendo obligatorio en modo bulk', async () => {
    expect(await main(['--all-active-runtime'])).toBe(1)
    expect(setBulkVisibility).not.toHaveBeenCalled()
  })

  it('argumento desconocido en modo bulk ⇒ falla antes de invocar el servicio', async () => {
    expect(await main(['--all-active-runtime', '--visibility=PUBLIC_REPORT', '--force'])).toBe(1)
    expect(setBulkVisibility).not.toHaveBeenCalled()
  })

  it('por defecto es dry-run (execute: false), con el motivo fijo del backfill', async () => {
    expect(await main(['--all-active-runtime', '--visibility=PUBLIC_REPORT'])).toBe(0)
    expect(setBulkVisibility).toHaveBeenCalledWith(
      'PUBLIC_REPORT',
      { execute: false, reason: 'REPORT_POLICY_BACKFILL' },
    )
  })

  it('--execute habilita la escritura en modo bulk', async () => {
    setBulkVisibility.mockResolvedValue({
      mode: 'execute',
      changed: 265,
      unchanged: 0,
      skipped: 2,
      failed: 0,
      total: 267,
      failedIds: [],
    })
    expect(await main(['--all-active-runtime', '--visibility=PUBLIC_REPORT', '--execute'])).toBe(0)
    expect(setBulkVisibility).toHaveBeenCalledWith(
      'PUBLIC_REPORT',
      { execute: true, reason: 'REPORT_POLICY_BACKFILL' },
    )
  })

  it('acepta --visibility=PRIVATE en modo bulk (rollback de datos)', async () => {
    expect(await main(['--all-active-runtime', '--visibility=PRIVATE', '--execute'])).toBe(0)
    expect(setBulkVisibility).toHaveBeenCalledWith('PRIVATE', { execute: true, reason: 'REPORT_POLICY_BACKFILL' })
  })

  it('single-ID previo sigue funcionando sin invocar el servicio bulk', async () => {
    expect(await main(['--evidence-id=ev_1', '--visibility=PUBLIC_REPORT'])).toBe(0)
    expect(setVisibility).toHaveBeenCalledWith('ev_1', 'PUBLIC_REPORT', { execute: false })
    expect(setBulkVisibility).not.toHaveBeenCalled()
  })

  it('rollback a PRIVATE por single-ID sigue funcionando', async () => {
    setVisibility.mockResolvedValue({ status: 'changed', evidenceId: 'ev_1', visibility: 'PRIVATE' })
    expect(await main(['--evidence-id=ev_1', '--visibility=PRIVATE', '--execute'])).toBe(0)
    expect(setVisibility).toHaveBeenCalledWith('ev_1', 'PRIVATE', { execute: true })
  })

  it('un rechazo del servicio bulk ⇒ exit code 1', async () => {
    setBulkVisibility.mockRejectedValueOnce(new Error('boom'))
    expect(await main(['--all-active-runtime', '--visibility=PUBLIC_REPORT', '--execute'])).toBe(1)
  })
})
