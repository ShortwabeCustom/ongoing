'use client';

import { usePresence } from '@/lib/hooks/usePresence';
import { PresenceIndicator } from './PresenceIndicator';
import { ChevronRight } from 'lucide-react';

interface PresenceListProps {
  findingId: string;
  userId?: string;
  userName?: string;
  role?: string;
}

const statusLabels: Record<string, string> = {
  online: 'Online',
  editing: 'Editing',
  idle: 'Idle',
  offline: 'Offline',
};

export function PresenceList({
  findingId,
  userId,
  userName,
  role,
}: PresenceListProps) {
  const { activeUsers, isConnected } = usePresence({
    findingId,
    userId,
    userName,
    role,
  });

  if (!isConnected) {
    return (
      <div className="text-center text-gray-500 text-sm py-4">
        Connecting...
      </div>
    );
  }

  if (activeUsers.length === 0) {
    return (
      <div className="text-center text-gray-500 text-sm py-8">
        No hay usuarios activos
      </div>
    );
  }

  // Group by status
  const byStatus = activeUsers.reduce(
    (acc, user) => {
      if (!acc[user.status]) {
        acc[user.status] = [];
      }
      acc[user.status].push(user);
      return acc;
    },
    {} as Record<string, typeof activeUsers>
  );

  const statusOrder = ['editing', 'online', 'idle', 'offline'];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">
        Usuarios Activos ({activeUsers.length})
      </h3>

      <div className="space-y-3">
        {statusOrder.map((status) => {
          const users = byStatus[status as keyof typeof byStatus];
          if (!users || users.length === 0) return null;

          return (
            <div key={status} className="space-y-2">
              <div className="text-xs font-medium text-gray-500 uppercase">
                {statusLabels[status]} ({users.length})
              </div>

              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PresenceIndicator
                        userId={user.userId}
                        userName={user.userName}
                        status={user.status}
                        lastSeen={user.lastSeen}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {user.userName}
                        </div>
                        {user.role && (
                          <div className="text-xs text-gray-500">{user.role}</div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
