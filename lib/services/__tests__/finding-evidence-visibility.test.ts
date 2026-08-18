// @vitest-environment node
/**
 * ADR-001 D5.1 / D5.3 / D9 — visibilidad de la evidencia en el detalle del finding.
 *
 * Una evidencia de runtime PENDING (`url === null`, upload no confirmado) no
 * debe llegar al cliente: su objeto puede no existir, y la UI la pintaría como
 * una tarjeta rota que afirma tener un adjunto.
 *
 * El test ejercita el servicio REAL: captura el `where` que `getFinding` envía
 * a Prisma y lo evalúa contra filas de ejemplo con la MISMA semántica que
 * aplicaría el motor, en lugar de reescribir el predicado a mano.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_STORAGE_KEY_PREFIX } from '@/lib/storage/storage-key'

const mockFinding = vi.hoisted(() => ({ findUnique: vi.fn() }))

vi.mock('@/lib/db-lazy', () => ({ getDb: () => ({ finding: mockFinding }) }))
vi.mock('@/lib/services/search-service', () => ({ SearchService: {} }))

const { FindingService } = await import('@/lib/services/finding-service')

type Row = { storageKey: string; url: string | null; deletedAt: Date | null }

/** Aplica el `where` real emitido por el servicio a una fila de ejemplo. */
function matches(where: any, row: Row): boolean {
  if (where.deletedAt === null && row.deletedAt !== null) return false

  const orMatches = (where.OR as any[]).some((clause) => {
    if (clause.storageKey?.startsWith !== undefined) {
      return row.storageKey.startsWith(clause.storageKey.startsWith)
    }
    if (clause.url?.not === null) {
      return row.url !== null
    }
    throw new Error(`cláusula OR no reconocida: ${JSON.stringify(clause)}`)
  })

  return orMatches
}

let evidenceWhere: any

beforeEach(async () => {
  vi.clearAllMocks()
  mockFinding.findUnique.mockImplementation(async (args: any) => {
    evidenceWhere = args.include.evidence.where
    return null
  })
  await FindingService.getFinding('find_1')
})

describe('el where de evidencia que emite getFinding', () => {
  it('exige evidencia activa', () => {
    expect(evidenceWhere.deletedAt).toBeNull()
  })

  it('usa el prefijo legacy canónico del helper compartido', () => {
    const legacyClause = (evidenceWhere.OR as any[]).find((c) => c.storageKey)
    expect(legacyClause.storageKey.startsWith).toBe(LEGACY_STORAGE_KEY_PREFIX)
  })

  it('no filtra la storageKey al cliente', () => {
    const select = (mockFinding.findUnique.mock.calls[0][0] as any).include.evidence.select
    expect(select.storageKey).toBeUndefined()
  })
})

describe('matriz de visibilidad', () => {
  const RUNTIME = 'findings/find_1/ev_1/captura.png'
  const LEGACY = 'legacy/public/images/captura.png'

  it('runtime PENDING (url null) ⇒ NO visible', () => {
    expect(
      matches(evidenceWhere, { storageKey: RUNTIME, url: null, deletedAt: null }),
    ).toBe(false)
  })

  it('runtime CONFIRMED (url fijada) ⇒ visible', () => {
    expect(
      matches(evidenceWhere, {
        storageKey: RUNTIME,
        url: '/api/evidence/ev_1/file',
        deletedAt: null,
      }),
    ).toBe(true)
  })

  it('legacy con url null ⇒ SIGUE visible (D9 sin cambios)', () => {
    expect(matches(evidenceWhere, { storageKey: LEGACY, url: null, deletedAt: null })).toBe(
      true,
    )
  })

  it('legacy con url ⇒ visible', () => {
    expect(
      matches(evidenceWhere, { storageKey: LEGACY, url: '/images/x.png', deletedAt: null }),
    ).toBe(true)
  })

  it('evidencia borrada ⇒ NO visible, sea runtime o legacy', () => {
    const deletedAt = new Date()
    expect(
      matches(evidenceWhere, { storageKey: RUNTIME, url: '/api/evidence/ev_1/file', deletedAt }),
    ).toBe(false)
    expect(matches(evidenceWhere, { storageKey: LEGACY, url: '/images/x.png', deletedAt })).toBe(
      false,
    )
  })
})
