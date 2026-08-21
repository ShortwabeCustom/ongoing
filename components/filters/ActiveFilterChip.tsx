'use client'

import * as React from 'react'
import { X } from 'lucide-react'

interface ActiveFilterChipProps {
  /** Filter name, e.g. "Estado". */
  label: string
  /** Current value, e.g. "Abierto" or "2 seleccionados". */
  value: string
  onRemove: () => void
  /** Override the remove button's accessible name if `label: value` isn't enough context. */
  removeLabel?: string
}

function ActiveFilterChip({ label, value, onRemove, removeLabel }: ActiveFilterChipProps) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-background pl-2.5 pr-1 text-xs font-medium text-foreground">
      <span>
        {label}: {value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel ?? `Eliminar filtro ${label}: ${value}`}
        className="rounded-full p-1 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  )
}

interface ActiveFilterChipListProps {
  children: React.ReactNode
  onClearAll?: () => void
  clearAllLabel?: string
}

/**
 * Wraps active-filter chips and only renders (with "Limpiar filtros") when
 * there is at least one chip — an empty chip row is not a valid state.
 */
function ActiveFilterChipList({ children, onClearAll, clearAllLabel = 'Limpiar filtros' }: ActiveFilterChipListProps) {
  const hasChips = React.Children.count(children) > 0
  if (!hasChips) return null

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 py-1" role="group" aria-label="Filtros activos">
      {children}
      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {clearAllLabel}
        </button>
      )}
    </div>
  )
}

export { ActiveFilterChip, ActiveFilterChipList }
