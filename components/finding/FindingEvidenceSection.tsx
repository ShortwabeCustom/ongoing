'use client'

import { useState } from 'react'
import { Finding, Evidence } from '@/lib/types'
import { EvidenceGallery } from '@/components/evidence/EvidenceGallery'
import { EvidenceUploader } from '@/components/evidence/EvidenceUploader'
import { EvidenceClient } from '@/lib/api/evidence-client'
import { useToast } from '@/lib/hooks/use-toast'
import { ToastContainer } from '@/components/ui/toast-container'

interface FindingEvidenceSectionProps {
  finding: Finding
  evidence: Evidence[]
}

export function FindingEvidenceSection({
  finding,
  evidence: initialEvidence,
}: FindingEvidenceSectionProps) {
  const { toasts, remove, success, error } = useToast()
  const [evidence, setEvidence] = useState<Evidence[]>(initialEvidence)
  const [isLoading, setIsLoading] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)

  const handleUploadSuccess = (newEvidence: Evidence) => {
    setEvidence((prev) => [newEvidence, ...prev])
    success('Evidence uploaded successfully')
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

  return (
    <>
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

      <ToastContainer toasts={toasts} onRemove={remove} />
    </>
  )
}
