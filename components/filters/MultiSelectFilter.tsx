'use client'

import * as React from 'react'

import { Popover } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { FilterTrigger } from './FilterTrigger'
import { FilterPopover } from './FilterPopover'

export interface FilterOption {
  value: string
  label: string
}

interface MultiSelectFilterProps {
  label: string
  options: FilterOption[]
  value: string[]
  onChange: (value: string[]) => void
  icon?: React.ReactNode
  disabled?: boolean
  emptyLabel?: string
}

/**
 * For low-cardinality filters (Estado, Prioridad, Severidad): checkbox list,
 * no search — adding a search box here would fail Hick's Law by asking the
 * user to decide whether to use it for 3-4 options.
 */
function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
  icon,
  disabled,
  emptyLabel = 'No hay opciones disponibles.',
}: MultiSelectFilterProps) {
  return (
    <Popover>
      <FilterTrigger label={label} count={value.length} icon={icon} disabled={disabled} />
      <FilterPopover title={label}>
        {options.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div role="group" aria-label={label} className="flex flex-col gap-0.5">
            {options.map((option) => {
              const checked = value.includes(option.value)
              const inputId = `${label}-${option.value}`.replace(/\s+/g, '-')

              return (
                <label
                  key={option.value}
                  htmlFor={inputId}
                  className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                >
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    onCheckedChange={(next) => {
                      onChange(next ? [...value, option.value] : value.filter((v) => v !== option.value))
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              )
            })}
          </div>
        )}
      </FilterPopover>
    </Popover>
  )
}

export { MultiSelectFilter }
