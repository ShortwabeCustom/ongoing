'use client'

import { useState } from 'react'
import { X, Edit2, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { SearchHistoryEntry, SavedFilterEntry, AdvancedFilterValues } from '@/lib/types/search'

interface SearchHistoryProps {
  open: boolean
  recentHistory: SearchHistoryEntry[]
  savedFilters: SavedFilterEntry[]
  onSelectRecent: (entry: SearchHistoryEntry) => void
  onSelectSaved: (entry: SavedFilterEntry) => void
  onRemoveRecent: (id: string) => void
  onRemoveSaved: (id: string) => void
  onRenameSaved: (id: string, newName: string) => void
  onClearHistory: () => void
  onClose: () => void
  onSaveFilter: (name: string, filters: AdvancedFilterValues, q?: string) => Promise<void>
}

export function SearchHistory({
  open,
  recentHistory,
  savedFilters,
  onSelectRecent,
  onSelectSaved,
  onRemoveRecent,
  onRemoveSaved,
  onRenameSaved,
  onClearHistory,
  onClose,
  onSaveFilter,
}: SearchHistoryProps) {
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')

  if (!open) return null

  const handleStartRename = (id: string, currentName: string) => {
    setRenamingId(id)
    setRenamingValue(currentName)
  }

  const handleConfirmRename = (id: string) => {
    if (renamingValue.trim()) {
      onRenameSaved(id, renamingValue.trim())
    }
    setRenamingId(null)
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-2 w-full md:w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-40">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('recent')}
          className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            activeTab === 'recent'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-600 border-transparent hover:text-slate-900'
          }`}
          role="tab"
          aria-selected={activeTab === 'recent'}
        >
          Recientes
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            activeTab === 'saved'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-600 border-transparent hover:text-slate-900'
          }`}
          role="tab"
          aria-selected={activeTab === 'saved'}
        >
          Guardados
        </button>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {activeTab === 'recent' && (
          <div className="divide-y divide-slate-200">
            {recentHistory.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                No hay búsquedas recientes
              </div>
            ) : (
              <>
                {recentHistory.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => {
                      onSelectRecent(entry)
                      onClose()
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between gap-2 focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 line-clamp-1">
                        {entry.q ? `"${entry.q}"` : '(búsqueda sin término)'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDistanceToNow(entry.timestamp, {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveRecent(entry.id)
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                      aria-label="Eliminar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </button>
                ))}
                <button
                  onClick={onClearHistory}
                  className="w-full px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-t border-slate-200"
                >
                  Borrar historial
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="divide-y divide-slate-200">
            {savedFilters.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                No hay filtros guardados
              </div>
            ) : (
              savedFilters.map((entry) => (
                <div
                  key={entry.id}
                  className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between gap-2 group"
                >
                  <button
                    onClick={() => {
                      onSelectSaved(entry)
                      onClose()
                    }}
                    className="flex-1 min-w-0 text-left focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-1"
                  >
                    <p className="text-sm font-medium text-slate-900 line-clamp-1">
                      ⭐ {entry.name}
                    </p>
                    {entry.q && (
                      <p className="text-xs text-slate-500">"{entry.q}"</p>
                    )}
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {renamingId === entry.id ? (
                      <input
                        type="text"
                        value={renamingValue}
                        onChange={(e) => setRenamingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmRename(entry.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onBlur={() => handleConfirmRename(entry.id)}
                        autoFocus
                        className="text-xs px-2 py-1 border border-indigo-300 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartRename(entry.id, entry.name)}
                          className="p-1 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                          aria-label="Renombrar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRemoveSaved(entry.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
