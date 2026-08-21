'use client'

import * as React from 'react'
import { Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Popover } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { FilterTrigger } from './FilterTrigger'
import { FilterPopover } from './FilterPopover'

export interface SearchableFilterOption {
  value: string
  label: string
  /** Secondary metadata line, e.g. an import round's timestamp. */
  description?: string
}

interface SearchableFilterProps {
  label: string
  options: SearchableFilterOption[]
  value: string[]
  onChange: (value: string[]) => void
  icon?: React.ReactNode
  disabled?: boolean
  searchPlaceholder?: string
  /** Shown when the search term matches nothing. */
  emptyLabel?: string
  loading?: boolean
}

/**
 * For high-cardinality filters (Proyecto, Asignado, Ronda): checkbox list
 * with a local, non-debounced search — no network round-trip, so filtering
 * on every keystroke adds no latency.
 */
function SearchableFilter({
  label,
  options,
  value,
  onChange,
  icon,
  disabled,
  searchPlaceholder = 'Buscar...',
  emptyLabel = 'No encontramos resultados.',
  loading,
}: SearchableFilterProps) {
  const [query, setQuery] = React.useState('')

  const filteredOptions = React.useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(normalized) ||
        option.description?.toLowerCase().includes(normalized),
    )
  }, [options, query])

  return (
    <Popover onOpenChange={(open) => !open && setQuery('')}>
      <FilterTrigger label={label} count={value.length} icon={icon} disabled={disabled} />
      <FilterPopover
        title={label}
        search={
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={`Buscar en ${label.toLowerCase()}`}
              className={cn(
                'h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm text-foreground outline-none placeholder:text-muted-foreground',
                'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
              )}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        }
      >
        {loading ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Cargando...</p>
        ) : filteredOptions.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div role="group" aria-label={label} className="flex flex-col gap-0.5">
            {filteredOptions.map((option) => {
              const checked = value.includes(option.value)
              const inputId = `${label}-${option.value}`.replace(/\s+/g, '-')

              return (
                <label
                  key={option.value}
                  htmlFor={inputId}
                  className="flex min-h-9 cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                >
                  <Checkbox
                    id={inputId}
                    className="mt-0.5"
                    checked={checked}
                    onCheckedChange={(next) => {
                      onChange(next ? [...value, option.value] : value.filter((v) => v !== option.value))
                    }}
                  />
                  <span className="flex flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-muted-foreground" title={option.description}>
                        {option.description}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </FilterPopover>
    </Popover>
  )
}

export { SearchableFilter }
