'use client'

import { useRef, useState } from 'react'
import { Upload, X, AlertCircle } from 'lucide-react'
import { EvidenceClient } from '@/lib/api/evidence-client'
import { Evidence } from '@/lib/types'
import { cn } from '@/lib/utils'

interface EvidenceUploaderProps {
  findingId: string
  onSuccess: (evidence: Evidence) => void
  onError: (error: string) => void
  title?: string
  compact?: boolean
  acceptedTypes?: string[]
  acceptedTypesLabel?: string
  defaultCaption?: string
  showCaption?: boolean
  dragLabel?: string
  browseLabel?: string
  selectLabel?: string
  uploadLabel?: string
}

const DEFAULT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export function EvidenceUploader({
  findingId,
  onSuccess,
  onError,
  title = 'Subir evidencia',
  compact = false,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  acceptedTypesLabel = 'JPEG, PNG, WebP o PDF hasta 10 MB',
  defaultCaption = '',
  showCaption = true,
  dragLabel = 'Arrastra tu archivo aquí',
  browseLabel = 'o haz clic para explorar',
  selectLabel = 'Seleccionar archivo',
  uploadLabel = 'Subir',
}: EvidenceUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState(defaultCaption)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (f: File): string | null => {
    if (!acceptedTypes.includes(f.type)) {
      return `Tipo de archivo inválido. Aceptado: ${acceptedTypesLabel}`
    }
    if (f.size > MAX_SIZE) {
      return `El archivo es demasiado grande. Máximo: 10 MB (archivo: ${(f.size / 1024 / 1024).toFixed(2)} MB)`
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
        (showCaption ? caption : defaultCaption) || undefined,
        (p) => setProgress(Math.round(p)),
      )

      onSuccess(evidence)
      setFile(null)
      setCaption(defaultCaption)
      setProgress(0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo subir el archivo'
      setError(message)
      onError(message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleClear = () => {
    setFile(null)
    setCaption(defaultCaption)
    setError(null)
    setProgress(0)
  }

  return (
    <div
      className={cn(
        'space-y-4 rounded-lg border border-[#dbe4dd] bg-[#f7faf5]',
        compact ? 'p-4' : 'p-6',
      )}
    >
      <h3
        className={cn(
          'font-semibold text-[#17251f]',
          compact ? 'text-base' : 'text-lg',
        )}
      >
        {title}
      </h3>

      {error && (
        <div className="p-3 bg-[#fdece8] border border-[#f3c7bb] rounded-lg flex gap-2">
          <AlertCircle className="w-5 h-5 text-[#c2492f] flex-shrink-0" />
          <p className="text-sm text-[#8a3320]">{error}</p>
        </div>
      )}

      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg text-center transition-colors ${
            isDragging
              ? 'border-[#00a85a] bg-[#e0f5e9]'
              : 'border-[#dbe4dd] hover:border-[#b9dcca]'
          } ${compact ? 'flex min-h-44 flex-col items-center justify-center p-5' : 'p-8'}`}
        >
          <Upload
            className={`${compact ? 'h-7 w-7' : 'h-8 w-8'} mx-auto mb-3 ${isDragging ? 'text-[#00a85a]' : 'text-[#9aa79f]'}`}
          />
          <p className="text-sm font-medium text-[#17251f] mb-1">
            {dragLabel}
          </p>
          <p className="text-xs text-[#65766e] mb-4">
            {browseLabel}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 bg-[#052b20] hover:bg-[#0b3e30] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {selectLabel}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            accept={acceptedTypes.join(',')}
            disabled={isUploading}
            className="hidden"
            aria-label="Seleccionar archivo"
          />
          <p className="text-xs text-[#65766e] mt-4">
            {acceptedTypesLabel}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-lg border border-[#dbe4dd] flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#17251f] truncate">
                {file.name}
              </p>
              <p className="text-xs text-[#65766e]">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              disabled={isUploading}
              className="ml-4 p-2 text-[#9aa79f] hover:text-[#c2492f] transition-colors disabled:opacity-50"
              title="Quitar selección"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {showCaption && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#17251f]">
                Descripción (opcional)
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                placeholder="Describe esta evidencia..."
                disabled={isUploading}
                maxLength={500}
                className="w-full px-3 py-2 border border-[#dbe4dd] rounded-lg bg-white text-[#17251f] placeholder-[#9aa79f] focus:outline-none focus:ring-2 focus:ring-[#00a85a] disabled:opacity-50 resize-none"
                rows={compact ? 2 : 3}
              />
              <p className="text-xs text-[#65766e]">
                {caption.length} / 500 caracteres
              </p>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="w-full bg-[#e6ece5] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#00a85a] h-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-center text-[#65766e]">
                {progress}%
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClear}
              disabled={isUploading}
              className="px-4 py-2 text-[#3d4d45] hover:bg-[#edf4ed] rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="px-4 py-2 bg-[#052b20] hover:bg-[#0b3e30] text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {isUploading ? 'Subiendo...' : uploadLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
