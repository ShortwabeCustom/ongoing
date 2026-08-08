'use client'

import { useState, useCallback } from 'react'
import { Finding } from '@/lib/generated/prisma'
import { WorkflowClient } from '@/lib/api/workflow-client'
import { getAllowedTransitions, ResolutionState } from '@/lib/validators/workflow'
import { WorkflowStateIndicator } from './WorkflowStateIndicator'
import { toast } from '@/components/ui/use-toast'

interface ResolutionWorkflowProps {
  finding: Finding & { resolutions?: any[] }
  onStateChange?: (state: ResolutionState) => Promise<void>
  readOnly?: boolean
}

export function ResolutionWorkflow({
  finding,
  onStateChange,
  readOnly = false,
}: ResolutionWorkflowProps) {
  const [resolutions, setResolutions] = useState(finding.resolutions ?? [])
  const [activeResId, setActiveResId] = useState<string | null>(
    resolutions[0]?.id ?? null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [newDescription, setNewDescription] = useState('')

  const activeResolution = resolutions.find((r) => r.id === activeResId)
  const nextStates = activeResolution
    ? getAllowedTransitions(activeResolution.state as ResolutionState)
    : []

  const handleCreateResolution = useCallback(async () => {
    if (!newDescription.trim()) {
      toast({ title: 'Error', description: 'Description is required' })
      return
    }

    try {
      setIsLoading(true)
      const response = await WorkflowClient.createResolution(finding.id, {
        description: newDescription,
      })

      if (response.status === 'success') {
        setResolutions([response.data, ...resolutions])
        setActiveResId(response.data.id)
        setNewDescription('')
        toast({ title: 'Success', description: 'Resolution created' })
      } else {
        toast({ title: 'Error', description: response.message })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create resolution' })
    } finally {
      setIsLoading(false)
    }
  }, [finding.id, newDescription, resolutions])

  const handleStateChange = useCallback(
    async (newState: ResolutionState) => {
      if (!activeResolution) return

      try {
        setIsLoading(true)
        const response = await WorkflowClient.updateResolutionState(
          finding.id,
          activeResolution.id,
          { state: newState },
        )

        if (response.status === 'success') {
          setResolutions(
            resolutions.map((r) =>
              r.id === activeResolution.id ? response.data : r,
            ),
          )
          toast({ title: 'Success', description: `State changed to ${newState}` })
          await onStateChange?.(newState)
        } else {
          toast({ title: 'Error', description: response.message })
        }
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to update state' })
      } finally {
        setIsLoading(false)
      }
    },
    [finding.id, activeResolution, resolutions, onStateChange],
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Resolution Workflow</h3>

        {/* Resolution list */}
        <div className="space-y-2 mb-4">
          {resolutions.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No resolutions yet</p>
          ) : (
            resolutions.map((res) => (
              <button
                key={res.id}
                onClick={() => setActiveResId(res.id)}
                className={`w-full text-left p-3 rounded-lg border-2 transition ${
                  activeResId === res.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm truncate">{res.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(res.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <WorkflowStateIndicator state={res.state} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Active resolution details */}
      {activeResolution && (
        <div className="border rounded-lg p-4 space-y-4">
          <div>
            <label className="text-sm font-semibold">Current State</label>
            <div className="mt-2">
              <WorkflowStateIndicator
                state={activeResolution.state}
                variant="expanded"
              />
            </div>
          </div>

          {/* State transition buttons */}
          {!readOnly && nextStates.length > 0 && (
            <div>
              <label className="text-sm font-semibold mb-2 block">
                Change State
              </label>
              <div className="flex flex-wrap gap-2">
                {nextStates.map((state) => (
                  <button
                    key={state}
                    onClick={() => handleStateChange(state)}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    → {state}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {activeResolution.notes && (
            <div>
              <label className="text-sm font-semibold">Notes</label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {activeResolution.notes}
              </p>
            </div>
          )}

          {/* Evidence count */}
          {activeResolution.evidence?.length > 0 && (
            <div>
              <label className="text-sm font-semibold">Evidence Attached</label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {activeResolution.evidence.length} file(s)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create new resolution */}
      {!readOnly && (
        <div className="border-t pt-4">
          <label className="text-sm font-semibold block mb-2">
            New Resolution
          </label>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Describe the resolution approach..."
            className="w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={handleCreateResolution}
            disabled={isLoading || !newDescription.trim()}
            className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Creating...' : 'Create Resolution'}
          </button>
        </div>
      )}
    </div>
  )
}
