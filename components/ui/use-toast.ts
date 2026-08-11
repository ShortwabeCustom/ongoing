'use client'

type ToastInput = {
  title?: string
  description?: string
}

export function toast(input: ToastInput) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent('app:toast', {
      detail: {
        message: [input.title, input.description].filter(Boolean).join(': '),
      },
    }),
  )
}
