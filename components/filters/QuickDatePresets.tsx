'use client'

import * as React from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface QuickDatePresetOption {
  key: string
  label: string
}

interface QuickDatePresetsProps {
  presets: QuickDatePresetOption[]
  /** Active preset key, or `undefined` when the current range doesn't match any preset (e.g. a custom range). */
  value?: string
  onChange: (key: string) => void
  className?: string
}

/**
 * Replaces the duplicated preset logic in DatePresetButtons.tsx (Findings)
 * and the inline presets in DateRangeFilter.tsx (Analytics). The set of
 * presets is provided by the caller — Analytics uses Hoy/7/30/90 días,
 * Findings can keep its own list (e.g. Ayer) without either page being
 * hardcoded to the other's options.
 */
function QuickDatePresets({ presets, value, onChange, className }: QuickDatePresetsProps) {
  return (
    <div role="group" aria-label="Periodo de análisis" className={cn('flex flex-wrap gap-2', className)}>
      {presets.map((preset) => {
        const active = preset.key === value

        return (
          <button
            key={preset.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(preset.key)}
            className={cn(
              'inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors',
              'hover:bg-muted',
              'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
              active && 'border-primary bg-primary/10 font-semibold text-primary hover:bg-primary/15',
            )}
          >
            {active && <Check className="size-3.5" aria-hidden />}
            {preset.label}
          </button>
        )
      })}
    </div>
  )
}

export { QuickDatePresets }
