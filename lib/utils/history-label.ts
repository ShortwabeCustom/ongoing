import type { SearchHistoryEntry } from '@/lib/types/search'
import { STATUS_LABELS_ES, PRIORITY_LABELS_ES, SEVERITY_LABELS_ES } from '@/lib/constants/finding-options'

interface HistoryLabelLookups {
  projectLabels?: Record<string, string>
  assigneeLabels?: Record<string, string>
}

type HistoryLabelEntry = Pick<SearchHistoryEntry, 'q' | 'status' | 'priority' | 'filters'>

/**
 * A recent/saved entry used to render as `entry.q || '(Sin texto)'` — useless
 * once the user searched via filters alone (no typed text). Picks the most
 * specific available signal, in the priority order from the workflow spec:
 * search text > Proyecto > Estado > Prioridad > Asignado > Severidad > Fecha.
 * Returns `undefined` only when there's truly nothing to describe (the
 * add-gating in useSearchHistory already skips that case, so this is mostly
 * a defensive fallback, not the primary guard against empty entries).
 */
export function buildHistoryEntryLabel(entry: HistoryLabelEntry, lookups: HistoryLabelLookups = {}): string | undefined {
  const q = entry.q?.trim()
  if (q) return q

  const filters = entry.filters ?? {}

  const projectId = filters.project?.[0]
  if (projectId) {
    const label = lookups.projectLabels?.[projectId] ?? projectId
    const extra = (filters.project?.length ?? 0) > 1 ? ` +${filters.project!.length - 1}` : ''
    return `Proyecto: ${label}${extra}`
  }

  if (entry.status?.length) {
    const label = STATUS_LABELS_ES[entry.status[0]] ?? entry.status[0]
    const extra = entry.status.length > 1 ? ` +${entry.status.length - 1}` : ''
    return `${label}${extra}`
  }

  if (entry.priority?.length) {
    const label = PRIORITY_LABELS_ES[entry.priority[0]] ?? entry.priority[0]
    const extra = entry.priority.length > 1 ? ` +${entry.priority.length - 1}` : ''
    return `Prioridad ${label}${extra}`
  }

  const assigneeId = filters.assignee?.[0]
  if (assigneeId) {
    const label = lookups.assigneeLabels?.[assigneeId] ?? assigneeId
    const extra = (filters.assignee?.length ?? 0) > 1 ? ` +${filters.assignee!.length - 1}` : ''
    return `${label}${extra}`
  }

  if (filters.severity?.length) {
    const label = SEVERITY_LABELS_ES[filters.severity[0]] ?? filters.severity[0]
    const extra = filters.severity.length > 1 ? ` +${filters.severity.length - 1}` : ''
    return `${label}${extra}`
  }

  if (filters.dateFrom || filters.dateTo) {
    return 'Fecha activa'
  }

  if (filters.hasEvidence && filters.hasEvidence !== 'any') {
    return filters.hasEvidence === 'with' ? 'Con evidencia' : 'Sin evidencia'
  }

  return undefined
}
