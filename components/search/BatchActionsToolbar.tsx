'use client'

import { DownloadCloud, X, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { LookupOption } from '@/lib/types/search'
import { FINDING_STATUS_OPTIONS, STATUS_LABELS_ES, PRIORITY_LABELS_ES, FINDING_PRIORITY_OPTIONS } from '@/lib/constants/finding-options'
import Papa from 'papaparse'

interface BatchActionsToolbarProps {
  selectedCount: number
  items: Array<{
    id: string
    observation: string
    status: string
    priority: string
    severity: string
    projectId: string
    assigneeId?: string
  }>
  selectedIds: string[]
  onClearSelection: () => void
  onBulkStatus: (status: string) => Promise<void>
  onBulkPriority: (priority: string) => Promise<void>
  onBulkAssign: (assigneeId: string | null) => Promise<void>
  onBulkDelete: () => Promise<void>
  assigneeOptions: LookupOption[]
  isProcessing: boolean
  error: string | null
}

export function BatchActionsToolbar({
  selectedCount,
  items,
  selectedIds,
  onClearSelection,
  onBulkStatus,
  onBulkPriority,
  onBulkAssign,
  onBulkDelete,
  assigneeOptions,
  isProcessing,
  error,
}: BatchActionsToolbarProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const isOverLimit = selectedCount > 100

  const handleExportCsv = () => {
    const selectedItems = items.filter((item) => selectedIds.includes(item.id))
    const assigneeLabels: Record<string, string> = {}
    assigneeOptions.forEach((a) => {
      assigneeLabels[a.id] = a.name
    })

    const csvData = selectedItems.map((item) => ({
      ID: item.id,
      Observación: item.observation,
      Estado: STATUS_LABELS_ES[item.status] || item.status,
      Prioridad: PRIORITY_LABELS_ES[item.priority] || item.priority,
      Severidad: item.severity,
      Proyecto: item.projectId,
      'Asignado a': item.assigneeId ? assigneeLabels[item.assigneeId] || item.assigneeId : '—',
    }))

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = `hallazgos-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="sticky top-0 md:top-12 md:bottom-auto z-30 bg-white border-b border-slate-200 px-4 py-2 md:py-3 flex flex-col gap-2">
      {/* Error message */}
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        {/* Count + Clear button */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
          </span>
          {isOverLimit && (
            <span className="text-xs text-red-600 font-medium">
              (máximo 100)
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-1 md:gap-2 items-center">
          {/* Status dropdown */}
          <select
            onChange={(e) => {
              if (e.target.value) {
                onBulkStatus(e.target.value)
                e.target.value = ''
              }
            }}
            disabled={isProcessing || isOverLimit}
            className="px-2 md:px-3 py-1.5 text-xs md:text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] md:min-h-[40px]"
            aria-label="Cambiar estado"
          >
            <option value="">Estado</option>
            {FINDING_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS_ES[status] || status}
              </option>
            ))}
          </select>

          {/* Priority dropdown */}
          <select
            onChange={(e) => {
              if (e.target.value) {
                onBulkPriority(e.target.value)
                e.target.value = ''
              }
            }}
            disabled={isProcessing || isOverLimit}
            className="px-2 md:px-3 py-1.5 text-xs md:text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] md:min-h-[40px]"
            aria-label="Cambiar prioridad"
          >
            <option value="">Prioridad</option>
            {FINDING_PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS_ES[priority] || priority}
              </option>
            ))}
          </select>

          {/* Assignee dropdown */}
          <select
            onChange={(e) => {
              const value = e.target.value
              if (value !== '' || e.target.value === '') {
                onBulkAssign(value || null)
                e.target.value = ''
              }
            }}
            disabled={isProcessing || isOverLimit}
            className="px-2 md:px-3 py-1.5 text-xs md:text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] md:min-h-[40px]"
            aria-label="Asignar a"
          >
            <option value="">Asignar a</option>
            <option value="null">Sin asignar</option>
            {assigneeOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            disabled={isProcessing || selectedCount === 0}
            className="p-1.5 md:p-2 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] min-w-[36px] md:min-h-[40px] md:min-w-[40px] flex items-center justify-center"
            title="Exportar CSV"
            aria-label="Exportar CSV"
          >
            <DownloadCloud className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          {/* Cancel/Clear */}
          <button onClick={() => setConfirmingDelete(true)} disabled={isProcessing || isOverLimit} className="ml-2 flex min-h-[44px] items-center gap-1 rounded border border-destructive px-3 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50" aria-label={`Eliminar ${selectedCount} hallazgos`}><Trash2 className="h-4 w-4" />Eliminar</button>
          <button
            onClick={onClearSelection}
            disabled={isProcessing}
            className="p-1.5 md:p-2 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] min-w-[36px] md:min-h-[40px] md:min-w-[40px] flex items-center justify-center"
            title="Cancelar selección"
            aria-label="Cancelar selección"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      {confirmingDelete && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-delete-title"><div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"><h2 id="bulk-delete-title" className="text-lg font-semibold">Eliminar {selectedCount} hallazgos</h2><p className="mt-2 text-sm text-[#65766e]">Los hallazgos seleccionados dejarán de aparecer en las vistas activas. El borrado será lógico y quedará auditado.</p><div className="mt-5 flex justify-end gap-2"><button disabled={isProcessing} onClick={() => setConfirmingDelete(false)} className="min-h-11 rounded border border-[#dbe4dd] px-4">Cancelar</button><button disabled={isProcessing} onClick={async () => { await onBulkDelete(); setConfirmingDelete(false) }} className="min-h-11 rounded bg-destructive px-4 text-white disabled:opacity-50">{isProcessing ? 'Eliminando...' : `Eliminar ${selectedCount} hallazgos`}</button></div></div></div>}

      {/* Export tooltip */}
      <div className="text-xs text-slate-500 px-2">
        💡 Exportar descarga solo los elementos seleccionados mostrados
      </div>
    </div>
  )
}
