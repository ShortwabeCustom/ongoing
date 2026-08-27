// @vitest-environment node
/**
 * ADR-001 D8.1 + D12 — el reporte público y su contador comparten UNA
 * definición de "evidencia públicamente renderizable":
 *
 *   evidence.deletedAt == null
 *   AND finding.deletedAt == null
 *   AND url != null AND url != ""
 *   AND ( isLegacyStorageKey(storageKey) OR visibility == 'PUBLIC_REPORT' )
 *
 * Este test verifica la FORMA de las queries (el `where` del contador y el de
 * la lista anidada deben coincidir, salvo la cláusula de `finding`, que en la
 * lista ya garantiza la query padre) y el comportamiento observable: la
 * evidencia de runtime PRIVATE (D7, default) nunca aparece; la runtime
 * PUBLIC_REPORT (D12) se sirve por el endpoint público, nunca por el privado.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_STORAGE_KEY_PREFIX } from '@/lib/storage/storage-key'

const RUNTIME_KEY = 'findings/find_1/ev_runtime/captura.png'
const LEGACY_KEY = 'legacy/public/images/captura.png'

const calls = vi.hoisted(() => ({ evidenceCount: [] as unknown[], findingFindMany: [] as unknown[] }))

const db = vi.hoisted(() => ({
  finding: {
    count: vi.fn(async () => 0),
    findMany: vi.fn(async (args: unknown) => {
      calls.findingFindMany.push(args)
      return []
    }),
  },
  evidence: {
    count: vi.fn(async (args: unknown) => {
      calls.evidenceCount.push(args)
      return 0
    }),
  },
  testSession: { findMany: vi.fn(async () => []) },
}))

vi.mock('@/lib/db-lazy', () => ({ getDb: () => db }))

const { GET } = await import('@/app/api/public/report/route')

beforeEach(() => {
  vi.clearAllMocks()
  calls.evidenceCount.length = 0
  calls.findingFindMany.length = 0
})

function countWhere(): any {
  return (calls.evidenceCount[0] as any).where
}

function listWhere(): any {
  return (calls.findingFindMany[0] as any).select.evidence.where
}

/** Aplica un `where` de Prisma (forma restringida a esta regla) a una fila de ejemplo. */
function matches(
  where: any,
  row: { storageKey: string; url: string | null; visibility: 'PRIVATE' | 'PUBLIC_REPORT'; deletedAt: Date | null; findingDeletedAt?: Date | null },
): boolean {
  if (where.deletedAt === null && row.deletedAt !== null) return false
  if (where.finding?.deletedAt === null && row.findingDeletedAt) return false
  if (where.url?.not === null && row.url === null) return false
  if (where.NOT?.url === '' && row.url === '') return false

  const orMatches = (where.OR as any[]).some((clause: any) => {
    if (clause.storageKey?.startsWith !== undefined) return row.storageKey.startsWith(clause.storageKey.startsWith)
    if (clause.visibility !== undefined) return row.visibility === clause.visibility
    throw new Error(`cláusula OR no reconocida: ${JSON.stringify(clause)}`)
  })

  return orMatches
}

