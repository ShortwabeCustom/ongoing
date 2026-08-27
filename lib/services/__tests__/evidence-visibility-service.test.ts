// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { setEvidenceVisibility, type SetVisibilityDependencies } from '../evidence-visibility-service'

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ev_1',
    storageKey: 'findings/f_1/ev_1/x.png',
    visibility: 'PRIVATE',
    deletedAt: null,
    finding: { deletedAt: null },
    ...overrides,
  }
}

function harness(value: ReturnType<typeof row> | null = row()) {
  const evidence = { findUnique: vi.fn().mockResolvedValue(value), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }
  const auditLog = { create: vi.fn().mockResolvedValue({}) }
  const db = { evidence, auditLog, $transaction: vi.fn(async (fn: any) => fn({ evidence, auditLog })) }
  return { deps: { db } as unknown as SetVisibilityDependencies, db, evidence, auditLog }
}

describe('cambio manual de visibilidad de evidencia (D12)', () => {
  it('evidencia inexistente ⇒ NOT_FOUND', async () => {
    await expect(setEvidenceVisibility('ev', 'PUBLIC_REPORT', {}, harness(null).deps)).rejects.toThrow('NOT_FOUND')
  })

  it('evidencia borrada ⇒ EVIDENCE_DELETED, sin escritura', async () => {
    const h = harness(row({ deletedAt: new Date() }))
    await expect(setEvidenceVisibility('ev_1', 'PUBLIC_REPORT', { execute: true }, h.deps)).rejects.toThrow('EVIDENCE_DELETED')
    expect(h.db.$transaction).not.toHaveBeenCalled()
  })

  it('finding borrado ⇒ FINDING_INACTIVE, sin escritura', async () => {
    const h = harness(row({ finding: { deletedAt: new Date() } }))
    await expect(setEvidenceVisibility('ev_1', 'PUBLIC_REPORT', { execute: true }, h.deps)).rejects.toThrow('FINDING_DELETED')
    expect(h.db.$transaction).not.toHaveBeenCalled()
  })

  it('legacy ⇒ LEGACY_NOT_APPLICABLE, sin escritura (D9: la visibilidad legacy no la decide este flag)', async () => {
    const h = harness(row({ storageKey: 'legacy/public/images/x.png' }))
    await expect(setEvidenceVisibility('ev_1', 'PUBLIC_REPORT', { execute: true }, h.deps)).rejects.toThrow('LEGACY_NOT_APPLICABLE')
    expect(h.db.$transaction).not.toHaveBeenCalled()
  })

  it('dry-run no escribe, aunque el estado destino sea distinto', async () => {
    const h = harness()
    await expect(setEvidenceVisibility('ev_1', 'PUBLIC_REPORT', {}, h.deps)).resolves.toMatchObject({ status: 'eligible' })
    expect(h.db.$transaction).not.toHaveBeenCalled()
  })

  it('ya en el estado destino ⇒ no-op idempotente, exit implícito 0, sin auditoría, incluso con --execute', async () => {
    const h = harness(row({ visibility: 'PRIVATE' }))
    await expect(setEvidenceVisibility('ev_1', 'PRIVATE', { execute: true }, h.deps)).resolves.toMatchObject({ status: 'no-op' })
    expect(h.db.$transaction).not.toHaveBeenCalled()
    expect(h.auditLog.create).not.toHaveBeenCalled()
  })

  it('cambia PRIVATE -> PUBLIC_REPORT y audita UPDATE/VISIBILITY_CHANGE', async () => {
    const h = harness(row({ visibility: 'PRIVATE' }))
    const result = await setEvidenceVisibility('ev_1', 'PUBLIC_REPORT', { execute: true, actorId: 'operator' }, h.deps)

    expect(result).toEqual({ status: 'changed', evidenceId: 'ev_1', visibility: 'PUBLIC_REPORT' })
    expect(h.evidence.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ev_1',
        visibility: 'PRIVATE',
        deletedAt: null,
        finding: { deletedAt: null },
        NOT: { storageKey: { startsWith: 'legacy/' } },
      },
      data: { visibility: 'PUBLIC_REPORT' },
    })
    expect(h.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Evidence',
        entityId: 'ev_1',
        action: 'UPDATE',
        actorId: 'operator',
        before: { visibility: 'PRIVATE' },
        after: { phase: 'VISIBILITY_CHANGE', visibility: 'PUBLIC_REPORT' },
      }),
    })
  })

  it('cambia PUBLIC_REPORT -> PRIVATE (despublicar) igual de bien', async () => {
    const h = harness(row({ visibility: 'PUBLIC_REPORT' }))
    const result = await setEvidenceVisibility('ev_1', 'PRIVATE', { execute: true }, h.deps)
    expect(result.status).toBe('changed')
    expect(h.evidence.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { visibility: 'PRIVATE' } }))
  })

  it('nunca toca storageKey ni ningún otro campo', async () => {
    const h = harness(row({ visibility: 'PRIVATE' }))
    await setEvidenceVisibility('ev_1', 'PUBLIC_REPORT', { execute: true }, h.deps)
    const data = h.evidence.updateMany.mock.calls[0][0].data
    expect(Object.keys(data)).toEqual(['visibility'])
  })

  it('carrera concurrente (CAS falla) ⇒ STATE_CHANGED, sin auditoría', async () => {
    const h = harness(row({ visibility: 'PRIVATE' }))
    h.evidence.updateMany.mockResolvedValue({ count: 0 })
    await expect(setEvidenceVisibility('ev_1', 'PUBLIC_REPORT', { execute: true }, h.deps)).rejects.toThrow('STATE_CHANGED')
    expect(h.auditLog.create).not.toHaveBeenCalled()
  })

  it('nunca importa ni llama PrivateFileStore — no mueve ni copia bytes', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../evidence-visibility-service.ts', import.meta.url), 'utf8'),
    )
    expect(source).not.toMatch(/import .*PrivateFileStore/)
    expect(source).not.toMatch(/from ['"]node:fs/)
  })
})
