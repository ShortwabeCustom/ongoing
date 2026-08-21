'use client'

import { useState } from 'react'
import { X, Clock, Star, Trash2, MoreVertical, Check } from 'lucide-react'
import { SearchHistoryEntry, SavedFilterEntry } from '@/lib/types/search'
import { buildHistoryEntryLabel } from '@/lib/utils/history-label'
import { cn } from '@/lib/utils'

interface SearchHistoryProps {
  /** Called after selecting a recent/saved entry, to close the host popover. */
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
  /** For rendering "Proyecto: <nombre real>" instead of a raw id in entry labels. */
  projectLabels?: Record<string, string>
  /** For rendering "<nombre real>" instead of a raw id in entry labels. */
  assigneeLabels?: Record<string, string>
}

/**
 * FASE 6 ("Vistas" workflow refinement): renamed conceptually from
 * "Recientes" (the trigger in SearchFindings now reads "Vistas" and covers
 * both tabs here) — this component's own two-tab Recientes/Guardadas
 * structure already matched that shape, so only naming/labels/tokens
 * changed, not the tab architecture or saved-filter logic (section 30).
 * Restyled onto the shared design tokens (border/bg-popover/foreground/
 * primary/muted) — this predates the FASE 1-6 filter refactor and was the
 * one remaining surface still on raw slate/indigo/yellow Tailwind defaults.
 *
 * Hotfix (popover positioning): this used to be its own `position: absolute
 * top-full` div, rendered as a sibling deep inside SearchFindings' JSX. Its
 * nearest positioned ancestor was that component's top-level `relative`
 * wrapper — which spans the whole panel, results list included — not the
 * "Vistas" button, so `top-full` landed near the bottom of the entire
 * component instead of under the trigger. Now hosted inside the shared
 * `PopoverContent` (components/ui/popover.tsx, the same Base UI Positioner
 * every other filter popover uses), which anchors to the actual trigger and
 * handles portal/collision/Escape/outside-press/focus-return — none of
 * that is reimplemented here anymore. This component is now just the
 * content shell (tabs + list + footer), not its own floating panel.
 */
export function SearchHistory({
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
  projectLabels,
  assigneeLabels,
}: SearchHistoryProps) {
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (isLoading) {
    return <div className="p-4 text-center text-sm text-muted-foreground">Cargando...</div>
  }

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
    <div className="flex max-h-96 w-full flex-col">
      {/* Header Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('recent')}
          className={cn(
            'flex-1 border-b-2 px-4 py-2.5 text-sm font-medium outline-none transition-colors',
            'focus-visible:ring-3 focus-visible:ring-ring/50',
            activeTab === 'recent'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Clock className="mr-1.5 inline size-4" aria-hidden />
          Recientes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('saved')}
          className={cn(
            'flex-1 border-b-2 px-4 py-2.5 text-sm font-medium outline-none transition-colors',
            'focus-visible:ring-3 focus-visible:ring-ring/50',
            activeTab === 'saved'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Star className="mr-1.5 inline size-4" aria-hidden />
          Guardadas
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'recent' && (
          <div className="divide-y divide-border">
            {recent.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No hay búsquedas recientes
              </div>
            ) : (
              recent.map((entry) => {
                const label = buildHistoryEntryLabel(entry, { projectLabels, assigneeLabels }) ?? 'Búsqueda'
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      onSelectRecent(entry)
                      onClose()
                    }}
                    className="group flex w-full items-start justify-between gap-2 px-4 py-3 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{label}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{formatTime(entry.timestamp)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveRecent(entry.id)
                      }}
                      className="rounded p-1 text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-border hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={`Borrar "${label}" del historial`}
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </button>
                )
              })
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="divide-y divide-border">
            {saved.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No hay filtros guardados
              </div>
            ) : (
              saved.map((entry) => (
                <div
                  key={entry.id}
                  className="group flex items-start justify-between gap-2 px-4 py-3 transition-colors hover:bg-muted"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSaved(entry)
                      onClose()
                    }}
                    className="min-w-0 flex-1 text-left outline-none"
                  >
                    <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                      <Star className="size-3.5 text-primary" aria-hidden />
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
                          className="flex-1 rounded-md border border-input bg-background px-2 py-0.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                      ) : (
                        <span className="truncate">{entry.name}</span>
                      )}
                    </div>
                  </button>

                  {renamingId === entry.id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleRenameSave(entry.id)}
                        disabled={isSaving || !renamingValue.trim()}
                        aria-label="Guardar nombre"
                        className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                      >
                        <Check className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        aria-label="Cancelar"
                        className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRenameStart(entry.id, entry.name)
                        }}
                        className="rounded p-1 text-muted-foreground outline-none hover:bg-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                        aria-label={`Renombrar "${entry.name}"`}
                      >
                        <MoreVertical className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveSaved(entry.id)
                        }}
                        className="rounded p-1 text-muted-foreground outline-none hover:bg-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                        aria-label={`Eliminar "${entry.name}"`}
                      >
                        <Trash2 className="size-4" aria-hidden />
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
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={onClearRecentAll}
            className="w-full rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Borrar historial
          </button>
        </div>
      )}
    </div>
  )
}