describe('regla única de renderizabilidad pública (D8.1 + D12)', () => {
  it('el KPI y la lista aplican exactamente el mismo predicado, salvo la cláusula de finding', async () => {
    await GET()
    const count = countWhere()
    const list = listWhere()

    expect(count).toEqual({
      deletedAt: null,
      url: { not: null },
      NOT: { url: '' },
      OR: [{ storageKey: { startsWith: LEGACY_STORAGE_KEY_PREFIX } }, { visibility: 'PUBLIC_REPORT' }],
      finding: { deletedAt: null },
    })

    // La lista es la MISMA regla; la query padre (`db.finding.findMany`) ya
    // restringe a findings activos, así que aquí no repite esa cláusula.
    expect(list).toEqual({
      deletedAt: null,
      url: { not: null },
      NOT: { url: '' },
      OR: [{ storageKey: { startsWith: LEGACY_STORAGE_KEY_PREFIX } }, { visibility: 'PUBLIC_REPORT' }],
    })
  })

  it('el OR admite legacy (D9) o publicación explícita PUBLIC_REPORT (D12) — nada más', async () => {
    await GET()
    for (const where of [countWhere(), listWhere()]) {
      expect(where.OR).toEqual([
        { storageKey: { startsWith: LEGACY_STORAGE_KEY_PREFIX } },
        { visibility: 'PUBLIC_REPORT' },
      ])
    }
  })

  it('ambos exigen evidencia activa (deletedAt: null) y url no vacía', async () => {
    await GET()
    expect(countWhere().deletedAt).toBeNull()
    expect(listWhere().deletedAt).toBeNull()
    expect(listWhere().url).toEqual({ not: null })
    expect(listWhere().NOT).toEqual({ url: '' })
  })

  it('la query padre de findings ya restringe a findings activos', async () => {
    await GET()
    expect((calls.findingFindMany[0] as any).where).toMatchObject({ deletedAt: null })
  })

  it('el contador exige explícitamente finding activo (no depende de una query padre)', async () => {
    await GET()
    expect(countWhere().finding).toEqual({ deletedAt: null })
  })

  it('selecciona storageKey y visibility solo para la defensa en profundidad, no para exponerlos', async () => {
    await GET()
    const select = (calls.findingFindMany[0] as any).select.evidence.select
    expect(select.storageKey).toBe(true)
    expect(select.visibility).toBe(true)
  })

  describe('matriz de renderizabilidad contra filas de ejemplo', () => {
    it('legacy activa con url ⇒ renderizable', async () => {
      await GET()
      expect(
        matches(listWhere(), { storageKey: LEGACY_KEY, url: '/images/x.png', visibility: 'PRIVATE', deletedAt: null }),
      ).toBe(true)
    })

    it('runtime PRIVATE (D7 default) ⇒ NO renderizable, aunque tenga url confirmada', async () => {
      await GET()
      expect(
        matches(listWhere(), { storageKey: RUNTIME_KEY, url: '/api/evidence/ev_runtime/file', visibility: 'PRIVATE', deletedAt: null }),
      ).toBe(false)
    })

    it('runtime PUBLIC_REPORT (D12) con url confirmada ⇒ renderizable', async () => {
      await GET()
      expect(
        matches(listWhere(), { storageKey: RUNTIME_KEY, url: '/api/evidence/ev_runtime/file', visibility: 'PUBLIC_REPORT', deletedAt: null }),
      ).toBe(true)
    })

    it('runtime PUBLIC_REPORT pero sin url (PENDING) ⇒ NO renderizable', async () => {
      await GET()
      expect(matches(listWhere(), { storageKey: RUNTIME_KEY, url: null, visibility: 'PUBLIC_REPORT', deletedAt: null })).toBe(false)
    })

    it('legacy borrada ⇒ NO renderizable', async () => {
      await GET()
      expect(
        matches(listWhere(), { storageKey: LEGACY_KEY, url: '/images/x.png', visibility: 'PRIVATE', deletedAt: new Date() }),
      ).toBe(false)
    })

    it('legacy con url vacía ⇒ NO renderizable', async () => {
      await GET()
      expect(matches(listWhere(), { storageKey: LEGACY_KEY, url: '', visibility: 'PRIVATE', deletedAt: null })).toBe(false)
    })
  })
})

describe('cero URLs del endpoint PRIVADO en el reporte público', () => {
  it('el mapeo de evidencia nunca puede producir /api/evidence/*/file', async () => {
    // La ruta real ya no tiene ninguna rama que construya esa URL: legacy usa
    // su `url` propio y runtime usa el endpoint público. Este test fija ese
    // invariante estructural para que una regresión futura (reintroducir la
    // rama `/api/evidence/${id}/file`) rompa aquí.
    const routeSource = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../route.ts', import.meta.url), 'utf8'),
    )
    expect(routeSource).not.toContain('/api/evidence/${ev.id}/file')
    expect(routeSource).not.toContain('/api/evidence/${')
    expect(routeSource).toContain('/api/public/evidence/${ev.id}/file')
  })
})

describe('contrato público conservado', () => {
  it('sigue respondiendo 200 de forma anónima y con la forma esperada', async () => {
    const response = await GET()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toHaveProperty('stats')
    expect(body.stats).toHaveProperty('evidenceCount')
    expect(body).toHaveProperty('rounds')
    expect(body).toHaveProperty('findings')
  })

  it('mantiene el Cache-Control y revalidate = 180 (ISR) existentes', async () => {
    const routeModule = await import('@/app/api/public/report/route')
    expect(routeModule.revalidate).toBe(180)

    const response = await GET()
    expect(response.headers.get('cache-control')).toBe('public, max-age=180, stale-while-revalidate=60')
  })
})
