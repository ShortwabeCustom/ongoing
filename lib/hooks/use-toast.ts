import { useCallback, useState } from 'react'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

let toastId = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback(
    (message: string, type: Toast['type'] = 'info', duration = 4000) => {
      const id = String(toastId++)
      const toast: Toast = { id, message, type, duration }

      setToasts((prev) => [...prev, toast])

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id))
        }, duration)
      }

      return id
    },
    [],
  )

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback(
    (message: string, duration = 4000) => add(message, 'success', duration),
    [add],
  )

  const error = useCallback(
    (message: string, duration = 6000) => add(message, 'error', duration),
    [add],
  )

  const info = useCallback(
    (message: string, duration = 4000) => add(message, 'info', duration),
    [add],
  )

  return { toasts, add, remove, success, error, info }
}
