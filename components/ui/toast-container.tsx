'use client'

import { Toast } from '@/lib/hooks/use-toast'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getBgColor = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
    }
  }

  const getTextColor = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-900 dark:text-green-200'
      case 'error':
        return 'text-red-900 dark:text-red-200'
      case 'info':
      default:
        return 'text-blue-900 dark:text-blue-200'
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg pointer-events-auto ${getBgColor(toast.type)}`}
          role="alert"
        >
          {getIcon(toast.type)}
          <span className={`text-sm font-medium ${getTextColor(toast.type)}`}>
            {toast.message}
          </span>
          <button
            onClick={() => onRemove(toast.id)}
            className={`ml-2 p-1 hover:opacity-70 transition-opacity`}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
