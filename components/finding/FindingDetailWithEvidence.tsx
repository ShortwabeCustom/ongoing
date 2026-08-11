'use client'

import { Finding, Evidence } from '@/lib/types'
import { EvidenceGallery } from '@/components/evidence/EvidenceGallery'
import { EvidenceUploader } from '@/components/evidence/EvidenceUploader'
import { ToastContainer } from '@/components/ui/toast-container'
import { useToast } from '@/lib/hooks/use-toast'
import { EvidenceClient } from '@/lib/api/evidence-client'
import { useState } from 'react'
import { ExternalLink, Pencil } from 'lucide-react'
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

  return (
    <div className="space-y-8">
      <div className="border-b border-[#dbe4dd] pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold leading-tight text-[#17251f]">
              {title}
            </h2>
            {description && (
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#3b4b43]">
                {description}
              </p>
            )}
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
      </div>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-[#65766e]">Observación</h3>
        <p className="max-w-4xl text-sm leading-7 text-[#3b4b43]">{description}</p>
      </section>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-5 border-y border-[#dbe4dd] py-6 md:grid-cols-3">
        {[
          ['Área', area],
          ['Incidencia', incidenceTypes],
          ['Prioridad', PRIORITY_LABELS_ES[finding.priority] ?? finding.priority],
          ['Severidad', SEVERITY_LABELS_ES[finding.severity] ?? finding.severity],
          ['Responsable', assigneeName],
          ['Creado', new Date(finding.createdAt).toLocaleDateString('es-ES')],
          ['Versión', finding.version.toString()],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-semibold uppercase text-[#65766e]">{label}</dt>
            <dd className="mt-1 truncate text-sm font-semibold text-[#17251f]">{value}</dd>
          </div>
        ))}
      </dl>

      {finding.flowStep && (
        <div className="border-b border-[#dbe4dd] pb-6">
          <p className="text-xs font-semibold uppercase text-[#65766e]">Paso del flujo</p>
          <p className="mt-1 text-sm font-semibold text-[#17251f]">{finding.flowStep}</p>
        </div>
      )}

      <section className="space-y-5 border-b border-[#dbe4dd] pb-8">
        <div>
          <h3 className="text-lg font-semibold text-[#17251f]">Pantallas</h3>
          <p className="mt-1 text-sm text-[#65766e]">
            Adjunta capturas como evidencia visual del antes y el estado actual.
          </p>
        </div>

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

      <div className="space-y-6 border-b border-[#dbe4dd] pb-8">
        <div>
          <h3 className="text-lg font-semibold text-[#17251f]">
            Evidencias
          </h3>
          <p className="mt-1 text-sm text-[#65766e]">
            {evidence.length} archivo{evidence.length !== 1 ? 's' : ''} adjunto{evidence.length !== 1 ? 's' : ''}
          </p>
        </div>

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
