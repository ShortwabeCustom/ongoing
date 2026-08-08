'use client'

import { useState, useEffect } from 'react'
import { WorkflowClient } from '@/lib/api/workflow-client'
import { AuditLogFilter } from '@/lib/validators/workflow'
import { toast } from '@/components/ui/use-toast'

interface AuditTrailViewerProps {
  findingId: string
  limit?: number
  compact?: boolean
}

export function AuditTrailViewer({
  findingId,
  limit = 50,
  compact = false,
}: AuditTrailViewerProps) {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<Partial<AuditLogFilter>>({
    limit,
    offset: 0,
  })

  useEffect(() => {
    loadAuditLog()
  }, [filter])

  const loadAuditLog = async () => {
    try {
      setIsLoading(true)
      const response = await WorkflowClient.getAuditLog(findingId, filter)

      if (response.status === 'success') {
        setLogs(response.data.items)
        setTotal(response.data.total)
      } else {
        toast({ title: 'Error', description: response.message })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load audit log' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const blob = await WorkflowClient.exportAuditLog(findingId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${findingId}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Success', description: 'Audit log exported' })
    } catch (error) {
      toast({ title: 'Error', description: 'Export failed' })
    }
  }

  if (compact && logs.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No audit history yet</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Audit Trail</h3>
        {!compact && (
          <button
            onClick={handleExport}
            disabled={isLoading}
            className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Filter section */}
      {!compact && (
        <div className="flex gap-2 flex-wrap">
          <select
            value={filter.action ?? ''}
            onChange={(e) =>
              setFilter({ ...filter, action: e.target.value || undefined, offset: 0 })
            }
            className="px-3 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="STATE_CHANGED">State Changed</option>
            <option value="VALIDATED">Validated</option>
            <option value="EVIDENCE_ATTACHED">Evidence Attached</option>
          </select>
        </div>
      )}

      {/* Audit log entries */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No audit entries</p>
        ) : (
          logs.slice(0, compact ? 5 : limit).map((log) => (
            <div key={log.id} className="p-3 border rounded-lg text-sm space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{log.action}</span>
                  {log.actor && (
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      by {log.actor.name}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(log.createdAt).toLocaleDateString()} at{' '}
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>
              </div>

              {log.changes && (
                <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  {log.changes.before && log.changes.after ? (
                    <div>
                      <span>Changes: </span>
                      {Object.entries(log.changes.after).map(([key, value]) => {
                        const before = log.changes.before?.[key]
                        if (before === value) return null
                        return (
                          <div key={key}>
                            {key}: {before} → {value}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div>No changes recorded</div>
                  )}
                </div>
              )}

              {log.details && (
                <p className="text-xs text-gray-600 dark:text-gray-400">{log.details}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!compact && total > filter.limit! && (
        <div className="flex gap-2 justify-center mt-4">
          <button
            onClick={() =>
              setFilter({
                ...filter,
                offset: Math.max(0, (filter.offset ?? 0) - (filter.limit ?? 50)),
              })
            }
            disabled={isLoading || (filter.offset ?? 0) === 0}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center px-2">
            Page {Math.floor((filter.offset ?? 0) / (filter.limit ?? 50)) + 1}
          </span>
          <button
            onClick={() =>
              setFilter({
                ...filter,
                offset:
                  ((filter.offset ?? 0) + (filter.limit ?? 50)) < total
                    ? (filter.offset ?? 0) + (filter.limit ?? 50)
                    : filter.offset,
              })
            }
            disabled={isLoading || ((filter.offset ?? 0) + (filter.limit ?? 50)) >= total}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
