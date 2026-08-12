'use client'

import { useState, useCallback } from 'react'
import { Finding } from '@/lib/generated/prisma/client'
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
      toast({ title: 'Error', description: 'La descripción es requerida' })
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
        toast({ title: 'Listo', description: 'Resolución creada' })
      } else {
        toast({ title: 'Error', description: response.message })
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear la resolución' })
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
          toast({ title: 'Listo', description: `Estado actualizado a ${newState}` })
          await onStateChange?.(newState)
        } else {
          toast({ title: 'Error', description: response.message })
        }
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar el estado' })
      } finally {
        setIsLoading(false)
      }
    },
    [finding.id, activeResolution, resolutions, onStateChange],
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-xl font-bold text-[#17251f]">Workflow de resolución</h3>

        {/* Resolution list */}
        <div className="mb-4 space-y-2">
          {resolutions.length === 0 ? (
            <p className="text-sm text-[#65766e]">Sin resoluciones registradas</p>
          ) : (
            resolutions.map((res) => (
              <button
                key={res.id}
                onClick={() => setActiveResId(res.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  activeResId === res.id
                    ? 'border-[#00a85a] bg-[#f3fbf5]'
                    : 'border-[#dbe4dd] bg-white hover:border-[#b9c8c0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="truncate text-sm font-semibold text-[#17251f]">{res.description}</p>
                    <p className="text-xs text-[#65766e]">
                      {typeof res.createdAt === 'string' ? new Date(res.createdAt).toLocaleDateString('es-ES') : (res.createdAt instanceof Date ? res.createdAt.toLocaleDateString('es-ES') : '-')}
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
        <div className="space-y-4 rounded-lg border border-[#dbe4dd] bg-[#f7faf5] p-4">
          <div>
            <label className="text-sm font-semibold text-[#3d4d45]">Estado actual</label>
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
              <label className="mb-2 block text-sm font-semibold text-[#3d4d45]">
                Cambiar estado
              </label>
              <div className="flex flex-wrap gap-2">
                {nextStates.map((state) => (
                  <button
                    key={state}
                    onClick={() => handleStateChange(state)}
                    disabled={isLoading}
                    className="rounded-full bg-[#052b20] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b3e30] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {activeResolution.notes && (
            <div>
              <label className="text-sm font-semibold text-[#3d4d45]">Notas</label>
              <p className="mt-1 text-sm text-[#65766e]">
                {activeResolution.notes}
              </p>
            </div>
          )}

          {/* Evidence count */}
          {activeResolution.evidence?.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-[#3d4d45]">Evidencia adjunta</label>
              <p className="text-sm text-[#65766e]">
                {activeResolution.evidence.length} archivo(s)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create new resolution */}
      {!readOnly && (
        <div className="border-t border-[#dbe4dd] pt-4">
          <label className="mb-2 block text-sm font-semibold text-[#3d4d45]">
            Nueva resolución
          </label>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Describe el enfoque de resolución..."
            className="pm-input min-h-24 w-full p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={handleCreateResolution}
            disabled={isLoading || !newDescription.trim()}
            className="mt-2 rounded-full bg-[#052b20] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b3e30] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Creando...' : 'Crear resolución'}
          </button>
        </div>
      )}
    </div>
  )
}
