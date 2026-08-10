'use client';

import { useActivity } from '@/lib/hooks/useActivity';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ActivityFeedProps {
  findingId: string;
  userId?: string;
  userName?: string;
  limit?: number;
  className?: string;
}

const actionLabels: Record<string, string> = {
  FINDING_CREATED: 'Creó',
  FINDING_UPDATED: 'Actualizó',
  FINDING_DELETED: 'Eliminó',
  FINDING_VIEWED: 'Vio',
  RESOLUTION_ADDED: 'Añadió resolución',
  RESOLUTION_UPDATED: 'Actualizó resolución',
  VALIDATION_COMPLETED: 'Completó validación',
  COMMENT_ADDED: 'Añadió comentario',
  STATUS_CHANGED: 'Cambió estado',
  ASSIGNED: 'Asignó',
};

const actionColors: Record<string, string> = {
  FINDING_CREATED: 'bg-green-100 text-green-800',
  FINDING_UPDATED: 'bg-blue-100 text-blue-800',
  FINDING_DELETED: 'bg-red-100 text-red-800',
  RESOLUTION_ADDED: 'bg-purple-100 text-purple-800',
  STATUS_CHANGED: 'bg-orange-100 text-orange-800',
};

export function ActivityFeed({
  findingId,
  userId,
  userName,
  limit = 20,
  className = '',
}: ActivityFeedProps) {
  const { activities, isLoading, error } = useActivity({
    findingId,
    userId,
    userName,
    limit,
  });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
        Error loading activities: {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse h-12 bg-gray-200 rounded" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No hay actividad aún
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Actividad Reciente
      </h3>

      <div className="space-y-2">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-900">
                  {activity.userName}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    actionColors[activity.action] ||
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {actionLabels[activity.action] || activity.action}
                </span>
              </div>

              {activity.details && Object.keys(activity.details).length > 0 && (
                <div className="text-xs text-gray-600 mt-1">
                  {Object.entries(activity.details)
                    .slice(0, 2)
                    .map(([key, value]) => (
                      <div key={key}>
                        {key}:{' '}
                        {typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)}
                      </div>
                    ))}
                </div>
              )}

              <div className="text-xs text-gray-500 mt-1">
                {formatDistanceToNow(activity.timestamp, {
                  addSuffix: true,
                  locale: es,
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
