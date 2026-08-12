'use client'

import { Finding, Evidence } from '@/lib/types'
import { EvidenceGallery } from '@/components/evidence/EvidenceGallery'
import { EvidenceUploader } from '@/components/evidence/EvidenceUploader'
import { ToastContainer } from '@/components/ui/toast-container'
import { useToast } from '@/lib/hooks/use-toast'
import { EvidenceClient } from '@/lib/api/evidence-client'
import { useState } from 'react'
import { ExternalLink, Pencil, MapPin, AlertTriangle, Flag, ShieldAlert, User, CalendarDays, Hash, Workflow as WorkflowIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useLookups } from '@/lib/hooks/useLookups'
import { EditFindingDialog } from '@/components/finding/EditFindingDialog'
import {
  EXPERIENCE_TAG_LABELS_ES,
  INCIDENCE_TYPE_LABELS_ES,
  PRIORITY_LABELS_ES,
  SEVERITY_LABELS_ES,
  STATUS_LABELS_ES,
} from '@/lib/constants/finding-options'

interface FindingDetailWithEvidenceProps {
  finding: Finding & { evidence?: Evidence[] }
  onFindingUpdate?: (finding: Finding) => void
}

const IMAGE_EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function FindingDetailWithEvidence({
  finding,
  onFindingUpdate,
}: FindingDetailWithEvidenceProps) {
  const auth = useAuth()
  const { toasts, remove, success, error } = useToast()
  const [evidence, setEvidence] = useState<Evidence[]>(finding.evidence || [])
  const [isLoading, setIsLoading] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const { assignees } = useLookups(finding.projectId)
  const title = finding.title ?? finding.folio ?? `Hallazgo ${finding.id.slice(0, 8)}`
  const description = finding.description ?? finding.observation
  const areaValues = finding.experienceTags?.map((tag) => tag.experienceTag) ?? []
  const incidenceValues = finding.incidenceTypes?.map((type) => type.incidenceType) ?? []
  const labeledArea = areaValues.map((tag) => EXPERIENCE_TAG_LABELS_ES[tag] ?? tag).join(', ')
  const area = finding.area ?? (labeledArea || '-')
  const incidenceTypes =
    incidenceValues.map((type) => INCIDENCE_TYPE_LABELS_ES[type] ?? type).join(', ') || '-'
  const assigneeName = (finding as any).assignee?.name ?? '-'
  const canEdit = Boolean(auth.user?.role && ['OWNER', 'QA_LEAD'].includes(auth.user.role))
  const classificationLabel = incidenceValues.length || areaValues.length ? 'Clasificado' : 'Sin clasificar'
  const screenSlots = [
    {
      title: 'Pantalla anterior',
      caption: 'Pantalla anterior',
      legacyValue: finding.previousScreen,
    },
    {
      title: 'Pantalla actual',
      caption: 'Pantalla actual',
      legacyValue: finding.currentScreen,
    },
  ]

  const findScreenEvidence = (caption: string) => {
    const normalizedCaption = caption.toLowerCase()

    return (
      evidence.find(
        (item) =>
          item.mimeType.startsWith('image/') &&
          item.caption?.toLowerCase().trim() === normalizedCaption,
      ) ??
      evidence.find(
        (item) =>
          item.mimeType.startsWith('image/') &&
          item.caption?.toLowerCase().includes(normalizedCaption),
      )
    )
  }

  const handleUploadSuccess = (newEvidence: Evidence) => {
    setEvidence((prev) => [newEvidence, ...prev])
    success('Evidence uploaded successfully')

    // Refresh Finding data if callback provided
    if (onFindingUpdate) {
      fetchUpdatedFinding()
    }
  }

  const handleUploadError = (err: string) => {
    error(err)
  }

  const handleEvidenceDelete = async (evidenceId: string) => {
    try {
      setIsLoading(true)
      await EvidenceClient.delete(evidenceId)
      setEvidence((prev) => prev.filter((e) => e.id !== evidenceId))
      success('Evidence deleted successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete evidence'
      error(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const handleCaptionUpdate = async (evidenceId: string, caption: string) => {
    try {
      setIsLoading(true)
      const updated = await EvidenceClient.updateCaption(evidenceId, caption)
      setEvidence((prev) =>
        prev.map((e) => (e.id === evidenceId ? { ...e, caption: updated.caption } : e)),
      )
      success('Caption updated')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update caption'
      error(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUpdatedFinding = async () => {
    try {
      const response = await fetch(`/api/findings/${finding.id}`)
      if (!response.ok) throw new Error('Failed to refresh')
      const result = await response.json()
      const updatedFinding = result.data ?? result
      if (updatedFinding && onFindingUpdate) {
        onFindingUpdate(updatedFinding)
      }
    } catch (err) {
      console.error('Failed to refresh finding:', err)
    }
  }

  const metaFields = [
    { icon: MapPin, label: 'Área', value: area },
    { icon: AlertTriangle, label: 'Incidencia', value: incidenceTypes },
    { icon: Flag, label: 'Prioridad', value: PRIORITY_LABELS_ES[finding.priority] ?? finding.priority },
    { icon: ShieldAlert, label: 'Severidad', value: SEVERITY_LABELS_ES[finding.severity] ?? finding.severity },
    { icon: User, label: 'Responsable', value: assigneeName },
    { icon: CalendarDays, label: 'Creado', value: new Date(finding.createdAt).toLocaleDateString('es-ES') },
    { icon: Hash, label: 'Versión', value: finding.version.toString() },
    ...(finding.flowStep
      ? [{ icon: WorkflowIcon, label: 'Paso del flujo', value: finding.flowStep }]
      : []),
  ]

  return (
    <div className="space-y-6">
      <section className="pm-card p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-[#17251f]">
              {title}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#b9dcca] bg-[#e0f5e9] px-3 py-1 text-xs font-semibold text-[#087244]">
                {STATUS_LABELS_ES[finding.status] ?? finding.status}
              </span>
              <span className="rounded-full border border-[#dbe4dd] bg-white px-3 py-1 text-xs font-semibold text-[#3d4d45]">
                {classificationLabel}
              </span>
            </div>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#052b20] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3e30] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
            >
              <Pencil className="h-4 w-4" />
              Editar hallazgo
            </button>
          )}
        </div>
      </section>

      <section className="pm-card p-6 md:p-8">
        <h3 className="mb-4 text-xl font-bold text-[#17251f]">Observación</h3>
        <p className="max-w-4xl text-base leading-8 text-[#3b4b43]">{description}</p>
      </section>

      <section className="pm-card p-6 md:p-8">
        <h3 className="mb-6 text-xl font-bold text-[#17251f]">Detalles del hallazgo</h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {metaFields.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e0f5e9] text-[#052b20]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#65766e]">{label}</p>
                <p className={`mt-0.5 text-sm font-semibold text-[#17251f] ${label === 'Incidencia' ? 'line-clamp-2' : 'truncate'}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="pm-card p-6 md:p-8">
        <h3 className="mb-6 text-xl font-bold text-[#17251f]">Pantallas</h3>
        <p className="mb-6 text-sm text-[#65766e]">
          Adjunta capturas como evidencia visual del antes y el estado actual.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          {screenSlots.map((slot) => {
            const attachedEvidence = findScreenEvidence(slot.caption)

            return (
              <div key={slot.caption} className="space-y-3">
                <EvidenceUploader
                  findingId={finding.id}
                  title={slot.title}
                  compact
                  acceptedTypes={IMAGE_EVIDENCE_TYPES}
                  acceptedTypesLabel="JPEG, PNG o WebP hasta 10 MB"
                  defaultCaption={slot.caption}
                  showCaption={false}
                  dragLabel="Arrastra una imagen aquí"
                  browseLabel="o selecciónala desde tu equipo"
                  selectLabel="Seleccionar imagen"
                  uploadLabel="Subir imagen"
                  onSuccess={handleUploadSuccess}
                  onError={handleUploadError}
                />

                {(attachedEvidence || slot.legacyValue) && (
                  <div className="rounded-lg border border-[#dbe4dd] bg-white p-3 text-sm">
                    {attachedEvidence ? (
                      <div className="space-y-3">
                        {attachedEvidence.url && (
                          <a
                            href={attachedEvidence.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-lg border border-[#dbe4dd]"
                          >
                            <img
                              src={attachedEvidence.url}
                              alt={attachedEvidence.originalFilename}
                              className="h-36 w-full object-cover"
                            />
                          </a>
                        )}
                        <a
                          href={attachedEvidence.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-2 font-semibold text-[#0b6f46] hover:text-[#052b20]"
                        >
                          <span className="truncate">{attachedEvidence.originalFilename}</span>
                          <ExternalLink className="h-4 w-4 shrink-0" />
                        </a>
                      </div>
                    ) : (
                      <p className="text-[#65766e]">
                        Referencia guardada: <span className="font-semibold text-[#17251f]">{slot.legacyValue}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="pm-card p-6 md:p-8">
        <h3 className="mb-6 text-xl font-bold text-[#17251f]">Evidencias</h3>
        <p className="mb-6 text-sm text-[#65766e]">
          {evidence.length} archivo{evidence.length !== 1 ? 's' : ''} adjunto{evidence.length !== 1 ? 's' : ''}
        </p>

        <div className="space-y-6">
          <EvidenceUploader
            findingId={finding.id}
            onSuccess={handleUploadSuccess}
            onError={handleUploadError}
          />

          {evidence.length > 0 && (
            <EvidenceGallery
              evidence={evidence}
              findingId={finding.id}
              onEvidenceDelete={handleEvidenceDelete}
              onCaptionUpdate={handleCaptionUpdate}
              isLoading={isLoading}
              error={galleryError ?? undefined}
            />
          )}
        </div>
      </section>

      <EditFindingDialog
        open={editOpen}
        finding={finding}
        assignees={assignees}
        onClose={() => setEditOpen(false)}
      />

      <ToastContainer toasts={toasts} onRemove={remove} />
    </div>
  )
}
