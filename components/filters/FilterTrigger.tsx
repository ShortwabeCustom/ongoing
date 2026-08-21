'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { PopoverTrigger } from '@/components/ui/popover'

interface FilterTriggerProps extends React.ComponentPropsWithoutRef<typeof PopoverTrigger> {
  label: string
  /** Number of active selections for this filter, shown as a numeric badge. */
  count?: number
  /**
   * For non-countable filters (e.g. a date range, which is "on" or "off"
   * rather than "N selected"): shows `${label} · ${activeLabel}` instead of
   * a numeric badge, and applies the same active styling as `count`. Takes
   * precedence over `count` if both are set.
   */
  activeLabel?: string
  icon?: React.ReactNode
}

/**
 * Homologated trigger for Estado / Prioridad / Proyecto / Asignado / Ronda /
 * Más filtros. Open/active state comes from Base UI's `data-popup-open`
 * attribute, so there is no local isOpen bookkeeping here.
 */
const FilterTrigger = React.forwardRef<HTMLButtonElement, FilterTriggerProps>(
  ({ label, count, activeLabel, icon, className, ...props }, ref) => {
    const hasSelection = Boolean(activeLabel || (count && count > 0))
    // The visual badge is aria-hidden (decorative), so the count still needs
    // to reach the accessible name — otherwise a screen reader user can't
    // tell how many options are selected (Recognition over Recall, section 36).
    const accessibleLabel = activeLabel
      ? `${label} · ${activeLabel}`
      : count && count > 0
        ? `${label} · ${count} seleccionados`
        : label

    return (
      <PopoverTrigger
        ref={ref}
        aria-label={accessibleLabel}
        className={cn(
          'group inline-flex h-10 min-h-10 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors',
          'hover:bg-muted',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'data-[popup-open]:border-ring data-[popup-open]:bg-muted',
          hasSelection && 'border-primary/50 bg-primary/5 font-semibold text-primary hover:bg-primary/10',
          'disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {icon}
        {/* aria-label above is the source of truth for the accessible name; this stays a plain visual label. */}
        <span>{activeLabel ? `${label} · ${activeLabel}` : label}</span>
        {!activeLabel && hasSelection && (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground"
            aria-hidden
          >
            {count}
          </span>
        )}
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[popup-open]:rotate-180"
          aria-hidden
        />
      </PopoverTrigger>
    )
  },
)
FilterTrigger.displayName = 'FilterTrigger'

export { FilterTrigger }
