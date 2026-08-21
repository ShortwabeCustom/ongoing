'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { PopoverContent } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'

interface FilterPopoverProps extends React.ComponentPropsWithoutRef<typeof PopoverContent> {
  title: string
  /** Rendered under the header, outside the scroll area (e.g. a search input). */
  search?: React.ReactNode
  /** Rendered after the scroll area, outside it (e.g. Limpiar/Aplicar). */
  footer?: React.ReactNode
  /** Options list. This is the only part that scrolls. */
  children: React.ReactNode
}

/**
 * Shared shell for every filter popover (Estado, Prioridad, Proyecto,
 * Asignado, Ronda, Más filtros). Owns width/height clamping and the single
 * scroll container so header + search stay pinned and only the option list
 * scrolls — see FASE 1 audit item B/C (double scroll, inconsistent sizing).
 */
function FilterPopover({ title, search, footer, children, className, ...props }: FilterPopoverProps) {
  return (
    <PopoverContent className={cn('flex flex-col p-0', className)} {...props}>
      <div className="px-3 pt-3 pb-1.5">
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>

      {search && <div className="px-3 pb-2">{search}</div>}

      {/*
        FASE 6 (issue 5): `100dvh-8rem` was a guess at how much viewport
        space is actually free — it ignores where Base UI's Positioner
        actually placed the popup after flip/shift (e.g. near the bottom of
        the viewport, hard against a browser toolbar, etc). `--available-height`
        is the real, live-computed value the Positioner already exposes for
        exactly this, so the list can never claim more room than truly exists.
      */}
      <ScrollArea className="max-h-[min(420px,var(--available-height))] border-t border-border">
        <div className="p-2">{children}</div>
      </ScrollArea>

      {footer && <div className="flex items-center justify-between gap-2 border-t border-border p-2">{footer}</div>}
    </PopoverContent>
  )
}

export { FilterPopover }
