'use client'

import { useState, useEffect, useRef } from 'react'
import { Clock, Star, Trash2, Edit2, Check, X } from 'lucide-react'
import { useSearchHistory, SearchHistoryEntry } from '@/lib/hooks/useSearchHistory'
import { useSavedFilters, SavedFilterEntry } from '@/lib/hooks/useSavedFilters'
import { AdvancedFilterValues } from '@/lib/types/search'

interface SearchHistoryProps {
  open: boolean
  onSelectHistory: (entry: SearchHistoryEntry) => void
  onSelectSavedFilter: (filter: SavedFilterEntry) => void
}

type Tab = 'recent' | 'saved'

export function SearchHistory({ open, onSelectHistory, onSelectSavedFilter }: SearchHistoryProps) {
  const [tab, setTab] = useState<Tab>('recent')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const { recent, clearAll: clearRecent, removeEntry } = useSearchHistory()
  const { saved, renameFilter, deleteFilter, clearAll: clearSaved } = useSavedFilters()

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingId])

  if (!open) return null

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id)
    setEditingName(currentName)
  }

  const handleSaveEdit = async (id: string) => {
    if (editingName.trim() && editingName !== saved.find((f) => f.id === id)?.name) {
      try {
        await renameFilter(id, editingName.trim())
      } catch (err) {
        console.error('Failed to rename filter:', err)
      }
    }
    setEditingId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(id)
    } else if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-40 max-h-96 overflow-hidden flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 bg-slate-50 shrink-0" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'recent'}
          onClick={() => setTab('recent')}
          className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'recent' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="inline w-4 h-4 mr-1" />
          Recientes
        </button>
        <button
          role="tab"
          aria-selected={tab === 'saved'}
          onClick={() => setTab('saved')}
          className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'saved' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Star className="inline w-4 h-4 mr-1" />
          Guardados
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'recent' && (
          <div role="tabpanel" className="divide-y divide-slate-200">
            {recent.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">Sin búsquedas recientes</div>
            ) : (
              recent.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => onSelectHistory(entry)}
                  className="w-full text-left px-4 py-3 hover:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{entry.q || '(sin texto)'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {entry.resultCount ? `${entry.resultCount} resultados` : ''}
                      {entry.timestamp && ` • ${new Date(entry.timestamp).toLocaleString()}`}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeEntry(entry.id)
                    }}
                    className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-indigo-500"
                    aria-label={`Remover: ${entry.q}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </button>
              ))
            )}
          </div>
        )}

        {tab === 'saved' && (
          <div role="tabpanel" className="divide-y divide-slate-200">
            {saved.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">Sin filtros guardados</div>
            ) : (
              saved.map((filter) => (
                <div
                  key={filter.id}
                  className="px-4 py-3 hover:bg-indigo-50 focus-within:bg-indigo-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => onSelectSavedFilter(filter)}
                      className="flex-1 text-left min-w-0 group focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-1"
                    >
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-500 shrink-0" />
                        <div className="text-sm font-medium text-slate-900 truncate group-hover:text-indigo-700 group-focus:text-indigo-700">
                          {editingId === filter.id ? (
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, filter.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full px-2 py-0.5 border border-indigo-300 rounded text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          ) : (
                            filter.name
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {editingId === filter.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(filter.id)}
                            className="p-1 hover:bg-green-100 rounded text-green-700 focus-visible:ring-2 focus-visible:ring-indigo-500"
                            aria-label="Confirmar cambio"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 hover:bg-red-100 rounded text-red-700 focus-visible:ring-2 focus-visible:ring-indigo-500"
                            aria-label="Cancelar cambio"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStartEdit(filter.id, filter.name)
                            }}
                            className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500"
                            aria-label={`Renombrar: ${filter.name}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteFilter(filter.id)
                            }}
                            className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-indigo-500"
                            aria-label={`Eliminar: ${filter.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {(tab === 'recent' ? recent.length > 0 : saved.length > 0) && (
        <div className="border-t border-slate-200 p-3 bg-slate-50 shrink-0">
          <button
            onClick={() => (tab === 'recent' ? clearRecent() : clearSaved())}
            className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 hover:bg-red-100 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Trash2 className="inline w-3 h-3 mr-1" />
            {tab === 'recent' ? 'Borrar historial' : 'Limpiar guardados'}
          </button>
        </div>
      )}
    </div>
  )
}
