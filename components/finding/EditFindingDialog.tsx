'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import type { Finding } from '@/lib/types'
import type { LookupOption } from '@/lib/types/search'
import {
  EXPERIENCE_TAG_LABELS_ES,
  EXPERIENCE_TAG_OPTIONS,
  FINDING_PRIORITY_OPTIONS,
  FINDING_SEVERITY_OPTIONS,
  INCIDENCE_TYPE_LABELS_ES,
  INCIDENCE_TYPE_OPTIONS,
  PRIORITY_LABELS_ES,
  SEVERITY_LABELS_ES,
} from '@/lib/constants/finding-options'
import { cn } from '@/lib/utils'

type EditFindingDialogProps = {
  open: boolean
  finding: Finding
  assignees: LookupOption[]
  onClose: () => void
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

async function readApiError(response: Response) {
  try {
    const result = await response.json()
    return result.message ?? result.error?.message ?? 'No se pudo completar la operación'
  } catch {
    return 'No se pudo completar la operación'
  }
}

export function EditFindingDialog({
  open,
  finding,
  assignees,
  onClose,
}: EditFindingDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [observation, setObservation] = useState(finding.observation)
  const [incidenceTypes, setIncidenceTypes] = useState<string[]>([])
  const [experienceTags, setExperienceTags] = useState<string[]>([])
  const [priority, setPriority] = useState(finding.priority)
  const [severity, setSeverity] = useState(finding.severity)
  const [flowStep, setFlowStep] = useState(finding.flowStep ?? '')
  const [assigneeId, setAssigneeId] = useState(finding.assigneeId ?? '')

  useEffect(() => {
    if (!open) return

    setObservation(finding.observation)
    setPriority(finding.priority)
    setSeverity(finding.severity)
    setFlowStep(finding.flowStep ?? '')
    setAssigneeId(finding.assigneeId ?? '')
    setIncidenceTypes(finding.incidenceTypes?.map((item) => item.incidenceType) ?? [])
    setExperienceTags(finding.experienceTags?.map((item) => item.experienceTag) ?? [])
    setError(null)
  }, [open, finding])

  if (!open) return null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (incidenceTypes.length === 0) {
      setError('Selecciona al menos un tipo de incidencia')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/findings/${finding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: finding.version,
          observation,
          priority,
          severity,
          incidenceTypes,
          experienceTags,
          flowStep: flowStep || null,
          assigneeId: assigneeId || null,
        }),
      })

      if (!response.ok) throw new Error(await readApiError(response))

      onClose()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el hallazgo')
    } finally {
      setIsSubmitting(false)
    }
  }

  const close = () => {
    if (isSubmitting) return
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#031b14]/58 px-3 py-4 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[#dbe4dd] bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#dbe4dd] bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#17251f]">Editar hallazgo</h2>
            <p className="mt-1 text-sm text-[#65766e]">
              Actualiza variables del hallazgo sin saltarte el workflow de estado.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#65766e] transition hover:bg-[#edf4ed] hover:text-[#17251f]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {error && (
            <p className="rounded-lg border border-[#f6b5aa] bg-[#fff1ee] px-3 py-2 text-sm text-[#9b321f]">
              {error}
            </p>
          )}

          <label className="space-y-2 text-sm font-semibold text-[#3d4d45]">
            Observación
            <textarea
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              className="pm-input min-h-32 w-full p-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
              minLength={5}
              maxLength={2000}
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[#3d4d45]">Tipo de incidencia</p>
              <div className="flex flex-wrap gap-2">
                {INCIDENCE_TYPE_OPTIONS.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setIncidenceTypes((current) => toggleValue(current, type))}
                    className={cn(
                      'pm-chip px-3 text-xs font-semibold transition-colors',
                      incidenceTypes.includes(type) && 'pm-chip-active',
                    )}
                  >
                    {INCIDENCE_TYPE_LABELS_ES[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-[#3d4d45]">Área / etiqueta</p>
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setExperienceTags((current) => toggleValue(current, tag))}
                    className={cn(
                      'pm-chip px-3 text-xs font-semibold transition-colors',
                      experienceTags.includes(tag) && 'pm-chip-active',
                    )}
                  >
                    {EXPERIENCE_TAG_LABELS_ES[tag]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm font-semibold text-[#3d4d45]">
              Prioridad
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as typeof priority)}
                className="pm-input h-11 w-full px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
              >
                {FINDING_PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {PRIORITY_LABELS_ES[option]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-[#3d4d45]">
              Severidad
              <select
                value={severity}
                onChange={(event) => setSeverity(event.target.value as typeof severity)}
                className="pm-input h-11 w-full px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
              >
                {FINDING_SEVERITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {SEVERITY_LABELS_ES[option]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-[#3d4d45]">
              Responsable
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="pm-input h-11 w-full px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
              >
                <option value="">Sin asignar</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4">
            <label className="space-y-2 text-sm font-semibold text-[#3d4d45]">
              Paso del flujo
              <input
                value={flowStep}
                onChange={(event) => setFlowStep(event.target.value)}
                className="pm-input h-11 w-full px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
              />
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[#dbe4dd] bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={close}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#dbe4dd] px-4 text-sm font-semibold text-[#17251f] transition hover:bg-[#edf4ed]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#052b20] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3e30] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  )
}
