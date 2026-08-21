'use client'

import { cn } from '@/lib/utils'
import { Popover } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { FilterTrigger } from '@/components/filters/FilterTrigger'
import { FilterPopover } from '@/components/filters/FilterPopover'
import { DateTypeSelector } from './DateTypeSelector'
import { FINDING_SEVERITY_OPTIONS, SEVERITY_LABELS_ES } from '@/lib/constants/finding-options'
import type { AdvancedFilterValues } from '@/lib/types/search'

interface MoreFiltersPopoverProps {
  value: Pick<AdvancedFilterValues, 'dateType' | 'severity' | 'hasEvidence'>
  onChange: (patch: Partial<AdvancedFilterValues>) => void
  /** True when running on the Elasticsearch-down / PostgreSQL fallback, which can't filter by evidence. */
  disableEvidence?: boolean
}

const EVIDENCE_OPTIONS: Array<{ value: 'any' | 'with' | 'without'; label: string }> = [
  { value: 'any', label: 'Cualquiera' },
  { value: 'with', label: 'Con evidencia' },
  { value: 'without', label: 'Sin evidencia' },
]

/**
 * Replaces the desktop/mobile-forked AdvancedFilterPanel. Proyecto, Asignado
 * and Fecha were promoted to their own top-level triggers in SearchFindings
 * (FASE 4) — this popover only holds what's left: Tipo de fecha, Severidad
 * and Evidencia, grouped by section (semantic grouping, section 19). Every
 * control applies immediately, same as the rest of the filter bar — no
 * internal draft/Aplicar step.
 */
export function MoreFiltersPopover({ value, onChange, disableEvidence }: MoreFiltersPopoverProps) {
  const severity = value.severity ?? []
  const dateType = value.dateType ?? 'created'
  const hasEvidence = value.hasEvidence ?? 'any'

  const activeCount = severity.length + (dateType !== 'created' ? 1 : 0) + (hasEvidence !== 'any' ? 1 : 0)

  return (
    <Popover>
      <FilterTrigger label="Más filtros" count={activeCount} />
      <FilterPopover title="Más filtros">
        <div className="flex flex-col gap-4 px-1">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tipo de fecha
            </legend>
            <DateTypeSelector value={dateType} onChange={(type) => onChange({ dateType: type })} />
          </fieldset>

          <fieldset className="border-t border-border pt-3">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Severidad
            </legend>
            <div className="grid grid-cols-2 gap-0.5">
              {FINDING_SEVERITY_OPTIONS.map((sev) => {
                const checked = severity.includes(sev)
                const inputId = `more-filters-severity-${sev}`
                return (
                  <label
                    key={sev}
                    htmlFor={inputId}
                    className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-foreground hover:bg-muted"
                  >
                    <Checkbox
                      id={inputId}
                      checked={checked}
                      onCheckedChange={(next) => {
                        onChange({ severity: next ? [...severity, sev] : severity.filter((s) => s !== sev) })
                      }}
                    />
                    {SEVERITY_LABELS_ES[sev]}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <fieldset className={cn('border-t border-border pt-3', disableEvidence && 'pointer-events-none opacity-50')}>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Evidencia
            </legend>
            <div className="flex flex-col gap-0.5">
              {EVIDENCE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-foreground hover:bg-muted"
                >
                  <input
                    type="radio"
                    name="hasEvidence"
                    value={option.value}
                    checked={hasEvidence === option.value}
                    onChange={() => onChange({ hasEvidence: option.value })}
                    disabled={disableEvidence}
                    className="size-4 border-input text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {disableEvidence && (
              <p className="mt-2 text-xs text-muted-foreground">
                No disponible sin el índice de búsqueda (modo PostgreSQL).
              </p>
            )}
          </fieldset>
        </div>
      </FilterPopover>
    </Popover>
  )
}
