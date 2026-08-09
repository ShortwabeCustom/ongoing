'use client'

import { useState, useEffect } from 'react'
import { Check, X, AlertCircle } from 'lucide-react'

interface CaptionEditorProps {
  evidenceId: string
  initialCaption?: string
  onSave: (id: string, caption: string) => Promise<void>
  onCancel: () => void
}

export function CaptionEditor({
  evidenceId,
  initialCaption = '',
  onSave,
  onCancel,
}: CaptionEditorProps) {
  const [caption, setCaption] = useState(initialCaption)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxChars = 500
  const remaining = maxChars - caption.length

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [caption])

  const handleSave = async () => {
    if (!caption.trim() && !initialCaption) {
      onCancel()
      return
    }

    try {
      setError(null)
      setIsSaving(true)
      await onSave(evidenceId, caption)
      onCancel()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save caption'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Edit Caption
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, maxChars))}
            placeholder="Add a description or caption for this evidence..."
            disabled={isSaving}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 resize-none"
            rows={4}
          />

          <div className="flex justify-between items-center text-xs">
            <p className="text-gray-500 dark:text-gray-400">
              {caption.length} / {maxChars} characters
            </p>
            <p
              className={remaining < 50 ? 'text-orange-600 dark:text-orange-400' : ''}
            >
              {remaining} remaining
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          Tip: Press Ctrl+S to save or Esc to cancel
        </p>
      </div>
    </div>
  )
}
