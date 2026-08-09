'use client'

import { Finding, Evidence } from '@/lib/types'
import { EvidenceGallery } from '@/components/evidence/EvidenceGallery'
import { EvidenceUploader } from '@/components/evidence/EvidenceUploader'
import { ToastContainer } from '@/components/ui/toast-container'
import { useToast } from '@/lib/hooks/use-toast'
import { EvidenceClient } from '@/lib/api/evidence-client'
import { useState } from 'react'

interface FindingDetailWithEvidenceProps {
  finding: Finding & { evidence?: Evidence[] }
  onFindingUpdate?: (finding: Finding) => void
}

export function FindingDetailWithEvidence({
  finding,
  onFindingUpdate,
}: FindingDetailWithEvidenceProps) {
  const { toasts, remove, success, error } = useToast()
  const [evidence, setEvidence] = useState<Evidence[]>(finding.evidence || [])
  const [isLoading, setIsLoading] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)

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
      if (result.data && onFindingUpdate) {
        onFindingUpdate(result.data)
      }
    } catch (err) {
      console.error('Failed to refresh finding:', err)
    }
  }

  return (
    <div className="space-y-8">
      {/* Finding Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {finding.title}
        </h1>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
            {finding.status}
          </span>
          <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full text-xs font-medium">
            {finding.priority}
          </span>
          <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-medium">
            {finding.severity}
          </span>
        </div>
        {finding.description && (
          <p className="text-gray-700 dark:text-gray-300">{finding.description}</p>
        )}
      </div>

      {/* Finding Details (Example fields) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Area
          </h3>
          <p className="text-gray-700 dark:text-gray-300">{finding.area || '-'}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Created
          </h3>
          <p className="text-gray-700 dark:text-gray-300">
            {new Date(finding.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Evidence Section */}
      <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Evidence
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {evidence.length} file{evidence.length !== 1 ? 's' : ''} attached
          </p>
        </div>

        {/* Upload Section */}
        <EvidenceUploader
          findingId={finding.id}
          onSuccess={handleUploadSuccess}
          onError={handleUploadError}
        />

        {/* Gallery Section */}
        {evidence.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Files
            </h3>
            <EvidenceGallery
              evidence={evidence}
              findingId={finding.id}
              onEvidenceDelete={handleEvidenceDelete}
              onCaptionUpdate={handleCaptionUpdate}
              isLoading={isLoading}
              error={galleryError}
            />
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </div>
  )
}
