'use client'

import { useState } from 'react'
import { ImageLightbox } from '@/components/evidence/ImageLightbox'
import { Finding, Evidence } from '@/lib/types'
import { EvidenceUploader } from '@/components/evidence/EvidenceUploader'
import { useToast } from '@/lib/hooks/use-toast'

interface ScreenSlot {
  title: string
  caption: string
  legacyValue?: string | null
}

interface FindingScreensSectionProps {
  finding: Finding
  screenSlots: ScreenSlot[]
  findScreenEvidence: (caption: string) => Evidence | undefined
}

const IMAGE_EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function FindingScreensSection({
  finding,
  screenSlots,
  findScreenEvidence,
}: FindingScreensSectionProps) {
  const { success, error } = useToast()
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)

  const handleUploadSuccess = () => {
    success('Evidencia subida exitosamente')
  }

  const handleUploadError = (err: string) => {
    error(err)
  }

  return (
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
                        <button
                          type="button"
                          onClick={() => setSelectedEvidence(attachedEvidence)}
                          className="block overflow-hidden rounded-lg border border-[#dbe4dd]"
                          aria-label={`Abrir visor para ${attachedEvidence.originalFilename}`}
                        >
                          <img
                            src={attachedEvidence.url}
                            alt={attachedEvidence.originalFilename}
                            className="h-36 w-full object-cover"
                          />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedEvidence(attachedEvidence)}
                        disabled={!attachedEvidence.url}
                        className="inline-flex max-w-full items-center gap-2 font-semibold text-[#0b6f46] hover:text-[#052b20]"
                      >
                        <span className="truncate">{attachedEvidence.originalFilename}</span>
                      </button>
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

      {selectedEvidence && (
        <ImageLightbox
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}
    </section>
  )
}
