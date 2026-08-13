'use client'

import { X } from 'lucide-react'
import { AdvancedFilterValues, LookupOption, DateFilterType } from '@/lib/types/search'
import { STATUS_LABELS_ES, PRIORITY_LABELS_ES, SEVERITY_LABELS_ES } from '@/lib/constants/finding-options'

interface FilterPreviewProps {
  filters: {
    status?: string[]
    priority?: string[]
    severity?: string[]
    assignee?: string[]
    project?: string[]
    dateType?: DateFilterType
    dateFrom?: string
    dateTo?: string
    hasEvidence?: 'any' | 'with' | 'without'
  }
  assigneeLabels?: Record<string, string>
  projectLabels?: Record<string, string>
  onRemoveStatus?: (status: string) => void
  onRemovePriority?: (priority: string) => void
  onRemoveSeverity?: (severity: string) => void
  onRemoveAssignee?: (id: string) => void
  onRemoveProject?: (id: string) => void
  onRemoveDateRange?: () => void
  onRemoveEvidence?: () => void
  onClearAll?: () => void
}

export function FilterPreview({
  filters,
  assigneeLabels = {},
  projectLabels = {},
  onRemoveStatus,
  onRemovePriority,
  onRemoveSeverity,
  onRemoveAssignee,
  onRemoveProject,
  onRemoveDateRange,
  onRemoveEvidence,
  onClearAll,
}: FilterPreviewProps) {
  const hasAnyFilter = Boolean(
    filters.status?.length ||
    filters.priority?.length ||
    filters.severity?.length ||
    filters.assignee?.length ||
    filters.project?.length ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.hasEvidence !== 'any' && filters.hasEvidence !== undefined
  )

  if (!hasAnyFilter) return null

  const getDateTypeLabel = (dateType?: DateFilterType): string => {
    switch (dateType) {
      case 'updated':
        return 'Actualizado'
      case 'imported':
        return 'Importado'
      case 'session':
        return 'Sesión'
      default:
        return 'Fecha'
    }
  }

  const formatDateRange = () => {
    if (!filters.dateFrom && !filters.dateTo) return null

    const from = filters.dateFrom ? new Date(filters.dateFrom).toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric',
    }) : null

    const to = filters.dateTo ? new Date(filters.dateTo).toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric',
    }) : null

    if (from && to) return `${from}–${to}`
    if (from) return `Desde ${from}`
    if (to) return `Hasta ${to}`
    return null
  }

  const dateRangeLabel = formatDateRange()
  const dateTypeLabel = getDateTypeLabel(filters.dateType)

  return (
    <div className="flex flex-wrap gap-2 items-center px-4 py-2" style={{ backgroundColor: '#f3f5ef', borderBottom: '1px solid #dbe4dd' }}>
      {/* Status filters */}
      {filters.status?.map((status) => (
        <div
          key={`status-${status}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#dbe4dd] rounded text-xs font-medium text-[#17251f] hover:bg-[#f3f5ef]"
        >
          <span>Estado: {STATUS_LABELS_ES[status] || status}</span>
          {onRemoveStatus && (
            <button
              onClick={() => onRemoveStatus(status)}
              className="ml-0.5 p-0 hover:text-slate-900 focus-visible:ring-1 focus-visible:ring-offset-0"
              aria-label={`Remover filtro de estado ${status}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      {/* Priority filters */}
      {filters.priority?.map((priority) => (
        <div
          key={`priority-${priority}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#dbe4dd] rounded text-xs font-medium text-[#17251f] hover:bg-[#f3f5ef]"
        >
          <span>Prioridad: {PRIORITY_LABELS_ES[priority] || priority}</span>
          {onRemovePriority && (
            <button
              onClick={() => onRemovePriority(priority)}
              className="ml-0.5 p-0 hover:text-slate-900 focus-visible:ring-1 focus-visible:ring-offset-0"
              aria-label={`Remover filtro de prioridad ${priority}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      {/* Severity filters */}
      {filters.severity?.map((severity) => (
        <div
          key={`severity-${severity}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#dbe4dd] rounded text-xs font-medium text-[#17251f] hover:bg-[#f3f5ef]"
        >
          <span>Severidad: {SEVERITY_LABELS_ES[severity] || severity}</span>
          {onRemoveSeverity && (
            <button
              onClick={() => onRemoveSeverity(severity)}
              className="ml-0.5 p-0 hover:text-slate-900 focus-visible:ring-1 focus-visible:ring-offset-0"
              aria-label={`Remover filtro de severidad ${severity}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      {/* Assignee filters */}
      {filters.assignee?.map((id) => (
        <div
          key={`assignee-${id}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#dbe4dd] rounded text-xs font-medium text-[#17251f] hover:bg-[#f3f5ef]"
        >
          <span>Asignado: {assigneeLabels[id] || id}</span>
          {onRemoveAssignee && (
            <button
              onClick={() => onRemoveAssignee(id)}
              className="ml-0.5 p-0 hover:text-slate-900 focus-visible:ring-1 focus-visible:ring-offset-0"
              aria-label={`Remover filtro de asignación`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      {/* Project filters */}
      {filters.project?.map((id) => (
        <div
          key={`project-${id}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#dbe4dd] rounded text-xs font-medium text-[#17251f] hover:bg-[#f3f5ef]"
        >
          <span>Proyecto: {projectLabels[id] || id}</span>
          {onRemoveProject && (
            <button
              onClick={() => onRemoveProject(id)}
              className="ml-0.5 p-0 hover:text-slate-900 focus-visible:ring-1 focus-visible:ring-offset-0"
              aria-label={`Remover filtro de proyecto`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      {/* Date range filter */}
      {dateRangeLabel && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#dbe4dd] rounded text-xs font-medium text-[#17251f] hover:bg-[#f3f5ef]">
          <span>{dateTypeLabel}: {dateRangeLabel}</span>
          {onRemoveDateRange && (
            <button
              onClick={onRemoveDateRange}
              className="ml-0.5 p-0 hover:text-[#052b20] focus-visible:ring-1 focus-visible:ring-offset-0"
              aria-label="Remover filtro de fecha"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Evidence filter */}
      {filters.hasEvidence && filters.hasEvidence !== 'any' && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-100">
          <span>
            {filters.hasEvidence === 'with' ? 'Con evidencia' : 'Sin evidencia'}
          </span>
          {onRemoveEvidence && (
            <button
              onClick={onRemoveEvidence}
              className="ml-0.5 p-0 hover:text-slate-900 focus-visible:ring-1 focus-visible:ring-offset-0"
              aria-label="Remover filtro de evidencia"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Clear all button */}
      {onClearAll && (
        <button
          onClick={onClearAll}
          className="px-2.5 py-1 text-xs font-medium rounded min-h-[24px]"
          style={{ color: '#0369a1' }}
        >
          Limpiar todo
        </button>
      )}
    </div>
  )
}
