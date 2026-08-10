'use client'

import { useEffect, useState } from 'react'
import { usePushNotifications } from '@/lib/hooks/usePushNotifications'

const PERMISSION_REQUESTED_KEY = 'push_permission_requested'

export function PushPermissionRequest() {
  const { isSupported, isPermissionGranted, isLoading, requestPermission, subscribe } =
    usePushNotifications()
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Only show if push is supported and permission not granted and haven't asked before
    if (
      isSupported &&
      !isPermissionGranted &&
      typeof window !== 'undefined'
    ) {
      const hasAsked = localStorage.getItem(PERMISSION_REQUESTED_KEY)
      if (!hasAsked) {
        setShowPrompt(true)
      }
    }
  }, [isSupported, isPermissionGranted])

  const handleEnable = async () => {
    try {
      const granted = await requestPermission()
      if (granted) {
        const reg = await navigator.serviceWorker.ready
        await subscribe(reg)
      }
      setShowPrompt(false)
      localStorage.setItem(PERMISSION_REQUESTED_KEY, 'true')
    } catch (error) {
      console.error('Error enabling push:', error)
      setShowPrompt(false)
      localStorage.setItem(PERMISSION_REQUESTED_KEY, 'true')
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem(PERMISSION_REQUESTED_KEY, 'true')
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-lg p-4 border border-gray-200 z-50">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">Notificaciones</h3>
          <p className="text-sm text-gray-600">
            Recibe alertas en tiempo real sobre cambios importantes en tus hallazgos
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleEnable}
          disabled={isLoading}
          className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Habilitando...' : 'Habilitar'}
        </button>
        <button
          onClick={handleDismiss}
          disabled={isLoading}
          className="flex-1 px-3 py-2 bg-gray-100 text-gray-900 text-sm font-medium rounded hover:bg-gray-200 disabled:opacity-50"
        >
          Luego
        </button>
      </div>
    </div>
  )
}
