// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const setVisibility = vi.hoisted(() => vi.fn())
vi.mock('../../lib/services/evidence-visibility-service', () => ({
  setEvidenceVisibility: setVisibility,
}))

const { main } = await import('../set-evidence-visibility')

beforeEach(() => {
  vi.clearAllMocks()
  setVisibility.mockResolvedValue({ status: 'eligible', evidenceId: 'ev_1', visibility: 'PUBLIC_REPORT' })
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
