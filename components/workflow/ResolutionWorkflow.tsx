'use client'

import { useState, useCallback } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { Finding } from '@/lib/generated/prisma/client'
import { WorkflowClient } from '@/lib/api/workflow-client'
import {
  getAllowedTransitions,
  RESOLUTION_STATE_FLOW,
  ResolutionState,
} from '@/lib/validators/workflow'
import { STATE_LABELS, WorkflowStateIndicator } from './WorkflowStateIndicator'
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
          toast({
            title: 'Listo',
            description: `Estado actualizado a ${STATE_LABELS[newState]}`,
          })
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

  const handleDeleteResolution = useCallback(
    async (resolutionId: string) => {
      if (
        !window.confirm(
          '¿Quieres eliminar esta resolución? Esta acción no se puede deshacer.',
        )
      ) {
        return
      }

      try {
        setIsLoading(true)
        const response = await WorkflowClient.deleteResolution(
          finding.id,
          resolutionId,
        )

        if (response.status === 'success') {
          const remaining = resolutions.filter(
            (resolution) => resolution.id !== resolutionId,
          )
          setResolutions(remaining)
          if (activeResId === resolutionId) {
            setActiveResId(remaining[0]?.id ?? null)
          }
          toast({ title: 'Listo', description: 'Resolución eliminada' })
        } else {
          toast({
            title: 'Error',
            description:
              response.message ?? 'No se pudo eliminar la resolución',
          })
        }
      } catch {
        toast({ title: 'Error', description: 'No se pudo eliminar la resolución' })
      } finally {
        setIsLoading(false)
      }
    },
    [activeResId, finding.id, resolutions],
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
              <div
                key={res.id}
                className={`flex w-full items-center rounded-lg border transition ${
                  activeResId === res.id
                    ? 'border-[#00a85a] bg-[#f3fbf5]'
                    : 'border-[#dbe4dd] bg-white hover:border-[#b9c8c0]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveResId(res.id)}
                  className="min-w-0 flex-1 p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="truncate text-sm font-semibold text-[#17251f]">
                        {res.description}
                      </p>
                      <p className="text-xs text-[#65766e]">
                        {typeof res.createdAt === 'string'
                          ? new Date(res.createdAt).toLocaleDateString('es-ES')
                          : res.createdAt instanceof Date
                            ? res.createdAt.toLocaleDateString('es-ES')
                            : '-'}
                      </p>
                    </div>
                    <WorkflowStateIndicator state={res.state} />
                  </div>
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDeleteResolution(res.id)}
                    disabled={isLoading}
                    aria-label={`Eliminar resolución: ${res.description}`}
                    title="Eliminar resolución"
                    className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#9b321f] transition hover:bg-[#fff1ee] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
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
          {!readOnly && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#3d4d45]">
                Cambiar estado
              </label>
              <div
                className="flex items-center gap-2 overflow-x-auto pb-2"
                aria-label="Flujo de estados de la resolución"
              >
                {RESOLUTION_STATE_FLOW.map((state, index) => {
                  const isCurrent = state === activeResolution.state
                  const isPast =
                    index <
                    RESOLUTION_STATE_FLOW.indexOf(
                      activeResolution.state as ResolutionState,
                    )
                  const isAllowed = nextStates.includes(state)

                  return (
                    <div key={state} className="flex shrink-0 items-center gap-2">
                      {index > 0 && (
                        <span className="text-[#9aaba2]" aria-hidden="true">
                          →
                        </span>
                      )}
                      <button
                        onClick={() => handleStateChange(state)}
                        disabled={isLoading || !isAllowed || isCurrent}
                        aria-current={isCurrent ? 'step' : undefined}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
                          isCurrent
                            ? 'bg-[#052b20] text-white ring-2 ring-[#7bf0b1] ring-offset-2'
                            : isPast
                              ? 'bg-[#e8f6f0] text-[#0b5d38]'
                              : isAllowed
                                ? 'bg-[#052b20] text-white hover:bg-[#0b3e30]'
                                : 'border border-[#dbe4dd] bg-white text-[#7b8b83]'
                        } disabled:cursor-default`}
                      >
                        {(isCurrent || isPast) && (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {STATE_LABELS[state]}
                      </button>
                    </div>
                  )
                })}
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
