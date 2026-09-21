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
 * Clave estable (solo A-Z, 0-9 y _) para un estatus del archivo fuente: "On hold" -> "ON_HOLD".
 * El navegador la usa para elegir el color de la leyenda.
 */
export function sourceStatusKey(label: string): string {
  const key = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return key || 'SIN_ESTATUS'
}

/** Estatus del archivo fuente: primero los del orden configurado, luego el resto alfabéticamente. */
function orderSourceStatuses<T extends { label: string }>(items: T[], order: string[] = []): T[] {
  const rank = (label: string) => {
    const index = order.findIndex((known) => known.toLowerCase() === label.toLowerCase())
    return index === -1 ? order.length : index
  }
  return [...items].sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label, 'es'))
}

/**
 * Estado de proyectos para el reporte ejecutivo (PÚBLICO).
 *
 * Expone lo que existe en la base (nombre, owner, hallazgos por estado) más la
 * curación explícita de `PROJECT_STATUS_REPORT`: solo los proyectos de la lista
 * blanca, en el orden configurado, con el owner / responsable UIX indicados y los
 * estados ocultos que correspondan. Un proyecto puede mostrar los estatus literales
 * de su archivo fuente (`sourceStatus`) en lugar del estado del sistema.
 * No calcula avance ni porcentajes.
 */
export async function getProjectStatus(): Promise<ProjectStatusItem[]> {
  const db = getDb()
  const { visibleProjectIds, projects: overrides, userPhotos, userDisplayNames } = PROJECT_STATUS_REPORT
  if (visibleProjectIds.length === 0) return []

  const projects = await db.project.findMany({
    where: { deletedAt: null, id: { in: visibleProjectIds } },
    select: { id: true, name: true, owner: { select: { id: true, name: true } } },
  })
  if (projects.length === 0) return []
  // Orden de presentación = orden de la lista blanca (no alfabético)
  projects.sort((a, b) => visibleProjectIds.indexOf(a.id) - visibleProjectIds.indexOf(b.id))
  const usesSource = (projectId: string) => overrides[projectId]?.statusSource === 'source'

  const referencedUserIds = [
    ...new Set(
      projects.flatMap((project) => {
        const override = overrides[project.id]
        return [override?.ownerUserId, override?.uixResponsibleUserId].filter((id): id is string => Boolean(id))
      }),
    ),
  ]
  const workflowIds = projects.filter((project) => !usesSource(project.id)).map((project) => project.id)
  const sourceIds = projects.filter((project) => usesSource(project.id)).map((project) => project.id)
  const [grouped, groupedSource, referencedUsers] = await Promise.all([
    workflowIds.length
      ? db.finding.groupBy({
          by: ['projectId', 'status'],
          where: { deletedAt: null, projectId: { in: workflowIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    sourceIds.length
      ? db.finding.groupBy({
          by: ['projectId', 'sourceStatus'],
          where: { deletedAt: null, projectId: { in: sourceIds }, sourceStatus: { not: null } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
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

  const sourceCountsByProject = new Map<string, Array<{ label: string; count: number }>>()
  for (const row of groupedSource) {
    if (!row.sourceStatus) continue
    const list = sourceCountsByProject.get(row.projectId) ?? []
    list.push({ label: row.sourceStatus, count: row._count._all })
    sourceCountsByProject.set(row.projectId, list)
  }

  return projects.map((project) => {
    const override = overrides[project.id]
    const counts = countsByProject.get(project.id) ?? new Map<string, number>()
    const hidden = new Set<string>(override?.hiddenStatuses ?? [])
    const statuses = usesSource(project.id)
      ? orderSourceStatuses(sourceCountsByProject.get(project.id) ?? [], override?.sourceStatusOrder).map((item) => ({
          status: sourceStatusKey(item.label),
          label: item.label,
          count: item.count,
        }))
      : FINDING_STATUS_OPTIONS.filter((status) => !hidden.has(status) && (counts.get(status) ?? 0) > 0).map((status) => ({
          status,
          label: STATUS_LABELS_ES[status] ?? status,
          count: counts.get(status) ?? 0,
        }))

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
