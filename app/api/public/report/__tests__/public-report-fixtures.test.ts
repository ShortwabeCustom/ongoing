// @vitest-environment node
/**
 * ADR-001 D8.1 + D12 — regresión de extremo a extremo contra datos de ejemplo.
 *
 * `public-evidence.test.ts` fija la FORMA del `where` que la ruta emite.
 * Este test complementa eso: mockea Prisma con un evaluador genérico del
 * mismo `where` contra filas fijas, y verifica el JSON resultante — así una
 * regresión que cambie la forma del `where` de un modo que el mock no
 * detecte, pero que sí cambie qué filas pasan, se atrapa aquí.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Visibility = 'PRIVATE' | 'PUBLIC_REPORT'

type EvidenceRow = {
  id: string
  storageKey: string
  url: string | null
  visibility: Visibility
  originalFilename: string
  deletedAt: Date | null
  findingId: string
}

type FindingRow = {
  id: string
  observation: string
  status: string
  sourceRow: number | null
  testSessionId: string | null
  deletedAt: Date | null
}

const FINDINGS: FindingRow[] = [
  { id: 'find_active', observation: 'Finding activo', status: 'OPEN', sourceRow: 1, testSessionId: null, deletedAt: null },
  { id: 'find_deleted', observation: 'Finding borrado', status: 'OPEN', sourceRow: 2, testSessionId: null, deletedAt: new Date() },
]

const EVIDENCE: EvidenceRow[] = [
  // Legacy activa con url ⇒ debe aparecer (D9).
  { id: 'ev_legacy', storageKey: 'legacy/public/images/a.png', url: '/images/a.png', visibility: 'PRIVATE', originalFilename: 'a.png', deletedAt: null, findingId: 'find_active' },
  // Runtime CONFIRMED, PRIVATE por defecto (D7) ⇒ NUNCA debe aparecer.
  { id: 'ev_runtime_private', storageKey: 'findings/find_active/ev_runtime_private/b.png', url: '/api/evidence/ev_runtime_private/file', visibility: 'PRIVATE', originalFilename: 'b.png', deletedAt: null, findingId: 'find_active' },
  // Runtime CONFIRMED, publicada explícitamente (D12) ⇒ debe aparecer por el endpoint público.
  { id: 'ev_runtime_public', storageKey: 'findings/find_active/ev_runtime_public/f.png', url: '/api/evidence/ev_runtime_public/file', visibility: 'PUBLIC_REPORT', originalFilename: 'f.png', deletedAt: null, findingId: 'find_active' },
  // Runtime PUBLIC_REPORT pero aún PENDING (url null) ⇒ NUNCA debe aparecer.
  { id: 'ev_runtime_public_pending', storageKey: 'findings/find_active/ev_runtime_public_pending/g.png', url: null, visibility: 'PUBLIC_REPORT', originalFilename: 'g.png', deletedAt: null, findingId: 'find_active' },
  // Legacy soft-deleted ⇒ NUNCA debe aparecer.
  { id: 'ev_legacy_deleted', storageKey: 'legacy/public/images/c.png', url: '/images/c.png', visibility: 'PRIVATE', originalFilename: 'c.png', deletedAt: new Date(), findingId: 'find_active' },
  // Legacy con url null ⇒ NUNCA debe aparecer.
  { id: 'ev_legacy_no_url', storageKey: 'legacy/public/images/d.png', url: null, visibility: 'PRIVATE', originalFilename: 'd.png', deletedAt: null, findingId: 'find_active' },
  // Legacy colgando de un finding borrado ⇒ NUNCA debe aparecer.
  { id: 'ev_orphan', storageKey: 'legacy/public/images/e.png', url: '/images/e.png', visibility: 'PRIVATE', originalFilename: 'e.png', deletedAt: null, findingId: 'find_deleted' },
]

/** Evaluador mínimo de las formas de `where` que esta ruta emite. */
function evidenceMatchesWhere(where: any, ev: EvidenceRow, finding: FindingRow): boolean {
  if (where.deletedAt === null && ev.deletedAt !== null) return false
  if (where.url?.not === null && ev.url === null) return false
  if (where.NOT?.url === '' && ev.url === '') return false
  if (where.finding?.deletedAt === null && finding.deletedAt !== null) return false

  const orMatches = (where.OR as any[]).some((clause: any) => {
    if (clause.storageKey?.startsWith) return ev.storageKey.startsWith(clause.storageKey.startsWith)
    if (clause.visibility) return ev.visibility === clause.visibility
    return false
  })
  return orMatches
}

