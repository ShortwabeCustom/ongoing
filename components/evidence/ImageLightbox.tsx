'use client'

import { Evidence } from '@/lib/types'
import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react'

interface ImageLightboxProps {
  evidence: Evidence
  onClose: () => void
  onNext?: () => void
  onPrev?: () => void
  canNext?: boolean
  canPrev?: boolean
}

export function ImageLightbox({
  evidence,
  onClose,
  onNext,
  onPrev,
  canNext,
  canPrev,
}: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1)
  const maxZoom = 3
  const minZoom = 1

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && canNext) onNext?.()
      if (e.key === 'ArrowLeft' && canPrev) onPrev?.()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onNext, onPrev, canNext, canPrev])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((prev) => Math.max(minZoom, Math.min(maxZoom, prev + delta)))
  }

  const downloadImage = async () => {
    if (!evidence.url) return

    try {
      const response = await fetch(evidence.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = evidence.originalFilename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image Container */}
      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        onWheel={handleWheel}
      >
        {evidence.url ? (
          <img
            src={evidence.url}
            alt={evidence.originalFilename}
            className="max-w-[90vw] max-h-[90vh] object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          />
        ) : (
          <div className="rounded border border-white/20 px-4 py-3 text-sm text-white">
            Vista previa no disponible
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
        <h3 className="text-lg font-semibold mb-1">{evidence.originalFilename}</h3>
        {evidence.caption && (
          <p className="text-sm text-gray-300 mb-3">{evidence.caption}</p>
        )}
        <p className="text-xs text-gray-400">
          {((evidence.fileSize ?? 0) / 1024 / 1024).toFixed(2)} MB •{' '}
          {new Date(evidence.uploadedAt ?? evidence.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 rounded-lg p-2">
        {/* Zoom Controls */}
        <button
          onClick={() => setZoom((prev) => Math.max(minZoom, prev - 0.2))}
          className="p-2 text-white hover:bg-white/10 rounded transition-colors disabled:opacity-50"
          disabled={zoom <= minZoom}
          title="Zoom out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>

        <div className="text-white text-sm font-medium w-10 text-center">
          {Math.round(zoom * 100)}%
        </div>

        <button
          onClick={() => setZoom((prev) => Math.min(maxZoom, prev + 0.2))}
          className="p-2 text-white hover:bg-white/10 rounded transition-colors disabled:opacity-50"
          disabled={zoom >= maxZoom}
          title="Zoom in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-white/20" />

        {/* Navigation */}
        <button
          onClick={onPrev}
          className="p-2 text-white hover:bg-white/10 rounded transition-colors disabled:opacity-50"
          disabled={!canPrev}
          title="Previous image"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={onNext}
          className="p-2 text-white hover:bg-white/10 rounded transition-colors disabled:opacity-50"
          disabled={!canNext}
          title="Next image"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-white/20" />

        {/* Download Button */}
        <button
          onClick={downloadImage}
          className="p-2 text-white hover:bg-white/10 rounded transition-colors"
          disabled={!evidence.url}
          title="Download image"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
