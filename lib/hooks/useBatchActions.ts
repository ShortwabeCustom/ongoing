'use client'

import { useState, useCallback } from 'react'

export interface BulkUpdateApiResult {
  updated: number
  failed: number
  results: Array<{
    id: string
    status?: string
    priority?: string
    severity?: string
    assigneeId?: string
    version?: number
    error?: string
  }>
}

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
    setSelectedIds(ids)
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
        setError(`Maximum ${MAX_BATCH_SIZE} items can be updated at once`)
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

        const result = await response.json()

        if (response.status === 207) {
          // Partial success: keep only failed ids selected for retry
          const failedIds = (result.results || [])
            .filter((r: any) => r.error)
            .map((r: any) => r.id)
          setSelectedIds(failedIds)
          setError(`${result.failed} items failed, ${result.updated} updated`)
        } else if (response.ok) {
          // Full success
          setSelectedIds([])
          setError(null)
        } else if (response.status === 401 || response.status === 403) {
          setError('You do not have permission to perform this action')
        } else {
          throw new Error('Request failed')
        }

        setLastResult(result)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        setError(errMsg)
        setLastResult(null)
      } finally {
        setIsProcessing(false)
      }
    },
    [selectedIds],
  )

  const bulkUpdateStatus = useCallback(
    async (status: string) => {
      await performUpdate({ status })
    },
    [performUpdate],
  )

  const bulkUpdatePriority = useCallback(
    async (priority: string) => {
      await performUpdate({ priority })
    },
    [performUpdate],
  )

  const bulkAssign = useCallback(
    async (assigneeId: string | null) => {
      await performUpdate({ assigneeId })
    },
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
    isProcessing,
    error,
    lastResult,
  }
}
