import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db-lazy'
import { INCIDENCE_TYPE_LABELS_ES } from '@/lib/constants/finding-options'
import { isLegacyStorageKey } from '@/lib/storage/storage-key'

export const revalidate = 180 // 3 minutes ISR cache

/**
 * Definición única de evidencia confirmada que puede mostrarse en el reporte.
 *
 * La lista y `evidenceCount` DEBEN compartir esta misma regla; si divergen, el
 * contador filtraría la existencia de evidencia privada por un endpoint
 * anónimo.
 *
 *   evidence.deletedAt == null
 *   AND finding.deletedAt == null      <- se añade abajo donde haga falta
 *   AND url != null
 *   AND url != ""
 *
 * La evidencia runtime conserva su ruta autenticada `/api/evidence/:id/file`:
 * se enumera igual que en `/findings`, pero los bytes siguen protegidos por el
 * RBAC del endpoint de archivos.
 */
const PUBLICLY_RENDERABLE_EVIDENCE = {
  deletedAt: null,
  url: { not: null },
  NOT: { url: '' },
}

export async function GET() {
  try {
    const db = getDb()

    // Fetch all data in parallel
    const [total, completed, pending, evidenceCount, sessions, findings] = await Promise.all([
      db.finding.count({ where: { deletedAt: null } }),
      db.finding.count({ where: { deletedAt: null, status: { in: ['VALIDATED', 'CLOSED'] } } }),
      db.finding.count({ where: { deletedAt: null, status: { in: ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'BLOCKED', 'REOPENED'] } } }),
      // MISMA regla que la lista, más el finding activo (que en la lista ya
      // garantiza la query padre).
      db.evidence.count({
        where: { ...PUBLICLY_RENDERABLE_EVIDENCE, finding: { deletedAt: null } },
      }),
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
            select: { id: true, storageKey: true, url: true, originalFilename: true },
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

      const evidenceList = finding.evidence.map((ev) => ({
        url: isLegacyStorageKey(ev.storageKey) ? (ev.url as string) : `/api/evidence/${ev.id}/file`,
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
