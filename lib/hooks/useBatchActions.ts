'use client'

import { useState, useCallback } from 'react'
import { BulkUpdateApiResult, BatchActionUpdate } from '@/lib/types/search'

const MAX_BATCH_SIZE = 100

export interface UseBatchActionsReturn {
  selectedIds: string[]
  isSelected: (id: string) => boolean
  toggleSelect: (id: string) => void
  selectMany: (ids: string[]) => void
  clearSelection: () => void
  bulkUpdateStatus: (status: string) => Promise<void>
  bulkUpdatePriority: (priority: string) => Promise<void>
  bulkAssign: (assigneeId: string | null) => Promise<void>
  bulkSetDueDate: (dueDate: string | null) => Promise<void>
  bulkDelete: () => Promise<number>
  isProcessing: boolean
  error: string | null
  lastResult: BulkUpdateApiResult | null
}

export function useBatchActions(): UseBatchActionsReturn {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<BulkUpdateApiResult | null>(null)

  const isSelected = useCallback(
    (id: string) => selectedIds.includes(id),
    [selectedIds]
  )

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }, [])

  const selectMany = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const set = new Set(prev)
      ids.forEach((id) => set.add(id))
      return Array.from(set)
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
    setError(null)
    setLastResult(null)
  }, [])

  const performUpdate = useCallback(
    async (updates: BatchActionUpdate) => {
      if (selectedIds.length === 0) return
      if (selectedIds.length > MAX_BATCH_SIZE) {
        setError(`Máximo ${MAX_BATCH_SIZE} elementos permitidos`)
        return
      }

      setIsProcessing(true)
      setError(null)

      try {
        const response = await fetch('/api/findings/bulk-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: selectedIds,
            updates,
          }),
        })

        const result = await response.json() as BulkUpdateApiResult

        if (response.status === 200) {
          // All successful
          setLastResult(result)
          clearSelection()
        } else if (response.status === 207) {
          // Partial success
          const failedIds = result.results
            .filter((r) => r.error)
            .map((r) => r.id)
          setSelectedIds(failedIds)
          setLastResult(result)
          setError(`${result.failed} elementos fallaron`)
        } else {
          // Error
          const errorMsg = response.status === 401 || response.status === 403
            ? 'No tienes permiso para esta acción'
            : 'Error en la actualización'
          setError(errorMsg)
          setLastResult(result)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        setError(msg)
      } finally {
        setIsProcessing(false)
      }
    },
    [selectedIds, clearSelection]
  )

  const bulkUpdateStatus = useCallback(
    async (status: string) => {
      await performUpdate({ status })
    },
    [performUpdate]
  )

  const bulkUpdatePriority = useCallback(
    async (priority: string) => {
      await performUpdate({ priority })
    },
    [performUpdate]
  )

  const bulkAssign = useCallback(
    async (assigneeId: string | null) => {
      await performUpdate({ assigneeId })
    },
    [performUpdate]
  )

  const bulkSetDueDate = useCallback(
    async (dueDate: string | null) => {
      await performUpdate({ dueDate })
    },
    [performUpdate]
  )

  const bulkDelete = useCallback(async () => {
    if (!selectedIds.length || selectedIds.length > MAX_BATCH_SIZE) return 0
    setIsProcessing(true)
    setError(null)
    try {
      const response = await fetch('/api/findings/bulk-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      })
      if (!response.ok) throw new Error('No se pudieron eliminar los hallazgos')
      const result = await response.json()
      setSelectedIds([])
      return result.deleted ?? selectedIds.length
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al eliminar')
      return 0
    } finally { setIsProcessing(false) }
  }, [selectedIds])

  return {
    selectedIds,
    isSelected,
    toggleSelect,
    selectMany,
    clearSelection,
    bulkUpdateStatus,
    bulkUpdatePriority,
    bulkAssign,
    bulkSetDueDate,
    bulkDelete,
    isProcessing,
    error,
    lastResult,
  }
}
