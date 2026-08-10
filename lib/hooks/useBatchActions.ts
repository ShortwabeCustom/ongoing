'use client'

import { useCallback, useState } from 'react'
import type { BulkUpdateApiResult } from '@/lib/types/search'

const MAX_BATCH_SIZE = 100

export function useBatchActions() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<BulkUpdateApiResult | null>(null)

  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const selectMany = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const set = new Set([...prev, ...ids])
      return Array.from(set)
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
    setError(null)
    setLastResult(null)
  }, [])

  const performUpdate = useCallback(
    async (updates: Record<string, any>) => {
      if (selectedIds.length === 0) {
        setError('No items selected')
        return
      }

      if (selectedIds.length > MAX_BATCH_SIZE) {
        setError(`Maximum ${MAX_BATCH_SIZE} items allowed per batch`)
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

        const result: BulkUpdateApiResult = await response.json()
        setLastResult(result)

        if (!response.ok) {
          if (response.status === 207) {
            // Partial success: keep failed items selected
            const failedIds = result.results
              .filter((r) => r.error)
              .map((r) => r.id)
            setSelectedIds(failedIds)
            setError(
              `${result.failed} item(s) failed. Keep retrying selected items.`,
            )
          } else {
            // Full failure
            setError(result.results?.[0]?.error || 'Batch update failed')
            // Keep selection intact for retry
          }
        } else {
          // Success
          clearSelection()
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error'
        setError(msg)
      } finally {
        setIsProcessing(false)
      }
    },
    [selectedIds, clearSelection],
  )

  const bulkUpdateStatus = useCallback(
    (status: string) => performUpdate({ status }),
    [performUpdate],
  )

  const bulkUpdatePriority = useCallback(
    (priority: string) => performUpdate({ priority }),
    [performUpdate],
  )

  const bulkAssign = useCallback(
    (assigneeId: string | null) => performUpdate({ assigneeId }),
    [performUpdate],
  )

  const bulkSetDueDate = useCallback(
    (dueDate: string) => performUpdate({ dueDate }),
    [performUpdate],
  )

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
    isProcessing,
    error,
    lastResult,
  }
}
