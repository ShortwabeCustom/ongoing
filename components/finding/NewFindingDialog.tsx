'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { LookupOption } from '@/lib/types/search'
import { DatePicker } from '@/components/ui/DatePicker'
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

type NewFindingDialogProps = {
  open: boolean
  projects: LookupOption[]
  assignees: LookupOption[]
  onClose: () => void
  onCreated: (finding: { id: string }) => void
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function getTodayISO() {
  return new Date().toISOString().split('T')[0]
}

async function readApiError(response: Response) {
  try {
    const result = await response.json()
    return result.message ?? result.error?.message ?? 'No se pudo completar la operación'
  } catch {
    return 'No se pudo completar la operación'
  }
}

export function NewFindingDialog({
  open,
  projects,
  assignees,
  onClose,
  onCreated,
}: NewFindingDialogProps) {
  const [projectId, setProjectId] = useState('')
  const [createdDate, setCreatedDate] = useState(getTodayISO())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [observation, setObservation] = useState('')
  const [incidenceTypes, setIncidenceTypes] = useState<string[]>([])
  const [experienceTags, setExperienceTags] = useState<string[]>([])
  const [priority, setPriority] = useState('MEDIUM')
  const [severity, setSeverity] = useState('MINOR')
  const [flowStep, setFlowStep] = useState('')
  const [assigneeId, setAssigneeId] = useState('')

  useEffect(() => {
    if (open) {
      setCreatedDate(getTodayISO())
      if (!projectId && projects[0]?.id) setProjectId(projects[0].id)
    }
  }, [open, projectId, projects])

  if (!open) return null

  const resetForm = () => {
    setCreatedDate(getTodayISO())
    setObservation('')
    setIncidenceTypes([])
    setExperienceTags([])
    setPriority('MEDIUM')
    setSeverity('MINOR')
    setFlowStep('')
    setAssigneeId('')
    setError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!projectId || !createdDate) {
      setError('Selecciona proyecto y fecha para crear el hallazgo')
      return
    }

    if (incidenceTypes.length === 0) {
      setError('Selecciona al menos un tipo de incidencia')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        createdDate: new Date(createdDate).toISOString(),
        observation,
        status: 'OPEN',
        priority,
        severity,
        incidenceTypes,
        experienceTags,
        flowStep: flowStep || undefined,
        assigneeId: assigneeId || undefined,
      }

      const response = await fetch(`/api/projects/${projectId}/findings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error(await readApiError(response))

      const created = await response.json()
      resetForm()
      onCreated(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el hallazgo')
    } finally {
      setIsSubmitting(false)
    }
  }

  const close = () => {
    if (isSubmitting) return
    resetForm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-end bg-[#031b14]/58 backdrop-blur-[2px] animate-in fade-in-0 duration-300">
      <form
        onSubmit={handleSubmit}
        className="h-screen w-full max-w-2xl overflow-y-auto border-l border-[#dbe4dd] bg-white shadow-2xl animate-in slide-in-from-right-0 duration-300 flex flex-col"
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-[#dbe4dd] bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#17251f]">Nuevo hallazgo</h2>
            <p className="mt-1 text-sm text-[#65766e]">
              Registra la observación y después podrás adjuntar evidencias desde el detalle.
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

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {error && (
            <p className="rounded-lg border border-[#f6b5aa] bg-[#fff1ee] px-3 py-2 text-sm text-[#9b321f]">
              {error}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-[#3d4d45]">
              Proyecto
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="pm-input h-11 w-full px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
                required
              >
                <option value="">Selecciona proyecto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <DatePicker
              label="Fecha de creación"
              value={createdDate}
              onChange={setCreatedDate}
            />
          </div>

          <label className="space-y-2 text-sm font-semibold text-[#3d4d45]">
            Observación
            <textarea
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Describe el hallazgo..."
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
                onChange={(event) => setPriority(event.target.value)}
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
                onChange={(event) => setSeverity(event.target.value)}
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

        <div className="sticky bottom-0 shrink-0 flex flex-col-reverse gap-2 border-t border-[#dbe4dd] bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={close}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#dbe4dd] px-4 text-sm font-semibold text-[#17251f] transition hover:bg-[#edf4ed]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !projectId || !createdDate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#052b20] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3e30] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear hallazgo
          </button>
        </div>
      </form>
    </div>
  )
}
