'use client'

import { X } from 'lucide-react'
import { STATUS_LABELS_ES, PRIORITY_LABELS_ES, SEVERITY_LABELS_ES } from '@/lib/constants/finding-options'
import { AdvancedFilterValues } from '@/lib/types/search'

interface FilterPreviewProps {
  status: string[]
  priority: string[]
  severity: string[]
  filters: AdvancedFilterValues
  onRemoveStatus: (status: string) => void
  onRemovePriority: (priority: string) => void
  onRemoveSeverity: (severity: string) => void
  onRemoveAssignee: (id: string) => void
  onRemoveProject: (id: string) => void
  onRemoveDateRange: () => void
  onRemoveHasEvidence: () => void
  onClearAll: () => void
  assigneeLabels?: Record<string, string>
  projectLabels?: Record<string, string>
}

export function FilterPreview({
  status,
  priority,
  severity,
  filters,
  onRemoveStatus,
  onRemovePriority,
  onRemoveSeverity,
  onRemoveAssignee,
  onRemoveProject,
  onRemoveDateRange,
  onRemoveHasEvidence,
  onClearAll,
  assigneeLabels = {},
  projectLabels = {},
}: FilterPreviewProps) {
  // Count active filters
  const activeCount =
    status.length +
    priority.length +
    severity.length +
    filters.assignee.length +
    filters.project.length +
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.hasEvidence !== undefined ? 1 : 0)

  if (activeCount === 0) return null

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex overflow-x-auto gap-2 pb-1">
          {status.map((s) => (
            <button
              key={s}
              onClick={() => onRemoveStatus(s)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium shrink-0 hover:bg-blue-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label={`Remover filtro: Estado ${STATUS_LABELS_ES[s]}`}
            >
              Estado: {STATUS_LABELS_ES[s]} <X className="w-3 h-3" />
            </button>
          ))}

          {priority.map((p) => (
            <button
              key={p}
              onClick={() => onRemovePriority(p)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium shrink-0 hover:bg-yellow-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label={`Remover filtro: Prioridad ${PRIORITY_LABELS_ES[p]}`}
            >
              Prioridad: {PRIORITY_LABELS_ES[p]} <X className="w-3 h-3" />
            </button>
          ))}

          {severity.map((sev) => (
            <button
              key={sev}
              onClick={() => onRemoveSeverity(sev)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium shrink-0 hover:bg-orange-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label={`Remover filtro: Severidad ${SEVERITY_LABELS_ES[sev]}`}
            >
              Sev: {SEVERITY_LABELS_ES[sev]} <X className="w-3 h-3" />
            </button>
          ))}

          {filters.assignee.map((id) => (
            <button
              key={id}
              onClick={() => onRemoveAssignee(id)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium shrink-0 hover:bg-purple-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label={`Remover asignado: ${assigneeLabels[id] || id}`}
            >
              {assigneeLabels[id] || id} <X className="w-3 h-3" />
            </button>
          ))}

          {filters.project.map((id) => (
            <button
              key={id}
              onClick={() => onRemoveProject(id)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium shrink-0 hover:bg-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label={`Remover proyecto: ${projectLabels[id] || id}`}
            >
              {projectLabels[id] || id} <X className="w-3 h-3" />
            </button>
          ))}

          {(filters.dateFrom || filters.dateTo) && (
            <button
              onClick={onRemoveDateRange}
              className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium shrink-0 hover:bg-green-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Remover rango de fechas"
            >
              Fecha {filters.dateFrom && `desde ${filters.dateFrom}`} {filters.dateTo && `a ${filters.dateTo}`}{' '}
              <X className="w-3 h-3" />
            </button>
          )}

          {filters.hasEvidence !== undefined && (
            <button
              onClick={onRemoveHasEvidence}
              className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium shrink-0 hover:bg-red-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label={`Remover: ${filters.hasEvidence ? 'Con' : 'Sin'} evidencia`}
            >
              {filters.hasEvidence ? 'Con' : 'Sin'} evidencia <X className="w-3 h-3" />
            </button>
          )}

          {activeCount > 5 && (
            <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium shrink-0">
              +{activeCount - 5} más
            </span>
          )}
        </div>

        <button
          onClick={onClearAll}
          className="min-h-[44px] px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Limpiar todo
        </button>
      </div>
    )
  }

  // Desktop: flex wrap
  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex flex-wrap gap-2">
        {status.map((s) => (
          <button
            key={s}
            onClick={() => onRemoveStatus(s)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={`Remover filtro: Estado ${STATUS_LABELS_ES[s]}`}
          >
            Estado: {STATUS_LABELS_ES[s]} <X className="w-3 h-3" />
          </button>
        ))}

        {priority.map((p) => (
          <button
            key={p}
            onClick={() => onRemovePriority(p)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded text-xs font-medium hover:bg-yellow-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={`Remover filtro: Prioridad ${PRIORITY_LABELS_ES[p]}`}
          >
            Prioridad: {PRIORITY_LABELS_ES[p]} <X className="w-3 h-3" />
          </button>
        ))}

        {severity.map((sev) => (
          <button
            key={sev}
            onClick={() => onRemoveSeverity(sev)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded text-xs font-medium hover:bg-orange-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={`Remover filtro: Severidad ${SEVERITY_LABELS_ES[sev]}`}
          >
            Sev: {SEVERITY_LABELS_ES[sev]} <X className="w-3 h-3" />
          </button>
        ))}

        {filters.assignee.map((id) => (
          <button
            key={id}
            onClick={() => onRemoveAssignee(id)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded text-xs font-medium hover:bg-purple-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={`Remover asignado: ${assigneeLabels[id] || id}`}
          >
            Asignado: {assigneeLabels[id] || id} <X className="w-3 h-3" />
          </button>
        ))}

        {filters.project.map((id) => (
          <button
            key={id}
            onClick={() => onRemoveProject(id)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-xs font-medium hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={`Remover proyecto: ${projectLabels[id] || id}`}
          >
            Proyecto: {projectLabels[id] || id} <X className="w-3 h-3" />
          </button>
        ))}

        {(filters.dateFrom || filters.dateTo) && (
          <button
            onClick={onRemoveDateRange}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded text-xs font-medium hover:bg-green-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Remover rango de fechas"
          >
            Fecha: {filters.dateFrom && `${filters.dateFrom}`} {filters.dateTo && `a ${filters.dateTo}`}{' '}
            <X className="w-3 h-3" />
          </button>
        )}

        {filters.hasEvidence !== undefined && (
          <button
            onClick={onRemoveHasEvidence}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs font-medium hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={`Remover: ${filters.hasEvidence ? 'Con' : 'Sin'} evidencia`}
          >
            {filters.hasEvidence ? 'Con' : 'Sin'} evidencia <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <button
        onClick={onClearAll}
        className="max-w-fit px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        Limpiar todo
      </button>
    </div>
  )
}
