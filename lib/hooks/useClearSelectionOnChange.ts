'use client'

import { useEffect, useRef } from 'react'

export function useClearSelectionOnChange(key: string, clearSelection: () => void) {
  const previousKey = useRef(key)
  useEffect(() => {
    if (previousKey.current !== key) {
      clearSelection()
      previousKey.current = key
    }
  }, [key, clearSelection])
}
