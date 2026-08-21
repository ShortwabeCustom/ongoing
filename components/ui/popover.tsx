'use client'

import * as React from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { cn } from '@/lib/utils'

// FASE 6 (section 25 — "popup exclusivity"): confirmed against Base UI's own
// types (PopoverRoot.d.ts) that separate Popover.Root instances do NOT
// coordinate with each other — the only cross-instance mechanism is
// `handle`, which attaches multiple *triggers* to one shared popover, a
// different feature. Every filter trigger in the shared bar (Estado,
// Proyecto, Fecha, ...) renders its own independent Root, so opening one
// while another is open used to leave both floating at once.
//
// This module-level registry is the minimal, shared fix: any Popover.Root
// that opens reports its own imperative `close()` here, and whichever one
// opens last closes whatever was open before it. No consumer becomes a
// controlled component and nothing about Base UI itself is reimplemented.
let activeClose: (() => void) | null = null

export function useExclusivePopover() {
  return React.useCallback((open: boolean, close: () => void) => {
    if (open) {
      if (activeClose && activeClose !== close) activeClose()
      activeClose = close
    } else if (activeClose === close) {
      activeClose = null
    }
  }, [])
}

function Popover({ onOpenChange, ...props }: PopoverPrimitive.Root.Props) {
  const actionsRef = React.useRef<PopoverPrimitive.Root.Actions>(null)
  const notifyExclusive = useExclusivePopover()

  const handleOpenChange = React.useCallback(
    (open: boolean, eventDetails: PopoverPrimitive.Root.ChangeEventDetails) => {
      notifyExclusive(open, () => actionsRef.current?.close())
      onOpenChange?.(open, eventDetails)
    },
    [notifyExclusive, onOpenChange],
  )

  return <PopoverPrimitive.Root data-slot="popover" actionsRef={actionsRef} onOpenChange={handleOpenChange} {...props} />
}

function PopoverTrigger({ className, ...props }: PopoverPrimitive.Trigger.Props) {
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      className={cn('outline-none', className)}
      {...props}
    />
  )
}

interface PopoverContentProps extends Omit<PopoverPrimitive.Popup.Props, 'children'> {
  /** Distance in px between the trigger and the popup. @default 8 */
  sideOffset?: number
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  /** Fixed width so every filter popover shares the same footprint. */
  width?: string
  positionerClassName?: string
  children?: React.ReactNode
}

/**
 * Shared popover shell for the filter system. Handles portal, viewport
 * collision (flip/shift), Escape, outside-press and focus return via
 * Base UI — none of that is reimplemented here.
 */
function PopoverContent({
  className,
  positionerClassName,
  sideOffset = 8,
  side = 'bottom',
  align = 'start',
  width = 'clamp(260px, 30vw, 360px)',
  children,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn('z-50 outline-none', positionerClassName)}
        style={{ width }}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            // FASE 6 (issue 5): `rounded-lg` alone doesn't clip children —
            // without `overflow-hidden` a rounded container only *paints* a
            // curved border while overflowing content still renders straight
            // past it. Every popover in the system (MultiSelectFilter,
            // SearchableFilter, MoreFiltersPopover, DateRangePicker) shares
            // this one Popup, so content escaping its rounded card came from
            // here, not from any individual filter's own layout.
            'w-full origin-[var(--transform-origin)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-none',
            'transition-[transform,opacity] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
