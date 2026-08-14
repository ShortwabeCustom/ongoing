'use client'

import { useRef, useState } from 'react'
import { Upload, AlertCircle } from 'lucide-react'
import { EvidenceFilePreview } from '@/components/evidence/EvidenceFilePreview'
import { cn } from '@/lib/utils'

interface EvidenceSelectorProps {
  file: File | null
  onFileChange: (file: File | null) => void
  onError?: (error: string) => void
  title?: string
  compact?: boolean
  acceptedTypes?: string[]
  acceptedTypesLabel?: string
  dragLabel?: string
  browseLabel?: string
  selectLabel?: string
  helperText?: string
}

const DEFAULT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export function EvidenceSelector({
  file,
  onFileChange,
  onError,
  title = 'Evidencia',
  compact = false,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  acceptedTypesLabel = 'JPEG, PNG, WebP o PDF hasta 10 MB',
  dragLabel = 'Arrastra tu archivo aquí',
  browseLabel = 'o haz clic para explorar',
  selectLabel = 'Seleccionar archivo',
  helperText,
}: EvidenceSelectorProps) {
  const [isDragging, setIsDragging] = useState(false)
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
      onError?.(validationError)
      return
    }
    onFileChange(f)
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

  const handleClear = () => {
    onFileChange(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div
      className={cn(
        'space-y-4 rounded-lg border border-[#dbe4dd] bg-[#f7faf5]',
        compact ? 'p-4' : 'p-6',
      )}
    >
      <div className="flex items-baseline justify-between">
        <h3
          className={cn(
            'font-semibold text-[#17251f]',
            compact ? 'text-base' : 'text-lg',
          )}
        >
          {title}
        </h3>
        <span className="text-xs font-medium text-[#65766e]">Opcional</span>
      </div>

      {helperText && (
        <p className="text-sm text-[#65766e]">{helperText}</p>
      )}

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
          } ${compact ? 'flex min-h-40 flex-col items-center justify-center p-5' : 'p-8'}`}
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
            className="px-4 py-2 bg-[#052b20] hover:bg-[#0b3e30] text-white rounded-lg text-sm font-medium transition-colors"
          >
            {selectLabel}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            accept={acceptedTypes.join(',')}
            className="hidden"
            aria-label="Seleccionar archivo de evidencia"
          />
          <p className="text-xs text-[#65766e] mt-4">
            {acceptedTypesLabel}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <EvidenceFilePreview
            file={file}
            onRemove={handleClear}
          />
          <p className="text-xs text-[#65766e] text-center">
            Se subirá automáticamente al crear el hallazgo
          </p>
        </div>
      )}
    </div>
  )
}
