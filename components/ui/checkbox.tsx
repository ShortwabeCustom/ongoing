'use client'

import * as React from 'react'
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border border-input bg-background outline-none transition-colors',
        'hover:border-ring/70',
        'data-[focused]:border-ring data-[focused]:ring-3 data-[focused]:ring-ring/50',
        'data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
