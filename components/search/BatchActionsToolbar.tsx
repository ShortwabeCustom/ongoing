'use client'

import { Download, X } from 'lucide-react'
import { STATUS_LABELS_ES, PRIORITY_LABELS_ES, FINDING_STATUS_OPTIONS, FINDING_PRIORITY_OPTIONS } from '@/lib/constants/finding-options'
import { LookupOption } from '@/lib/types/search'

interface BatchActionsToolbarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkStatus: (status: string) => void
  onBulkPriority: (priority: string) => void
  onBulkAssign: (assigneeId: string | null) => void
  onExportCsv: () => void
  assigneeOptions: LookupOption[]
  isProcessing: boolean
  error: string | null
  maxBatchSize: number
}

export function BatchActionsToolbar({
  selectedCount,
  onClearSelection,
  onBulkStatus,
  onBulkPriority,
  onBulkAssign,
  onExportCsv,
  assigneeOptions,
  isProcessing,
  error,
  maxBatchSize,
}: BatchActionsToolbarProps) {
  const exceedsMax = selectedCount > maxBatchSize
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // Desktop: sticky top-0
  // Mobile: sticky bottom-0 (inside sheet)

  return (
    <div
      className={`${isMobile ? 'sticky bottom-0' : 'sticky top-0'} bg-white border-b border-slate-200 p-4 z-30 ${error ? 'border-red-200 bg-red-50' : ''}`}
      role="toolbar"
      aria-label="Acciones en lote"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Counter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" aria-live="polite">
            {selectedCount} seleccionados
          </span>
          {exceedsMax && <span className="text-xs text-red-700">Máximo {maxBatchSize} permitidos</span>}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {/* Status dropdown */}
          <div className="relative">
            <label htmlFor="status-select" className="sr-only">
              Cambiar estado
            </label>
            <select
              id="status-select"
              disabled={exceedsMax || isProcessing}
              onChange={(e) => {
                if (e.target.value) onBulkStatus(e.target.value)
              }}
              defaultValue=""
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Cambiar estado de todos los seleccionados"
            >
              <option value="" disabled>
                Estado
              </option>
              {FINDING_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS_ES[status]}
                </option>
              ))}
            </select>
          </div>

          {/* Priority dropdown */}
          <div className="relative">
            <label htmlFor="priority-select" className="sr-only">
              Cambiar prioridad
            </label>
            <select
              id="priority-select"
              disabled={exceedsMax || isProcessing}
              onChange={(e) => {
                if (e.target.value) onBulkPriority(e.target.value)
              }}
              defaultValue=""
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Cambiar prioridad de todos los seleccionados"
            >
              <option value="" disabled>
                Prioridad
              </option>
              {FINDING_PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS_ES[priority]}
                </option>
              ))}
            </select>
          </div>

          {/* Assign dropdown */}
          <div className="relative">
            <label htmlFor="assign-select" className="sr-only">
              Asignar a
            </label>
            <select
              id="assign-select"
              disabled={exceedsMax || isProcessing}
              onChange={(e) => {
                const value = e.target.value
                onBulkAssign(value === '' ? null : value)
              }}
              defaultValue=""
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Asignar a todos los seleccionados"
            >
              <option value="" disabled>
                Asignar a
              </option>
              <option value="">Sin asignar</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </select>
          </div>

          {/* Export CSV */}
          <button
            onClick={onExportCsv}
            disabled={isProcessing}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 [@media(hover:hover)]:hover:bg-slate-50"
            title="Exportar seleccionados a CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Exportar CSV</span>
          </button>

          {/* Cancel/Clear */}
          <button
            onClick={onClearSelection}
            disabled={isProcessing}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 [@media(hover:hover)]:hover:bg-slate-50"
            title="Cancelar selección"
          >
            <X className="w-4 h-4" />
            <span className="hidden md:inline">Cancelar</span>
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && <div className="mt-2 text-xs text-red-700">{error}</div>}
    </div>
  )
}
