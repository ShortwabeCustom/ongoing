'use client'

import { useState } from 'react'
import { X, Clock, Star, Trash2, MoreVertical } from 'lucide-react'
import { SearchHistoryEntry, SavedFilterEntry } from '@/lib/types/search'

interface SearchHistoryProps {
  open: boolean
  onClose: () => void
  recent: SearchHistoryEntry[]
  saved: SavedFilterEntry[]
  onSelectRecent: (entry: SearchHistoryEntry) => void
  onSelectSaved: (entry: SavedFilterEntry) => void
  onRemoveRecent: (id: string) => Promise<void>
  onRemoveSaved: (id: string) => Promise<void>
  onRenameSaved: (id: string, newName: string) => Promise<void>
  onClearRecentAll: () => Promise<void>
  isLoading: boolean
}

export function SearchHistory({
  open,
  onClose,
  recent,
  saved,
  onSelectRecent,
  onSelectSaved,
  onRemoveRecent,
  onRemoveSaved,
  onRenameSaved,
  onClearRecentAll,
  isLoading,
}: SearchHistoryProps) {
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!open || isLoading) return null

  const handleRenameStart = (id: string, currentName: string) => {
    setRenamingId(id)
    setRenamingValue(currentName)
  }

  const handleRenameSave = async (id: string) => {
    if (!renamingValue.trim()) return
    setIsSaving(true)
    try {
      await onRenameSaved(id, renamingValue)
      setRenamingId(null)
      setRenamingValue('')
    } finally {
      setIsSaving(false)
    }
  }

  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `hace ${minutes}m`
    if (hours < 24) return `hace ${hours}h`
    if (days === 1) return 'Ayer'
    if (days < 7) return `hace ${days}d`
    return new Date(timestamp).toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div
      className="absolute top-full left-0 right-0 mt-1 w-full md:w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 flex flex-col overflow-hidden"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      {/* Header Tabs */}
      <div className="border-b border-slate-200 flex">
        <button
          onClick={() => setActiveTab('recent')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'recent'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-1.5" />
          Recientes
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'saved'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Star className="w-4 h-4 inline mr-1.5" />
          Guardados
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'recent' && (
          <div className="divide-y divide-slate-200">
            {recent.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 text-center">
                No hay búsquedas recientes
              </div>
            ) : (
              recent.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => {
                    onSelectRecent(entry)
                    onClose()
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start justify-between gap-2 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {entry.q || '(Sin texto)'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatTime(entry.timestamp)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveRecent(entry.id)
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded transition-opacity"
                    aria-label="Borrar"
                  >
                    <X className="w-4 h-4 text-slate-600" />
                  </button>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="divide-y divide-slate-200">
            {saved.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 text-center">
                No hay filtros guardados
              </div>
            ) : (
              saved.map((entry) => (
                <div
                  key={entry.id}
                  className="px-4 py-3 hover:bg-slate-50 transition-colors flex items-start justify-between gap-2 group"
                >
                  <button
                    onClick={() => {
                      onSelectSaved(entry)
                      onClose()
                    }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-sm font-medium text-slate-900 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-yellow-500" />
                      {renamingId === entry.id ? (
                        <input
                          type="text"
                          value={renamingValue}
                          onChange={(e) => setRenamingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameSave(entry.id)
                            } else if (e.key === 'Escape') {
                              setRenamingId(null)
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="flex-1 px-2 py-0.5 border border-indigo-300 rounded text-sm"
                        />
                      ) : (
                        <span className="truncate">{entry.name}</span>
                      )}
                    </div>
                  </button>

                  {renamingId === entry.id ? (
                    <div className="flex gap-1 opacity-100">
                      <button
                        onClick={() => handleRenameSave(entry.id)}
                        disabled={isSaving || !renamingValue.trim()}
                        className="px-2 py-1 text-xs bg-indigo-600 text-white rounded disabled:opacity-50"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="px-2 py-1 text-xs bg-slate-200 rounded"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRenameStart(entry.id, entry.name)
                        }}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600"
                        title="Renombrar"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveSaved(entry.id)
                        }}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {activeTab === 'recent' && recent.length > 0 && (
        <div className="border-t border-slate-200 p-2">
          <button
            onClick={onClearRecentAll}
            className="w-full px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded transition-colors"
          >
            Borrar historial
          </button>
        </div>
      )}
    </div>
  )
}
