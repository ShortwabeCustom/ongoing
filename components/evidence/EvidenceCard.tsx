'use client'

import { Evidence } from '@/lib/types'
import { useState } from 'react'
import { Edit2, Trash2, FileText, Image as ImageIcon } from 'lucide-react'
import { CaptionEditor } from './CaptionEditor'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'

interface EvidenceCardProps {
  evidence: Evidence
  variant?: 'grid' | 'list'
  onOpenLightbox?: () => void
  onDelete: (id: string) => Promise<void>
  onEditCaption: () => void
  onCaptionSave: (id: string, caption: string) => Promise<void>
  isEditing: boolean
  onEditCancel: () => void
}

export function EvidenceCard({
  evidence,
  variant = 'grid',
  onOpenLightbox,
  onDelete,
  onEditCaption,
  onCaptionSave,
  isEditing,
  onEditCancel,
}: EvidenceCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const isImage = evidence.mimeType.startsWith('image/')
  const filename = evidence.originalFilename
  const size = (evidence.fileSize / 1024 / 1024).toFixed(2)

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await onDelete(evidence.id)
    } finally {
      setIsDeleting(false)
    }
  }

  if (variant === 'list') {
    return (
      <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {filename}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{size} MB</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEditCaption}
            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="Edit caption"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsDeleting(true)}
            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {isEditing && (
          <div className="absolute inset-0 z-50">
            <CaptionEditor
              evidenceId={evidence.id}
              initialCaption={evidence.caption}
              onSave={onCaptionSave}
              onCancel={onEditCancel}
            />
          </div>
        )}

        {isDeleting && (
          <DeleteConfirmDialog
            filename={filename}
            onConfirm={handleDelete}
            onCancel={() => setIsDeleting(false)}
          />
        )}
      </div>
    )
  }

  // Grid variant
  return (
    <div className="relative group">
      <div
        className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
        onClick={onOpenLightbox}
      >
        {isImage ? (
          <img
            src={evidence.url}
            alt={filename}
            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" class="w-full h-full text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpath d="m21 15-5-5L5 21"/%3E%3C/svg%3E'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
        )}
      </div>

      <div className="mt-2">
        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
          {filename}
        </p>
        {evidence.caption && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {evidence.caption}
          </p>
        )}
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEditCaption()
          }}
          className="p-2 bg-white dark:bg-gray-900 rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
          title="Edit caption"
        >
          <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsDeleting(true)
          }}
          className="p-2 bg-white dark:bg-gray-900 rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
          title="Delete"
        >
          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
        </button>
      </div>

      {isEditing && (
        <CaptionEditor
          evidenceId={evidence.id}
          initialCaption={evidence.caption}
          onSave={onCaptionSave}
          onCancel={onEditCancel}
        />
      )}

      {isDeleting && (
        <DeleteConfirmDialog
          filename={filename}
          onConfirm={handleDelete}
          onCancel={() => setIsDeleting(false)}
        />
      )}
    </div>
  )
}
