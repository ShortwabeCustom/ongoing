'use client'

import { Evidence } from '@/lib/types'
import { EvidenceCard } from './EvidenceCard'
import { ImageLightbox } from './ImageLightbox'
import { useState } from 'react'

interface EvidenceGalleryProps {
  evidence: Evidence[]
  findingId: string
  onEvidenceDelete: (id: string) => Promise<void>
  onCaptionUpdate: (id: string, caption: string) => Promise<void>
  isLoading?: boolean
  error?: string
}

export function EvidenceGallery({
  evidence,
  findingId,
  onEvidenceDelete,
  onCaptionUpdate,
  isLoading,
  error,
}: EvidenceGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  if (error) {
    return (
      <div className="p-4 bg-[#fdece8] border border-[#f3c7bb] rounded-lg">
        <p className="text-[#8a3320]">{error}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a85a]" />
      </div>
    )
  }

  if (evidence.length === 0) {
    return (
      <div className="text-center py-8 text-[#65766e]">
        Aún no hay evidencias. Sube el primer archivo para comenzar.
      </div>
    )
  }

  const isImage = (mime: string) => mime.startsWith('image/')
  const imageEvidence = evidence.filter((e) => isImage(e.mimeType))
  const otherEvidence = evidence.filter((e) => !isImage(e.mimeType))

  return (
    <div className="space-y-8">
      {/* Image Gallery Grid */}
      {imageEvidence.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#17251f] mb-4">
            Imágenes ({imageEvidence.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {imageEvidence.map((item, index) => (
              <EvidenceCard
                key={item.id}
                evidence={item}
                onOpenLightbox={() => setLightboxIndex(index)}
                onDelete={onEvidenceDelete}
                onEditCaption={() => setEditingId(item.id)}
                isEditing={editingId === item.id}
                onCaptionSave={onCaptionUpdate}
                onEditCancel={() => setEditingId(null)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Files List */}
      {otherEvidence.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#17251f] mb-4">
            Documentos ({otherEvidence.length})
          </h3>
          <div className="space-y-2">
            {otherEvidence.map((item) => (
              <EvidenceCard
                key={item.id}
                evidence={item}
                variant="list"
                onDelete={onEvidenceDelete}
                onEditCaption={() => setEditingId(item.id)}
                isEditing={editingId === item.id}
                onCaptionSave={onCaptionUpdate}
                onEditCancel={() => setEditingId(null)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && imageEvidence[lightboxIndex] && (
        <ImageLightbox
          evidence={imageEvidence[lightboxIndex]}
          onClose={() => setLightboxIndex(null)}
          onNext={() =>
            setLightboxIndex((prev) =>
              prev !== null && prev < imageEvidence.length - 1 ? prev + 1 : null,
            )
          }
          onPrev={() =>
            setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : null))
          }
          canNext={lightboxIndex < imageEvidence.length - 1}
          canPrev={lightboxIndex > 0}
        />
      )}
    </div>
  )
}