vi.mock('@/lib/db-lazy', () => ({
  getDb: () => ({
    finding: {
      count: vi.fn(async (args: any) => FINDINGS.filter((f) => (args.where.deletedAt === null ? f.deletedAt === null : true)).length),
      findMany: vi.fn(async (args: any) => {
        const active = FINDINGS.filter((f) => (args.where.deletedAt === null ? f.deletedAt === null : true))
        return active.map((f) => ({
          id: f.id,
          observation: f.observation,
          status: f.status,
          sourceRow: f.sourceRow,
          testSessionId: f.testSessionId,
          testSession: null,
          incidenceTypes: [],
          evidence: EVIDENCE.filter((ev) => ev.findingId === f.id && evidenceMatchesWhere(args.select.evidence.where, ev, f)),
        }))
      }),
    },
    evidence: {
      count: vi.fn(async (args: any) =>
        EVIDENCE.filter((ev) => evidenceMatchesWhere(args.where, ev, FINDINGS.find((f) => f.id === ev.findingId)!)).length,
      ),
    },
    testSession: { findMany: vi.fn(async () => []) },
  }),
}))

const { GET } = await import('@/app/api/public/report/route')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reporte público contra datos de ejemplo (D7, D8.1, D9, D12)', () => {
  it('evidenceCount cuenta exactamente 2 (legacy activa + runtime publicada y confirmada)', async () => {
    const body = await (await GET()).json()
    expect(body.stats.evidenceCount).toBe(2)
  })

  it('findings[].evidence contiene solo esas dos, con sus URLs correctas', async () => {
    const body = await (await GET()).json()
    const evidences = body.findings.flatMap((f: any) => f.evidence)

    expect(evidences).toHaveLength(2)
    expect(evidences).toEqual(
      expect.arrayContaining([
        { url: '/images/a.png', filename: 'a.png' },
        { url: '/api/public/evidence/ev_runtime_public/file', filename: 'f.png' },
      ]),
    )
  })

  it('runtime PRIVATE nunca aparece, aunque su url esté confirmada', async () => {
    const body = await (await GET()).json()
    const urls = body.findings.flatMap((f: any) => f.evidence.map((e: any) => e.url))
    expect(urls).not.toContain('/api/evidence/ev_runtime_private/file')
  })

  it('runtime PUBLIC_REPORT pero PENDING (sin url) nunca aparece', async () => {
    const body = await (await GET()).json()
    const filenames = body.findings.flatMap((f: any) => f.evidence.map((e: any) => e.filename))
    expect(filenames).not.toContain('g.png')
  })

  it('cero URLs apuntan al endpoint privado /api/evidence/*/file', async () => {
    const body = await (await GET()).json()
    const urls = body.findings.flatMap((f: any) => f.evidence.map((e: any) => e.url))
    expect(urls.every((u: string) => !u.startsWith('/api/evidence/'))).toBe(true)
  })

  it('la evidencia runtime publicada usa exclusivamente el endpoint público', async () => {
    const body = await (await GET()).json()
    const urls = body.findings.flatMap((f: any) => f.evidence.map((e: any) => e.url))
    expect(urls).toContain('/api/public/evidence/ev_runtime_public/file')
  })

  it('cero URLs vacías (src="")', async () => {
    const body = await (await GET()).json()
    const urls = body.findings.flatMap((f: any) => f.evidence.map((e: any) => e.url))
    expect(urls.every((u: string) => u !== '')).toBe(true)
  })

  it('evidencia de un finding borrado nunca aparece', async () => {
    const body = await (await GET()).json()
    expect(body.findings.some((f: any) => f.title === 'Finding borrado')).toBe(false)
  })

  it('no filtra storageKey, visibility interna ni rutas de almacén en el JSON', async () => {
    const text = JSON.stringify(await (await GET()).json())
    expect(text).not.toContain('storageKey')
    expect(text).not.toContain('findings/find_active/ev_runtime_public/')
    expect(text).not.toContain('findings/find_active/ev_runtime_private/')
  })
})
