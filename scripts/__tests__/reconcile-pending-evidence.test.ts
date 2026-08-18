// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const reconcile = vi.hoisted(() => vi.fn())
vi.mock('../../lib/services/evidence-reconciliation-service', () => ({
  reconcilePendingEvidence: reconcile,
}))

const { main, parseArgs } = await import('../reconcile-pending-evidence')

beforeEach(() => {
  vi.clearAllMocks()
  reconcile.mockResolvedValue({ scanned: 1, cleaned: 0, skipped: 0, failed: 0, failures: [] })
})

describe('CLI contract', () => {
  it('requires an explicit positive grace period', () => {
    expect(() => parseArgs([])).toThrow('--grace-minutes is required')
    expect(() => parseArgs(['--grace-minutes', '0'])).toThrow('positive integer')
    expect(() => parseArgs(['--grace-minutes', '1.5'])).toThrow('positive integer')
  })

  it('defaults to dry run and computes the cutoff from the supplied now', async () => {
    const now = new Date('2026-08-17T12:00:00.000Z')
    expect(await main(['--grace-minutes', '30'], now)).toBe(0)
    expect(reconcile).toHaveBeenCalledWith({
      cutoff: new Date('2026-08-17T11:30:00.000Z'),
      execute: false,
      batchSize: undefined,
    })
  })

  it('--execute enables writes and accepts a positive batch size', async () => {
    await main(['--grace-minutes', '60', '--batch-size', '25', '--execute'])
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ execute: true, batchSize: 25 }))
  })

  it('returns non-zero for candidate failures and zero on success', async () => {
    reconcile.mockResolvedValueOnce({
      scanned: 1, cleaned: 0, skipped: 0, failed: 1,
      failures: [{ evidenceId: 'ev_1', error: new Error('EIO') }],
    })
    expect(await main(['--grace-minutes', '60'])).toBe(1)
    reconcile.mockResolvedValueOnce({ scanned: 1, cleaned: 1, skipped: 0, failed: 0, failures: [] })
    expect(await main(['--grace-minutes', '60', '--execute'])).toBe(0)
  })

  it('invalid args fail before invoking the service', async () => {
    expect(await main(['--execute'])).toBe(1)
    expect(reconcile).not.toHaveBeenCalled()
  })

  it('storage inválido retorna exit code 1', async () => {
    reconcile.mockRejectedValueOnce(new Error('invalid storage'))
    expect(await main(['--grace-minutes', '60', '--execute'])).toBe(1)
  })
})
