'use client'

import { useState, useEffect } from 'react'

type DebounceDelay = number | { mobile: number; desktop: number; breakpoint?: number }

/**
 * Hook que retorna un valor debounced
 * Útil para evitar búsquedas / API calls excesivas mientras el usuario está escribiendo
 * Soporta delay responsive: { mobile: 500, desktop: 300 } aplica distinto delay según breakpoint
 */
export function useDebouncedValue<T>(value: T, delay: DebounceDelay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const effectiveDelay =
      typeof delay === 'number'
        ? delay
        : typeof window !== 'undefined' &&
            window.matchMedia(`(min-width: ${delay.breakpoint ?? 768}px)`).matches
          ? delay.desktop
          : delay.mobile

    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, effectiveDelay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
