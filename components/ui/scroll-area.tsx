'use client'

import * as React from 'react'
import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area'

import { cn } from '@/lib/utils'

interface ScrollAreaProps extends ScrollAreaPrimitive.Root.Props {
  viewportClassName?: string
}

/**
 * Discrete, themed scrollbar for popover option lists. Replaces the
 * unstyled native scrollbar (the "dark/thick scrollbar" complaint) without
 * hiding it entirely, which would remove scroll affordance.
 */
function ScrollArea({ className, viewportClassName, children, ...props }: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn('relative', className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn('size-full overscroll-contain', viewportClassName)}
      >
        <ScrollAreaPrimitive.Content>{children}</ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        data-slot="scroll-area-scrollbar"
        orientation="vertical"
        className="m-0.5 flex w-1.5 justify-center rounded-full opacity-0 transition-opacity duration-150 data-[hovering]:opacity-100 data-[scrolling]:opacity-100"
      >
        <ScrollAreaPrimitive.Thumb
          data-slot="scroll-area-thumb"
          className="w-full rounded-full bg-foreground/25"
        />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  )
}

export { ScrollArea }
