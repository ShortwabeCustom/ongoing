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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/90"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onWheel={handleWheel}
    >
      {/* Close Button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-label="Cerrar visor"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image Container */}
      <div
        className="pointer-events-none flex max-h-full max-w-full items-center justify-center"
      >
        {evidence.url ? (
          <img
            src={evidence.url}
            alt={evidence.originalFilename}
            className="pointer-events-auto max-h-[90vh] max-w-[90vw] object-contain transition-transform duration-200"
            onClick={(event) => event.stopPropagation()}
            style={{ transform: `scale(${zoom})` }}
          />
        ) : (
          <div className="rounded border border-white/20 px-4 py-3 text-sm text-white">
            Vista previa no disponible
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
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
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-black/70 p-2">
        {/* Zoom Controls */}
        <button
          type="button"
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
          type="button"
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
          type="button"
          onClick={onPrev}
          className="p-2 text-white hover:bg-white/10 rounded transition-colors disabled:opacity-50"
          disabled={!canPrev}
          title="Previous image"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
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
          type="button"
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
