'use client'

import { useState, useEffect, useCallback } from 'react'

export type NotificationPermission = 'default' | 'granted' | 'denied'

export interface UsePushNotificationsReturn {
  isSupported: boolean
  isPermissionGranted: boolean
  isLoading: boolean
  requestPermission: () => Promise<boolean>
  subscribe: (serviceWorkerReg: ServiceWorkerRegistration) => Promise<void>
  unsubscribe: () => Promise<void>
  sendTestNotification: () => Promise<void>
  permission: NotificationPermission
}

const PUSH_PERMISSION_CACHE_KEY = 'push_notification_permission_asked'

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isPermissionGranted, setIsPermissionGranted] = useState(false)

  // Check browser support
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    setIsSupported(supported)

    if (supported && 'Notification' in window) {
      setPermission(Notification.permission as NotificationPermission)
      setIsPermissionGranted(Notification.permission === 'granted')
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Push notifications not supported')
      return false
    }

    setIsLoading(true)

    try {
      const result = await Notification.requestPermission()
      setPermission(result as NotificationPermission)

      const granted = result === 'granted'
      setIsPermissionGranted(granted)

      // Store that we've asked the user
      if (typeof window !== 'undefined') {
        localStorage.setItem(PUSH_PERMISSION_CACHE_KEY, 'true')
      }

      return granted
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  const subscribe = useCallback(
    async (serviceWorkerReg: ServiceWorkerRegistration) => {
      if (!isSupported || !isPermissionGranted) {
        console.warn('Cannot subscribe: not supported or permission not granted')
        return
      }

      setIsLoading(true)

      try {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!publicKey) {
          throw new Error('VAPID public key not configured')
        }

        // Get or create push subscription
        let pushSubscription = await serviceWorkerReg.pushManager.getSubscription()

        if (!pushSubscription) {
          pushSubscription = await serviceWorkerReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          })
        }

        if (!pushSubscription) {
          throw new Error('Failed to create push subscription')
        }

        // Send to backend
        const response = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscription: pushSubscription.toJSON(),
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Failed to save subscription')
        }

        console.log('Push subscription saved to server')
      } catch (error) {
        console.error('Error subscribing to push:', error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [isSupported, isPermissionGranted]
  )

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return

    setIsLoading(true)

    try {
      const serviceWorkerReg = await navigator.serviceWorker.ready
      const pushSubscription = await serviceWorkerReg.pushManager.getSubscription()

      if (!pushSubscription) {
        console.log('No push subscription to remove')
        return
      }

      // Remove from backend
      const response = await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: pushSubscription.endpoint,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to remove subscription')
      }

      // Unsubscribe locally
      await pushSubscription.unsubscribe()

      console.log('Push subscription removed')
    } catch (error) {
      console.error('Error unsubscribing from push:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  const sendTestNotification = useCallback(async () => {
    if (!isSupported) return

    try {
      const serviceWorkerReg = await navigator.serviceWorker.ready
      await serviceWorkerReg.showNotification('Prueba', {
        body: 'Notificación de prueba del sistema',
        icon: '/icons/app-icon-192.png',
        badge: '/icons/badge-96.png',
        tag: 'test-notification',
        data: {
          url: '/',
        },
      })
    } catch (error) {
      console.error('Error sending test notification:', error)
      throw error
    }
  }, [isSupported])

  return {
    isSupported,
    isPermissionGranted,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
    permission,
  }
}

// Helper function to convert VAPID public key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}
