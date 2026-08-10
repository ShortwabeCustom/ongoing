'use client'

import { STATUS_COLORS, PRIORITY_COLORS, SEVERITY_COLORS } from '@/lib/constants/finding-options'

interface SearchResultItemProps {
  id: string
  observation: string
  highlightedObservation?: string
  status: string
  priority: string
  severity: string
  projectId: string
  assigneeId?: string
  selected: boolean
  onToggleSelect: (id: string) => void
  showCheckbox: boolean
}

export function SearchResultItem({
  id,
  observation,
  highlightedObservation,
  status,
  priority,
  severity,
  projectId,
  assigneeId,
  selected,
  onToggleSelect,
  showCheckbox,
}: SearchResultItemProps) {
  const displayObservation = highlightedObservation || observation

  return (
    <div className="flex items-start gap-2">
      {showCheckbox && (
        <label
          className="flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer shrink-0 mt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(id)}
            aria-label={`Seleccionar hallazgo ${id}`}
            className="w-5 h-5 rounded border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
        </label>
      )}

      <div className="flex flex-col gap-2 border-l-2 border-slate-200 pl-3 flex-1 min-w-0">
        <div
          className="text-base md:text-sm text-slate-800 line-clamp-2"
          dangerouslySetInnerHTML={{
            __html: displayObservation,
          }}
        />

        <div className="flex flex-wrap gap-2">
          <span className={`inline-block px-2.5 py-1.5 md:px-2 md:py-1 rounded text-xs font-medium ${STATUS_COLORS[status] || 'bg-slate-100'}`}>
            {status}
          </span>
          <span className={`inline-block px-2.5 py-1.5 md:px-2 md:py-1 rounded text-xs font-medium ${PRIORITY_COLORS[priority] || 'bg-slate-100'}`}>
            {priority}
          </span>
          <span className={`inline-block px-2.5 py-1.5 md:px-2 md:py-1 rounded text-xs font-medium ${SEVERITY_COLORS[severity] || 'bg-slate-100'}`}>
            {severity}
          </span>
        </div>
      </div>
    </div>
  )
}
