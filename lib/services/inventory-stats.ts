import { getDb } from '@/lib/db-lazy'

export async function getInventoryStats() {
  try {
    const db = getDb()
    const [total, pending, completed, evidence] = await Promise.all([
      db.finding.count({ where: { deletedAt: null } }),
      db.finding.count({
        where: {
          deletedAt: null,
          status: { in: ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'BLOCKED', 'REOPENED'] },
        },
      }),
      db.finding.count({
        where: {
          deletedAt: null,
          status: { in: ['VALIDATED', 'CLOSED'] },
        },
      }),
      db.evidence.count({ where: { deletedAt: null } }),
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
