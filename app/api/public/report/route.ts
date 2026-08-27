import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db-lazy'
import { INCIDENCE_TYPE_LABELS_ES } from '@/lib/constants/finding-options'
import { isLegacyStorageKey, LEGACY_STORAGE_KEY_PREFIX } from '@/lib/storage/storage-key'

export const revalidate = 180 // 3 minutes ISR cache

/**
 * Definición única de "públicamente renderizable" (ADR-001 D8.1 + D12). La
 * lista y `evidenceCount` DEBEN aplicar exactamente esta regla, sin
 * divergencia (R6):
 *
 *   evidence.deletedAt == null
 *   AND finding.deletedAt == null      <- se añade en cada query, ver abajo
 *   AND url != null AND url != ""
 *   AND ( isLegacyStorageKey(storageKey)          -- D9, siempre visible
 *         OR visibility == 'PUBLIC_REPORT' )      -- D12, publicación explícita
 *
 * La evidencia de runtime es PRIVATE por defecto (D7) y solo entra aquí si
 * fue publicada deliberadamente (D12, `evidence-visibility-service.ts`).
 * Esta ruta es anónima y JAMÁS puede emitir `/api/evidence/:id/file`, que
 * exige sesión (D2, D8.2): la evidencia runtime publicada se sirve por
 * `/api/public/evidence/:id/file`, que revalida `visibility` de forma
 * independiente en cada petición.
 */
const PUBLICLY_RENDERABLE_EVIDENCE = {
  deletedAt: null,
  url: { not: null },
  NOT: { url: '' },
  OR: [
    { storageKey: { startsWith: LEGACY_STORAGE_KEY_PREFIX } },
    { visibility: 'PUBLIC_REPORT' as const },
  ],
}

export async function GET() {
  try {
    const db = getDb()

    // Fetch all data in parallel
    const [total, completed, pending, evidenceCount, sessions, findings] = await Promise.all([
      db.finding.count({ where: { deletedAt: null } }),
      db.finding.count({ where: { deletedAt: null, status: { in: ['VALIDATED', 'CLOSED'] } } }),
      db.finding.count({ where: { deletedAt: null, status: { in: ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'BLOCKED', 'REOPENED'] } } }),
      db.evidence.count({ where: { ...PUBLICLY_RENDERABLE_EVIDENCE, finding: { deletedAt: null } } }),
      db.testSession.findMany({
        select: { id: true, name: true, date: true, _count: { select: { findings: { where: { deletedAt: null } } } } },
        orderBy: { date: 'asc' },
      }),
      db.finding.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          observation: true,
          status: true,
          sourceRow: true,
          testSessionId: true,
          testSession: { select: { name: true } },
          incidenceTypes: { select: { incidenceType: true } },
          evidence: {
            where: PUBLICLY_RENDERABLE_EVIDENCE,
            select: { id: true, storageKey: true, url: true, originalFilename: true, visibility: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [{ sourceRow: 'asc' }, { createdAt: 'asc' }],
      }),
    ])

    // Calculate percentages
    const completedPercent = total > 0 ? Math.round((completed / total) * 100) : 0
    const pendingPercent = total > 0 ? Math.round((pending / total) * 100) : 0

    // Build rounds array from TestSessions
    const rounds = sessions.map((session) => ({
      id: session.id,
      label: session.name,
      count: session._count.findings,
    }))

    // Build findings array with proper structure
    const findingsList = findings.map((finding, index) => {
      // Sequential display number (1-padded to 3 digits)
      const number = String(index + 1).padStart(3, '0')

      // Map status to display value
      const statusDisplay = ['VALIDATED', 'CLOSED'].includes(finding.status) ? 'completado' : 'pendiente'

      // Get incidence types and map to chip labels
      const chips = finding.incidenceTypes
        .map((it) => INCIDENCE_TYPE_LABELS_ES[it.incidenceType] || null)
        .filter((label): label is string => label !== null)

      // Order chips: Diseño first, then Copy
      const designChips = chips.filter((c) => c === 'Diseño')
      const copyChips = chips.filter((c) => c === 'Copy')
      const orderedChips = [...designChips, ...copyChips]

      // Build metadata line: "{session name} · Fila {sourceRow} · {tags}"
      const metaLine = [finding.testSession?.name, finding.sourceRow ? `Fila ${finding.sourceRow}` : null, orderedChips.join(' · ')]
        .filter((p): p is string => p !== null)
        .join(' · ')

      // Defensa en profundidad (R6): aunque el `where` ya aplica la regla,
      // esta ruta NUNCA debe poder emitir `/api/evidence/:id/file` (D8.2) ni
      // un `src=""` — se vuelve a comprobar aquí en vez de confiar solo en el
      // predicado de la query. Legacy usa su `url` tal cual (D9); runtime
      // exige `visibility === 'PUBLIC_REPORT'` revalidado en memoria y se
      // sirve por el endpoint público (D12), nunca por el privado.
      const evidenceList = finding.evidence
        .filter((ev) => !!ev.url && (isLegacyStorageKey(ev.storageKey) || ev.visibility === 'PUBLIC_REPORT'))
        .map((ev) => ({
          url: isLegacyStorageKey(ev.storageKey) ? (ev.url as string) : `/api/public/evidence/${ev.id}/file`,
          filename: ev.originalFilename || 'evidencia',
        }))

      return {
        number,
        title: finding.observation,
        status: statusDisplay,
        tags: orderedChips,
        roundId: finding.testSessionId,
        metaLine,
        evidence: evidenceList,
      }
    })

    const body = {
      stats: {
        observations: total,
        completed,
        pending,
        completedPercent,
        pendingPercent,
        evidenceCount,
      },
      rounds,
      findings: findingsList,
    }

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'public, max-age=180, stale-while-revalidate=60',
      },
    })
  } catch (error) {
    console.error('[PUBLIC REPORT] Fetch failed:', error)
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Report temporarily unavailable' },
      { status: 500 }
    )
  }
}
