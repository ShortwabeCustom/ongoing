import { getDb } from '@/lib/db-lazy'
import { FINDING_STATUS_OPTIONS, STATUS_LABELS_ES } from '@/lib/constants/finding-options'
import { projectAccessWhere } from '@/lib/services/project-service'

type StatusUser = {
  id: string
  role?: string
}

export type ProjectStatusItem = {
  /** Mismo id que usa el filtro Proyecto de /findings (`?project=<id>`). */
  id: string
  name: string
  owner: { id: string; name: string }
  /** Suma de los conteos por estado: hallazgos vigentes (deletedAt = null). */
  total: number
  /** Solo estados con al menos un hallazgo, en el orden del ciclo de vida. */
  statuses: Array<{ status: string; label: string; count: number }>
}

/**
 * Estado de proyectos para el reporte ejecutivo.
 *
 * Solo expone lo que existe en la base: nombre, owner y conteo de hallazgos por
 * estado. No calcula avance ni porcentajes, y no deduce responsable UIX ni
 * contraparte de Negocio: el modelo `Project` no tiene esos campos.
 * El alcance respeta `projectAccessWhere`, igual que /findings.
 */
export async function getProjectStatus(user: StatusUser): Promise<ProjectStatusItem[]> {
  const db = getDb()

  const projects = await db.project.findMany({
    where: projectAccessWhere(user),
    orderBy: { name: 'asc' },
    select: { id: true, name: true, owner: { select: { id: true, name: true } } },
  })
  if (projects.length === 0) return []

  const grouped = await db.finding.groupBy({
    by: ['projectId', 'status'],
    where: { deletedAt: null, projectId: { in: projects.map((project) => project.id) } },
    _count: { _all: true },
  })

  const countsByProject = new Map<string, Map<string, number>>()
  for (const row of grouped) {
    const counts = countsByProject.get(row.projectId) ?? new Map<string, number>()
    counts.set(row.status, row._count._all)
    countsByProject.set(row.projectId, counts)
  }

  return projects.map((project) => {
    const counts = countsByProject.get(project.id) ?? new Map<string, number>()
    const statuses = FINDING_STATUS_OPTIONS.filter((status) => (counts.get(status) ?? 0) > 0).map((status) => ({
      status,
      label: STATUS_LABELS_ES[status] ?? status,
      count: counts.get(status) ?? 0,
    }))

    return {
      id: project.id,
      name: project.name,
      owner: project.owner,
      total: statuses.reduce((sum, item) => sum + item.count, 0),
      statuses,
    }
  })
}
