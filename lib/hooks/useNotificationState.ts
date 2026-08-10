'use client'

import { useState, useCallback, useEffect } from 'react'

export interface Notification {
  id: string
  title: string
  body: string
  type?: string
  data?: Record<string, any>
  isRead: boolean
  createdAt: Date
}

export interface UseNotificationStateReturn {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void
  markAsRead: (id: string) => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  fetchNotifications: () => Promise<void>
}

export function useNotificationState(): UseNotificationStateReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      // In a real app, you would fetch from an API endpoint
      // For now, we'll just use localStorage or local state
      const stored = localStorage.getItem('app_notifications')
      if (stored) {
        setNotifications(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'createdAt'>) => {
      const newNotification: Notification = {
        ...notification,
        id: crypto.randomUUID(),
        createdAt: new Date(),
      }

      setNotifications((prev) => {
        const updated = [newNotification, ...prev].slice(0, 100) // Keep last 100
        localStorage.setItem('app_notifications', JSON.stringify(updated))
        return updated
      })
    },
    []
  )

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      localStorage.setItem('app_notifications', JSON.stringify(updated))
      return updated
    })

    // Optionally sync with backend
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [])

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id)
      localStorage.setItem('app_notifications', JSON.stringify(updated))
      return updated
    })

    // Optionally sync with backend
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }, [])

  const clearAll = useCallback(async () => {
    setNotifications([])
    localStorage.removeItem('app_notifications')

    // Optionally sync with backend
    try {
      await fetch('/api/notifications', { method: 'DELETE' })
    } catch (error) {
      console.error('Error clearing notifications:', error)
    }
  }, [])

  // Load notifications on mount
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    isLoading,
    addNotification,
    markAsRead,
    deleteNotification,
    clearAll,
    fetchNotifications,
  }
}
