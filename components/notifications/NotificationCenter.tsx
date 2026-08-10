'use client'

import { useState } from 'react'
import { useNotificationState, Notification } from '@/lib/hooks/useNotificationState'

type FilterType = 'all' | 'unread' | 'read'

export function NotificationCenter() {
  const { notifications, unreadCount, isLoading, markAsRead, deleteNotification, clearAll } =
    useNotificationState()
  const [filter, setFilter] = useState<FilterType>('all')

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead
    if (filter === 'read') return n.isRead
    return true
  })

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id)
  }

  const handleDelete = async (id: string) => {
    await deleteNotification(id)
  }

  const handleClearAll = async () => {
    if (window.confirm('¿Estás seguro de que deseas eliminar todas las notificaciones?')) {
      await clearAll()
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notificaciones</h1>
        <p className="text-gray-600">Gestiona tus notificaciones y preferencias</p>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              No leídas ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                filter === 'read'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              Leídas ({notifications.length - unreadCount})
            </button>
          </div>

          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-4 py-2 bg-red-100 text-red-700 rounded font-medium hover:bg-red-200 transition-colors"
            >
              Limpiar todo
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="mt-2 text-gray-600">Cargando notificaciones...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center border border-gray-200">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Sin notificaciones</h3>
          <p className="text-gray-600">No hay notificaciones en este filtro</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={() => handleMarkAsRead(notification.id)}
              onDelete={() => handleDelete(notification.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: {
  notification: Notification
  onMarkAsRead: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow p-4 border-l-4 transition-colors ${
        notification.isRead ? 'border-gray-200' : 'border-blue-600'
      } ${!notification.isRead ? 'bg-blue-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">{notification.title}</h3>
            {notification.type && (
              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                {notification.type}
              </span>
            )}
          </div>

          <p className="text-gray-600 text-sm mb-2">{notification.body}</p>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <time dateTime={new Date(notification.createdAt).toISOString()}>
              {new Date(notification.createdAt).toLocaleString()}
            </time>
            {!notification.isRead && <span className="font-medium">• No leída</span>}
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {!notification.isRead && (
            <button
              onClick={onMarkAsRead}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Marcar como leída"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </button>
          )}

          <button
            onClick={onDelete}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Eliminar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
