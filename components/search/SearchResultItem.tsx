'use client'

import Link from 'next/link'
import { ArrowRight, FileText, Calendar, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  EXPERIENCE_TAG_LABELS_ES,
  INCIDENCE_TYPE_LABELS_ES,
  PRIORITY_LABELS_ES,
  STATUS_LABELS_ES,
  SEVERITY_LABELS_ES,
  SEVERITY_COLORS,
} from '@/lib/constants/finding-options'
import { cn } from '@/lib/utils'

interface SearchResultItemProps {
  id: string
  observation: string
  highlightedObservation?: string
  status: string
  priority: string
  severity: string
  projectId: string
  assigneeId?: string
  createdAt?: string | number
  experienceTags?: Array<{ experienceTag: string }> | string[]
  incidenceTypes?: Array<{ incidenceType: string }> | string[]
  selected: boolean
  onToggleSelect: (id: string) => void
  showCheckbox: boolean
  canDelete?: boolean
  onDeleted?: () => Promise<void> | void
}

function readRelationValue(item: unknown, key: 'experienceTag' | 'incidenceType') {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return undefined

  const value = (item as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

function getSeverityBorderColor(severity: string): string {
  switch (severity) {
    case 'BLOCKER':
      return 'border-l-red-600'
    case 'MAJOR':
      return 'border-l-orange-500'
    case 'MINOR':
      return 'border-l-yellow-500'
    case 'COSMETIC':
      return 'border-l-[#a8bab0]'
    default:
      return 'border-l-slate-300'
  }
}

function formatTimeAgo(timestamp?: string | number): string {
  if (!timestamp) return ''

  let timestampMs: number
  if (typeof timestamp === 'string') {
    timestampMs = new Date(timestamp).getTime()
  } else {
    timestampMs = timestamp
  }

  const now = Date.now()
  const diff = now - timestampMs
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `Hace ${days}d`
  if (hours > 0) return `Hace ${hours}h`
  if (minutes > 0) return `Hace ${minutes}m`
  return 'Ahora'
}

export function SearchResultItem({
  id,
  observation,
  highlightedObservation,
  status,
  priority,
  severity,
  projectId,
  assigneeId,
  createdAt,
  experienceTags,
  incidenceTypes,
  selected,
  onToggleSelect,
  showCheckbox,
  canDelete = false,
  onDeleted,
}: SearchResultItemProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const displayObservation = highlightedObservation || observation
  const areaValues =
    experienceTags
      ?.map((tag) => readRelationValue(tag, 'experienceTag'))
      .filter((tag): tag is string => Boolean(tag)) ?? []
  const incidenceValues =
    incidenceTypes
      ?.map((type) => readRelationValue(type, 'incidenceType'))
      .filter((type): type is string => Boolean(type)) ?? []
  const areaLabel =
    areaValues.map((tag) => EXPERIENCE_TAG_LABELS_ES[tag] ?? tag).join(', ') ||
    incidenceValues.map((type) => INCIDENCE_TYPE_LABELS_ES[type] ?? type).join(', ') ||
    ''

  const timeAgo = formatTimeAgo(createdAt)
  const severityLabel = SEVERITY_LABELS_ES[severity] ?? severity
  const statusLabel = STATUS_LABELS_ES[status] ?? status
  const priorityLabel = PRIORITY_LABELS_ES[priority] ?? priority

  return (
    <div className="flex items-stretch gap-0">
      {/* Checkbox */}
      {showCheckbox && (
        <label
          className="flex items-center justify-center min-w-[44px] cursor-pointer shrink-0 bg-[#fafbf9] hover:bg-[#edf4ed] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(id)}
            aria-label={`Seleccionar hallazgo ${id}`}
            className="h-5 w-5 rounded border-[#a8bab0] text-[#052b20] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
          />
        </label>
      )}

      {/* Content */}
      <div
        className={cn(
          'min-w-0 flex-1 border-l-4 px-4 py-3.5 flex flex-col gap-2.5',
          getSeverityBorderColor(severity),
        )}
      >
        {/* Row 1: Severity Badge + Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide shrink-0',
              SEVERITY_COLORS[severity] ?? 'bg-slate-100 text-slate-700 border-slate-200',
            )}
          >
            {severityLabel}
          </span>
          <span className="text-xs font-semibold text-[#65766e]">{statusLabel}</span>
          {canDelete && <button type="button" onClick={() => { setDeleteError(null); setConfirmingDelete(true) }} className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive" aria-label={`Eliminar hallazgo ${id}`} title="Eliminar hallazgo"><Trash2 className="h-4 w-4" /></button>}
        </div>

        {/* Row 2: Title */}
        <Link
          href={`/findings/${id}`}
          className="group/link flex items-start justify-between gap-3 min-w-0"
        >
          <span
            className="text-sm font-semibold leading-5 text-[#17251f] line-clamp-2 hover:text-[#087244] transition"
            dangerouslySetInnerHTML={{
              __html: displayObservation,
            }}
          />
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#00a85a] opacity-100 transition group-hover/link:opacity-100" />
        </Link>

        {/* Row 3: Metadata - Area/Incidence */}
        {areaLabel && (
          <div className="flex items-center gap-1.5 text-xs text-[#65766e]">
            <FileText className="h-3.5 w-3.5 shrink-0 text-[#a8bab0]" />
            {areaLabel}
          </div>
        )}

        {/* Row 4: Metadata - Time */}
        {timeAgo && (
          <div className="flex items-center gap-1.5 text-xs text-[#a8bab0]">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#a8bab0]" />
            {timeAgo}
          </div>
        )}
      </div>
      {confirmingDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby={`delete-${id}`}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 id={`delete-${id}`} className="text-lg font-semibold text-[#17251f]">Eliminar hallazgo</h2>
            <p className="mt-2 text-sm text-[#65766e]">El hallazgo dejará de aparecer en las vistas activas. Esta operación utiliza borrado lógico.</p>
            <p className="mt-3 line-clamp-2 text-sm font-medium">{observation}</p>
            {deleteError && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2"><button disabled={deleting} onClick={() => setConfirmingDelete(false)} className="min-h-11 rounded border border-[#dbe4dd] px-4">Cancelar</button><button disabled={deleting} onClick={async () => { setDeleting(true); setDeleteError(null); try { const response = await fetch(`/api/findings/${id}`, { method: 'DELETE' }); if (!response.ok) throw new Error(response.status === 403 ? 'No tienes permiso para eliminar este hallazgo.' : 'No se pudo eliminar el hallazgo. Inténtalo nuevamente.'); setConfirmingDelete(false); await onDeleted?.() } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'No se pudo eliminar el hallazgo.') } finally { setDeleting(false) } }} className="min-h-11 rounded bg-destructive px-4 text-white disabled:opacity-50">{deleting ? 'Eliminando...' : 'Eliminar'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
