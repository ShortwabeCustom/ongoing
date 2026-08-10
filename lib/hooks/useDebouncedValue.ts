'use client'

import { useState, useEffect } from 'react'

/**
 * Hook que retorna un valor debounced
 * Útil para evitar búsquedas / API calls excesivas mientras el usuario está escribiendo
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delayMs])

  return debouncedValue
}
