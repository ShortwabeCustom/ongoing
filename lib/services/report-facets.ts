import {
  CHANNEL_OPTIONS,
  FINDING_TYPE_LABELS_ES,
  FINDING_TYPE_OPTIONS,
  INCIDENCE_TYPE_LABELS_ES,
  INCIDENCE_TYPE_OPTIONS,
} from '@/lib/constants/finding-options'

export type ReportFacetOption = { value: string; label: string; count: number }

export type ReportFacets = {
  categories: ReportFacetOption[]
  types: ReportFacetOption[]
  channels: ReportFacetOption[]
}

export type ReportFacetInput = {
  categories: string[]
  findingType: string | null
  channel: string | null
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
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1)

  for (const finding of findings) {
    finding.categories.forEach((category) => bump(categoryCounts, category))
    if (finding.findingType) bump(typeCounts, finding.findingType)
    if (finding.channel) bump(channelCounts, finding.channel)
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
    categories: known(INCIDENCE_TYPE_OPTIONS, categoryCounts, INCIDENCE_TYPE_LABELS_ES),
    types: known(FINDING_TYPE_OPTIONS, typeCounts, FINDING_TYPE_LABELS_ES),
    channels: [...knownChannels, ...otherChannels].map((channel) => ({
      value: channel,
      label: channel,
      count: channelCounts.get(channel) ?? 0,
    })),
  }
}
