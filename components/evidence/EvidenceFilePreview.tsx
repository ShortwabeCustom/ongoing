'use client'

import { X } from 'lucide-react'

interface EvidenceFilePreviewProps {
  file: File
  onRemove: () => void
  disabled?: boolean
}

export function EvidenceFilePreview({
  file,
  onRemove,
  disabled = false,
}: EvidenceFilePreviewProps) {
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'

  return (
    <div className="p-4 bg-white rounded-lg border border-[#dbe4dd] flex items-center justify-between">
      <div className="flex-1 min-w-0">
        {isImage && (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#e0f5e9] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-[#052b20]">IMG</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#17251f] truncate">
                {file.name}
              </p>
              <p className="text-xs text-[#65766e]">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        )}
        {isPdf && (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#fff1ee] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-[#c2492f]">PDF</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#17251f] truncate">
                {file.name}
              </p>
              <p className="text-xs text-[#65766e]">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        )}
        {!isImage && !isPdf && (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#f0f0f0] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-[#666]">FILE</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#17251f] truncate">
                {file.name}
              </p>
              <p className="text-xs text-[#65766e]">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="ml-4 p-2 text-[#9aa79f] hover:text-[#c2492f] transition-colors disabled:opacity-50"
        title="Quitar selección"
        aria-label="Quitar selección de evidencia"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}
