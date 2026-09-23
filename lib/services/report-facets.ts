import {
  CHANNEL_OPTIONS,
  FINDING_TYPE_LABELS_ES,
  FINDING_TYPE_OPTIONS,
  FINDING_PRIORITY_OPTIONS,
  FINDING_SEVERITY_OPTIONS,
  FINDING_STATUS_OPTIONS,
  INCIDENCE_TYPE_LABELS_ES,
  INCIDENCE_TYPE_OPTIONS,
  PRIORITY_LABELS_ES,
  SEVERITY_LABELS_ES,
  STATUS_LABELS_ES,
} from '@/lib/constants/finding-options'

export type ReportFacetOption = { value: string; label: string; count: number }

export type ReportFacets = {
  statuses: ReportFacetOption[]
  priorities: ReportFacetOption[]
  severities: ReportFacetOption[]
  categories: ReportFacetOption[]
  types: ReportFacetOption[]
  channels: ReportFacetOption[]
  assignment: ReportFacetOption[]
}

export type ReportFacetInput = {
  categories: string[]
  findingType: string | null
  channel: string | null
  workflowStatus?: string | null
  priority?: string | null
  severity?: string | null
  assignmentState?: 'assigned' | 'unassigned'
}

/** Categorías conocidas del hallazgo, sin duplicados y en el orden del catálogo. */
export function orderCategories(keys: string[]): string[] {
  const present = new Set(keys)
  return INCIDENCE_TYPE_OPTIONS.filter((key) => present.has(key))
}

/** `channel` es texto libre en BD: se recorta y el vacío cuenta como "sin dato". */
export function normalizeChannel(channel: string | null | undefined): string | null {
  const value = channel?.trim()
  return value ? value : null
}

/**
 * Opciones de los filtros categóricos del reporte, con el conteo real de cada
 * valor. Solo aparecen valores que existen en los hallazgos; los hallazgos sin
 * dato simplemente no cuentan en ninguna opción (no se crea una categoría).
 */
export function buildReportFacets(findings: ReportFacetInput[]): ReportFacets {
  const categoryCounts = new Map<string, number>()
  const typeCounts = new Map<string, number>()
  const channelCounts = new Map<string, number>()
  const statusCounts = new Map<string, number>()
  const priorityCounts = new Map<string, number>()
  const severityCounts = new Map<string, number>()
  const assignmentCounts = new Map<string, number>()
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1)

  for (const finding of findings) {
    finding.categories.forEach((category) => bump(categoryCounts, category))
    if (finding.findingType) bump(typeCounts, finding.findingType)
    if (finding.channel) bump(channelCounts, finding.channel)
    if (finding.workflowStatus) bump(statusCounts, finding.workflowStatus)
    if (finding.priority) bump(priorityCounts, finding.priority)
    if (finding.severity) bump(severityCounts, finding.severity)
    if (finding.assignmentState) bump(assignmentCounts, finding.assignmentState)
  }

  const known = (order: readonly string[], counts: Map<string, number>, labels: Record<string, string>) =>
    order
      .filter((key) => (counts.get(key) ?? 0) > 0)
      .map((key) => ({ value: key, label: labels[key] ?? key, count: counts.get(key) ?? 0 }))

  const knownChannels = CHANNEL_OPTIONS.filter((channel) => channelCounts.has(channel))
  const otherChannels = [...channelCounts.keys()]
    .filter((channel) => !(CHANNEL_OPTIONS as readonly string[]).includes(channel))
    .sort((a, b) => a.localeCompare(b, 'es'))

  return {
    statuses: known(FINDING_STATUS_OPTIONS, statusCounts, STATUS_LABELS_ES),
    priorities: known(FINDING_PRIORITY_OPTIONS, priorityCounts, PRIORITY_LABELS_ES),
    severities: known(FINDING_SEVERITY_OPTIONS, severityCounts, SEVERITY_LABELS_ES),
    categories: known(INCIDENCE_TYPE_OPTIONS, categoryCounts, INCIDENCE_TYPE_LABELS_ES),
    types: known(FINDING_TYPE_OPTIONS, typeCounts, FINDING_TYPE_LABELS_ES),
    channels: [...knownChannels, ...otherChannels].map((channel) => ({
      value: channel,
      label: channel,
      count: channelCounts.get(channel) ?? 0,
    })),
    assignment: [
      { value: 'assigned', label: 'Con responsable', count: assignmentCounts.get('assigned') ?? 0 },
      { value: 'unassigned', label: 'Sin responsable', count: assignmentCounts.get('unassigned') ?? 0 },
    ].filter((item) => item.count > 0),
  }
}
