'use client'

import { X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { AdvancedFilterValues } from '@/lib/types/search'
import { STATUS_LABELS_ES, PRIORITY_LABELS_ES, SEVERITY_LABELS_ES } from '@/lib/constants/finding-options'

interface FilterPreviewProps {
  filters: AdvancedFilterValues
  assigneeLabels: Record<string, string>
  projectLabels: Record<string, string>
  onRemoveStatus: (status: string) => void
  onRemovePriority: (priority: string) => void
  onRemoveSeverity: (severity: string) => void
  onRemoveAssignee: (id: string) => void
  onRemoveProject: (id: string) => void
  onRemoveDateRange: () => void
  onRemoveEvidence: () => void
  onClearAll: () => void
}

export function FilterPreview({
  filters,
  assigneeLabels,
  projectLabels,
  onRemoveStatus,
  onRemovePriority,
  onRemoveSeverity,
  onRemoveAssignee,
  onRemoveProject,
  onRemoveDateRange,
  onRemoveEvidence,
  onClearAll,
}: FilterPreviewProps) {
  // Count active filters
  const statusCount = filters.status?.length || 0
  const priorityCount = filters.priority?.length || 0
  const severityCount = filters.severity?.length || 0
  const assigneeCount = filters.assignee?.length || 0
  const projectCount = filters.project?.length || 0
  const hasDateRange = filters.dateFrom || filters.dateTo
  const hasEvidence = filters.hasEvidence !== undefined

  const totalCount =
    statusCount +
    priorityCount +
    severityCount +
    assigneeCount +
    projectCount +
    (hasDateRange ? 1 : 0) +
    (hasEvidence ? 1 : 0)

  if (totalCount === 0) {
    return null
  }

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768

  // Mobile: show limited, add "+N más"
  if (!isDesktop && totalCount > 3) {
    return (
      <div className="flex overflow-x-auto gap-2 items-center py-2 px-3 bg-slate-50 rounded-lg">
        {/* First 3 filters */}
        {filters.status?.slice(0, 1).map((status) => (
          <button
            key={`status-${status}`}
            onClick={() => onRemoveStatus(status)}
            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {STATUS_LABELS_ES[status]}
            <X className="w-3 h-3" />
          </button>
        ))}

        {filters.priority?.slice(0, 1).map((priority) => (
          <button
            key={`priority-${priority}`}
            onClick={() => onRemovePriority(priority)}
            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {PRIORITY_LABELS_ES[priority]}
            <X className="w-3 h-3" />
          </button>
        ))}

        {/* +N más button */}
        {totalCount > 3 && (
          <span className="inline-block px-2 py-1 text-xs font-medium text-slate-600 shrink-0">
            +{totalCount - 3} más
          </span>
        )}

        {/* Limpiar todo */}
        <button
          onClick={onClearAll}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 shrink-0 min-h-[44px] md:min-h-auto focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Limpiar todo
        </button>
      </div>
    )
  }

  // Desktop: show all
  return (
    <div className="flex flex-wrap gap-2 items-center py-2 px-3 bg-slate-50 rounded-lg">
      {/* Status chips */}
      {filters.status?.map((status) => (
        <button
          key={`status-${status}`}
          onClick={() => onRemoveStatus(status)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label={`Quitar filtro ${STATUS_LABELS_ES[status]}`}
        >
          {STATUS_LABELS_ES[status]}
          <X className="w-3 h-3" />
        </button>
      ))}

      {/* Priority chips */}
      {filters.priority?.map((priority) => (
        <button
          key={`priority-${priority}`}
          onClick={() => onRemovePriority(priority)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label={`Quitar filtro ${PRIORITY_LABELS_ES[priority]}`}
        >
          {PRIORITY_LABELS_ES[priority]}
          <X className="w-3 h-3" />
        </button>
      ))}

      {/* Severity chips */}
      {filters.severity?.map((severity) => (
        <button
          key={`severity-${severity}`}
          onClick={() => onRemoveSeverity(severity)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label={`Quitar filtro ${SEVERITY_LABELS_ES[severity]}`}
        >
          {SEVERITY_LABELS_ES[severity]}
          <X className="w-3 h-3" />
        </button>
      ))}

      {/* Assignee chips */}
      {filters.assignee?.map((id) => (
        <button
          key={`assignee-${id}`}
          onClick={() => onRemoveAssignee(id)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label={`Quitar filtro ${assigneeLabels[id] || id}`}
        >
          {assigneeLabels[id] || id}
          <X className="w-3 h-3" />
        </button>
      ))}

      {/* Project chips */}
      {filters.project?.map((id) => (
        <button
          key={`project-${id}`}
          onClick={() => onRemoveProject(id)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label={`Quitar filtro ${projectLabels[id] || id}`}
        >
          {projectLabels[id] || id}
          <X className="w-3 h-3" />
        </button>
      ))}

      {/* Date range chip */}
      {hasDateRange && (
        <button
          onClick={onRemoveDateRange}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Quitar filtro de fecha"
        >
          {filters.dateFrom && filters.dateTo
            ? `${format(new Date(filters.dateFrom), 'd MMM', { locale: es })}–${format(new Date(filters.dateTo), 'd MMM', { locale: es })}`
            : filters.dateFrom
              ? `desde ${format(new Date(filters.dateFrom), 'd MMM', { locale: es })}`
              : `hasta ${format(new Date(filters.dateTo!), 'd MMM', { locale: es })}`}
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Evidence chip */}
      {hasEvidence && (
        <button
          onClick={onRemoveEvidence}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Quitar filtro de evidencia"
        >
          {filters.hasEvidence ? 'Con evidencia' : 'Sin evidencia'}
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Clear all button */}
      <button
        onClick={onClearAll}
        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-xs font-medium text-slate-700 ml-auto min-h-[44px] md:min-h-[24px] focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        Limpiar todo
      </button>
    </div>
  )
}
