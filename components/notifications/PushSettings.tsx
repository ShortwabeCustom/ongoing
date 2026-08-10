'use client'

import { useState, useEffect } from 'react'
import { usePushNotifications } from '@/lib/hooks/usePushNotifications'

export function PushSettings() {
  const { isSupported, isPermissionGranted, isLoading, requestPermission, subscribe, unsubscribe, sendTestNotification } =
    usePushNotifications()
  const [isEnabled, setIsEnabled] = useState(false)
  const [pushDetails, setPushDetails] = useState<string[]>([])

  useEffect(() => {
    setIsEnabled(isPermissionGranted)
    fetchPushDetails()
  }, [isPermissionGranted])

  const fetchPushDetails = async () => {
    if (!isSupported) return

    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        setPushDetails([
          `Endpoint: ${subscription.endpoint.substring(0, 50)}...`,
          `Auth key: ${subscription.getKey('auth') ? 'Configurada' : 'No configurada'}`,
          `Suscrito desde: ${new Date(subscription.expirationTime || Date.now()).toLocaleDateString()}`,
        ])
      }
    } catch (error) {
      console.error('Error fetching push details:', error)
    }
  }

  const handleToggle = async () => {
    try {
      if (isEnabled) {
        await unsubscribe()
        setIsEnabled(false)
      } else {
        const granted = await requestPermission()
        if (granted) {
          const reg = await navigator.serviceWorker.ready
          await subscribe(reg)
          setIsEnabled(true)
          await fetchPushDetails()
        }
      }
    } catch (error) {
      console.error('Error toggling push:', error)
    }
  }

  const handleSendTest = async () => {
    try {
      await sendTestNotification()
    } catch (error) {
      console.error('Error sending test notification:', error)
    }
  }

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800 font-medium">
          Las notificaciones push no están disponibles en tu navegador.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Notificaciones Push</h3>
          <p className="text-gray-600 text-sm mt-1">
            Recibe alertas en tiempo real en tu navegador
          </p>
        </div>

        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={handleToggle}
            disabled={isLoading}
            className="sr-only"
          />
          <div
            className={`relative w-14 h-8 rounded-full transition-colors ${
              isEnabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <div
              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                isEnabled ? 'translate-x-6' : ''
              }`}
            />
          </div>
        </label>
      </div>

      {isEnabled && pushDetails.length > 0 && (
        <div className="bg-gray-50 rounded p-4 mb-6 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Detalles de la suscripción</h4>
          <ul className="space-y-2">
            {pushDetails.map((detail, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                {detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isEnabled && (
        <button
          onClick={handleSendTest}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Enviando...' : 'Enviar notificación de prueba'}
        </button>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-3">Información</h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Recibe notificaciones incluso cuando el navegador está cerrado
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Las notificaciones se sincronizarán automáticamente con tus dispositivos
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Puedes desactivar las notificaciones en cualquier momento
          </li>
        </ul>
      </div>
    </div>
  )
}
