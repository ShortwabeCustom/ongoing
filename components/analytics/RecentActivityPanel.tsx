'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const ACTION_LABELS: Record<string, string> = {
  FINDING_CREATED: 'Hallazgo creado',
  FINDING_UPDATED: 'Hallazgo actualizado',
  FINDING_DELETED: 'Hallazgo eliminado',
  FINDING_VIEWED: 'Hallazgo visto',
  RESOLUTION_ADDED: 'Resolución agregada',
  RESOLUTION_UPDATED: 'Resolución actualizada',
  VALIDATION_COMPLETED: 'Validación completada',
  COMMENT_ADDED: 'Comentario agregado',
  STATUS_CHANGED: 'Estado cambiado',
  ASSIGNED: 'Asignado',
}

const ACTION_COLORS: Record<string, string> = {
  FINDING_CREATED: 'bg-blue-100 text-blue-800',
  FINDING_UPDATED: 'bg-yellow-100 text-yellow-800',
  FINDING_DELETED: 'bg-red-100 text-red-800',
  FINDING_VIEWED: 'bg-gray-100 text-gray-800',
  RESOLUTION_ADDED: 'bg-green-100 text-green-800',
  RESOLUTION_UPDATED: 'bg-green-100 text-green-800',
  VALIDATION_COMPLETED: 'bg-purple-100 text-purple-800',
  COMMENT_ADDED: 'bg-cyan-100 text-cyan-800',
  STATUS_CHANGED: 'bg-orange-100 text-orange-800',
  ASSIGNED: 'bg-indigo-100 text-indigo-800',
}

interface Activity {
  id: string
  userName: string
  action: string
  resourceType: string
  resourceId: string
  createdAt: string
}

interface RecentActivityPanelProps {
  limit?: number
}

export function RecentActivityPanel({ limit = 20 }: RecentActivityPanelProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActivities = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch(
        `/api/analytics/activity?limit=${limit}`
      )
      if (!response.ok) throw new Error('Error al cargar actividad')
      const data = await response.json()
      setActivities(data.activities || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(fetchActivities, 30000)
    return () => clearInterval(interval)
  }, [limit])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">
        Actividad Reciente
      </h3>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-center text-gray-500">Sin actividad registrada</p>
      ) : (
        <div className="space-y-3">
          {activities.slice(0, limit).map((activity) => (
            <div
              key={activity.id}
              className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_COLORS[activity.action] || 'bg-gray-100 text-gray-800'}`}
                  >
                    {ACTION_LABELS[activity.action] || activity.action}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-700">
                  <span className="font-medium">{activity.userName}</span>{' '}
                  {ACTION_LABELS[activity.action]?.toLowerCase() || 'actualizó'}{' '}
                  {activity.resourceType}
                </p>
              </div>
              <time className="whitespace-nowrap text-xs text-gray-500">
                {formatDistanceToNow(new Date(activity.createdAt), {
                  addSuffix: true,
                  locale: es,
                })}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
