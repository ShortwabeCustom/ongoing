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
  FINDING_CREATED: 'bg-[#e0f5e9] text-[#087244]',
  FINDING_UPDATED: 'bg-[#fff5df] text-[#85540d]',
  FINDING_DELETED: 'bg-[#fff0eb] text-[#9b321f]',
  FINDING_VIEWED: 'bg-[#eef3ec] text-[#3b4b43]',
  RESOLUTION_ADDED: 'bg-[#e0f5e9] text-[#087244]',
  RESOLUTION_UPDATED: 'bg-[#e0f5e9] text-[#087244]',
  VALIDATION_COMPLETED: 'bg-[#edf4ed] text-[#052b20]',
  COMMENT_ADDED: 'bg-[#eef8f0] text-[#087244]',
  STATUS_CHANGED: 'bg-[#fff5df] text-[#85540d]',
  ASSIGNED: 'bg-[#edf4ed] text-[#052b20]',
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
      <div className="rounded-lg border border-[#f1c8bd] bg-[#fff0eb] p-4 text-[#9b321f]">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="pm-card p-6">
      <h3 className="mb-4 text-lg font-semibold text-[#17251f]">
        Actividad Reciente
      </h3>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[#eef3ec]" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-center text-[#65766e]">Sin actividad registrada</p>
      ) : (
        <div className="space-y-3">
          {activities.slice(0, limit).map((activity) => (
            <div
              key={activity.id}
              className="flex items-start justify-between gap-3 border-b border-[#edf2ee] pb-3 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${ACTION_COLORS[activity.action] || 'bg-[#eef3ec] text-[#3b4b43]'}`}
                  >
                    {ACTION_LABELS[activity.action] || activity.action}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#3b4b43]">
                  <span className="font-medium">{activity.userName}</span>{' '}
                  {ACTION_LABELS[activity.action]?.toLowerCase() || 'actualizó'}{' '}
                  {activity.resourceType}
                </p>
              </div>
              <time className="whitespace-nowrap text-xs text-[#65766e]">
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
