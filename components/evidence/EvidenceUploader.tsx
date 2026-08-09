'use client'

import { useState, useRef } from 'react'
import { Upload, X, AlertCircle } from 'lucide-react'
import { EvidenceClient } from '@/lib/api/evidence-client'
import { Evidence } from '@/lib/types'

interface EvidenceUploaderProps {
  findingId: string
  onSuccess: (evidence: Evidence) => void
  onError: (error: string) => void
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export function EvidenceUploader({
  findingId,
  onSuccess,
  onError,
}: EvidenceUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      return `Invalid file type. Accepted: JPEG, PNG, WebP, PDF`
    }
    if (f.size > MAX_SIZE) {
      return `File too large. Maximum size: 10 MB (your file: ${(f.size / 1024 / 1024).toFixed(2)} MB)`
    }
    return null
  }

  const handleFileSelect = (f: File) => {
    setError(null)
    const validationError = validateFile(f)
    if (validationError) {
      setError(validationError)
      return
    }
    setFile(f)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return

    try {
      setError(null)
      setIsUploading(true)
      setProgress(0)

      const evidence = await EvidenceClient.upload(
        file,
        findingId,
        caption || undefined,
        (p) => setProgress(Math.round(p)),
      )

      onSuccess(evidence)
      setFile(null)
      setCaption('')
      setProgress(0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      onError(message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleClear = () => {
    setFile(null)
    setCaption('')
    setError(null)
    setProgress(0)
  }

  return (
    <div className="space-y-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Upload Evidence
      </h3>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          <Upload
            className={`w-8 h-8 mx-auto mb-3 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`}
          />
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Drag and drop your file here
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            or click to browse
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Select File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            accept={ACCEPTED_TYPES.join(',')}
            disabled={isUploading}
            className="hidden"
            aria-label="Select file"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            JPEG, PNG, WebP, or PDF up to 10 MB
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {file.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              onClick={handleClear}
              disabled={isUploading}
              className="ml-4 p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
              title="Clear selection"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-white">
              Caption (optional)
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 500))}
              placeholder="Describe this evidence..."
              disabled={isUploading}
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 resize-none"
              rows={3}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {caption.length} / 500 characters
            </p>
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                {progress}%
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              onClick={handleClear}
              disabled={isUploading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
