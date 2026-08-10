'use client'

import { Download, X } from 'lucide-react'
import { STATUS_LABELS_ES, PRIORITY_LABELS_ES, FINDING_STATUS_OPTIONS, FINDING_PRIORITY_OPTIONS } from '@/lib/constants/finding-options'
import type { LookupOption } from '@/lib/types/search'

interface BatchActionsToolbarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkStatus: (status: string) => void
  onBulkPriority: (priority: string) => void
  onBulkAssign: (assigneeId: string | null) => void
  onBulkSetDueDate: (dueDate: string) => void
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
  onBulkSetDueDate,
  onExportCsv,
  assigneeOptions,
  isProcessing,
  error,
  maxBatchSize,
}: BatchActionsToolbarProps) {
  const isDisabled = isProcessing || selectedCount > maxBatchSize

  return (
    <div className="sticky top-0 md:top-[50px] z-20 bg-white border-b border-slate-200 p-3 md:p-4">
      {/* Error banner */}
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Selection count + warning if over max */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-900" role="status" aria-live="polite">
            {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
          </span>
          {selectedCount > maxBatchSize && (
            <span className="text-xs text-red-600 font-medium">
              Máximo {maxBatchSize} permitidos
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status dropdown */}
          <div>
            <label className="sr-only">Cambiar estado</label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onBulkStatus(e.target.value)
                }
                e.target.value = ''
              }}
              disabled={isDisabled}
              className="px-3 py-2 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[44px] md:min-h-[32px]"
            >
              <option value="">Estado</option>
              {FINDING_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS_ES[status]}
                </option>
              ))}
            </select>
          </div>

          {/* Priority dropdown */}
          <div>
            <label className="sr-only">Cambiar prioridad</label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onBulkPriority(e.target.value)
                }
                e.target.value = ''
              }}
              disabled={isDisabled}
              className="px-3 py-2 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[44px] md:min-h-[32px]"
            >
              <option value="">Prioridad</option>
              {FINDING_PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS_ES[priority]}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee dropdown */}
          <div>
            <label className="sr-only">Asignar a</label>
            <select
              onChange={(e) => {
                const val = e.target.value
                onBulkAssign(val || null)
                e.target.value = ''
              }}
              disabled={isDisabled}
              className="px-3 py-2 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[44px] md:min-h-[32px]"
            >
              <option value="">Asignar a</option>
              <option value="">Sin asignar</option>
              {assigneeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Export button */}
          <button
            onClick={onExportCsv}
            disabled={isDisabled}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[44px] md:min-h-[32px]"
            title="Exporta los elementos seleccionados cargados en pantalla"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>

          {/* Cancel / Clear button */}
          <button
            onClick={onClearSelection}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[44px] md:min-h-[32px]"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Cancelar</span>
          </button>
        </div>
      </div>
    </div>
  )
}
