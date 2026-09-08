import { getDb } from '@/lib/db-lazy'
import { getAccessibleProjectIds } from '@/lib/services/project-service'

type StatsUser = {
  id: string
  role?: string
}

export async function getInventoryStats(user: StatsUser) {
  try {
    const db = getDb()
    const accessibleProjectIds = await getAccessibleProjectIds(user)
    // null = rol global OWNER, sin restricción; array = solo esos proyectos
    // (incluyendo un array vacío, que debe contar 0 en todo).
    const projectScope = accessibleProjectIds === null ? {} : { projectId: { in: accessibleProjectIds } }

    const [total, pending, completed, evidence] = await Promise.all([
      db.finding.count({ where: { deletedAt: null, ...projectScope } }),
      db.finding.count({
        where: {
          deletedAt: null,
          ...projectScope,
          status: { in: ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'BLOCKED', 'REOPENED'] },
        },
      }),
      db.finding.count({
        where: {
          deletedAt: null,
          ...projectScope,
          status: { in: ['VALIDATED', 'CLOSED'] },
        },
      }),
      db.evidence.count({
        where: {
          deletedAt: null,
          ...(accessibleProjectIds === null ? {} : { finding: { projectId: { in: accessibleProjectIds } } }),
        },
      }),
    ])

    return [
      { label: 'Hallazgos', value: total, tone: 'mint' as const },
      { label: 'Pendientes', value: pending, tone: 'amber' as const },
      { label: 'Resueltos', value: completed, tone: 'white' as const },
      { label: 'Evidencias', value: evidence, tone: 'coral' as const },
    ]
  } catch {
    return [
      { label: 'Hallazgos', value: '-', tone: 'mint' as const },
      { label: 'Pendientes', value: '-', tone: 'amber' as const },
      { label: 'Resueltos', value: '-', tone: 'white' as const },
      { label: 'Evidencias', value: '-', tone: 'coral' as const },
    ]
  }
}
