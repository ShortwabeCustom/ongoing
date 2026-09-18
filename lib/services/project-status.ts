import { getDb } from '@/lib/db-lazy'
import { FINDING_STATUS_OPTIONS, STATUS_LABELS_ES } from '@/lib/constants/finding-options'
import { PROJECT_STATUS_REPORT } from '@/lib/config/project-status-report'

/** Persona tal como se publica: sin ids ni correo, solo nombre y foto. */
export type ProjectStatusPerson = {
  name: string
  photoUrl: string | null
}

export type ProjectStatusItem = {
  /** Mismo id que usa el filtro Proyecto de /findings (`?project=<id>`). */
  id: string
  name: string
  owner: ProjectStatusPerson
  /** `null` si el reporte no define un responsable UIX para el proyecto. */
  uixResponsible: ProjectStatusPerson | null
  /** Suma de los conteos de los estados visibles (hallazgos vigentes, deletedAt = null). */
  total: number
  /** Solo estados con al menos un hallazgo, en el orden del ciclo de vida. */
  statuses: Array<{ status: string; label: string; count: number }>
}

/**
 * Estado de proyectos para el reporte ejecutivo (PÚBLICO).
 *
 * Expone lo que existe en la base (nombre, owner, hallazgos por estado) más la
 * curación explícita de `PROJECT_STATUS_REPORT`: solo los proyectos de la lista
 * blanca, con el owner / responsable UIX indicados y los estados ocultos que
 * correspondan. No calcula avance ni porcentajes.
 */
export async function getProjectStatus(): Promise<ProjectStatusItem[]> {
  const db = getDb()
  const { visibleProjectIds, projects: overrides, userPhotos, userDisplayNames } = PROJECT_STATUS_REPORT
  if (visibleProjectIds.length === 0) return []

  const projects = await db.project.findMany({
    where: { deletedAt: null, id: { in: visibleProjectIds } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, owner: { select: { id: true, name: true } } },
  })
  if (projects.length === 0) return []

  const referencedUserIds = [
    ...new Set(
      projects.flatMap((project) => {
        const override = overrides[project.id]
        return [override?.ownerUserId, override?.uixResponsibleUserId].filter((id): id is string => Boolean(id))
      }),
    ),
  ]
  const [grouped, referencedUsers] = await Promise.all([
    db.finding.groupBy({
      by: ['projectId', 'status'],
      where: { deletedAt: null, projectId: { in: projects.map((project) => project.id) } },
      _count: { _all: true },
    }),
    referencedUserIds.length
      ? db.user.findMany({ where: { id: { in: referencedUserIds }, deletedAt: null }, select: { id: true, name: true } })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
  ])

  const usersById = new Map(referencedUsers.map((referenced) => [referenced.id, referenced]))
  const person = (source: { id: string; name: string }): ProjectStatusPerson => ({
    name: userDisplayNames[source.id] ?? source.name,
    photoUrl: userPhotos[source.id] ?? null,
  })

  const countsByProject = new Map<string, Map<string, number>>()
  for (const row of grouped) {
    const counts = countsByProject.get(row.projectId) ?? new Map<string, number>()
    counts.set(row.status, row._count._all)
    countsByProject.set(row.projectId, counts)
  }

  return projects.map((project) => {
    const override = overrides[project.id]
    const counts = countsByProject.get(project.id) ?? new Map<string, number>()
    const hidden = new Set<string>(override?.hiddenStatuses ?? [])
    const statuses = FINDING_STATUS_OPTIONS.filter((status) => !hidden.has(status) && (counts.get(status) ?? 0) > 0).map(
      (status) => ({ status, label: STATUS_LABELS_ES[status] ?? status, count: counts.get(status) ?? 0 }),
    )

    // Si el usuario indicado no existe, se cae al registro: nunca se inventa una persona.
    const owner = usersById.get(override?.ownerUserId ?? '') ?? project.owner
    const uixResponsible = usersById.get(override?.uixResponsibleUserId ?? '')

    return {
      id: project.id,
      name: project.name,
      owner: person(owner),
      uixResponsible: uixResponsible ? person(uixResponsible) : null,
      total: statuses.reduce((sum, item) => sum + item.count, 0),
      statuses,
    }
  })
}
