'use client'

import { useState } from 'react'
import { PreviewTable } from './preview-table'
import type { ImportPreviewResult } from '@/lib/validators/import'

type DialogStep = 'upload' | 'preview' | 'confirming' | 'done'

interface ImportDialogProps {
  projectId: string
  onSuccess?: (batchId: string) => void
}

export function ImportDialog({ projectId, onSuccess }: ImportDialogProps) {
  const [step, setStep] = useState<DialogStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('projectId', projectId)

      const response = await fetch('/api/imports/preview', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate preview')
      }

      const result = await response.json()
      setPreview(result)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview || !file) return

    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/imports/${preview.batchId}/confirm`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to confirm import')
      }

      const result = await response.json()
      setStep('done')
      onSuccess?.(result.importBatchId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStep('preview')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-6">Import Findings</h2>

      {step === 'upload' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileSelect}
              disabled={isLoading}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="block cursor-pointer"
            >
              <p className="text-gray-600 mb-2">
                {isLoading ? 'Processing...' : 'Drag and drop your CSV or XLSX file here, or click to select'}
              </p>
              {file && <p className="text-sm text-gray-500">Selected: {file.name}</p>}
            </label>
          </div>
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded">
            <h3 className="font-semibold mb-2">Import Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Total Rows: <span className="font-bold">{preview.summary.totalRows}</span></div>
              <div>Valid Rows: <span className="font-bold text-green-600">{preview.summary.validRows}</span></div>
              <div>Skipped: <span className="font-bold text-yellow-600">{preview.summary.skippedRows}</span></div>
              <div>New Findings: <span className="font-bold">{preview.summary.newFindings}</span></div>
            </div>
          </div>

          {preview.incidences.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
              <h4 className="font-semibold mb-2">Issues Found</h4>
              <ul className="text-sm space-y-1">
                {preview.incidences.slice(0, 5).map((inc, idx) => (
                  <li key={idx} className="text-yellow-700">
                    Row {inc.row}: {inc.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PreviewTable rows={preview.preview.rows} />

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setStep('upload')}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Importing...' : 'Confirm Import'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700">
            ✓ Import completed successfully!
          </div>
          <button
            onClick={() => {
              setStep('upload')
              setFile(null)
              setPreview(null)
              setError(null)
            }}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
