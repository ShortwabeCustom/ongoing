'use client';

import { usePresence } from '@/lib/hooks/usePresence';
import { PresenceIndicator } from './PresenceIndicator';

interface CollaborationBannerProps {
  findingId: string;
  userId?: string;
  userName?: string;
  role?: string;
}

export function CollaborationBanner({
  findingId,
  userId,
  userName,
  role,
}: CollaborationBannerProps) {
  const { activeUsers, isConnected } = usePresence({
    findingId,
    userId,
    userName,
    role,
  });

  const editingUsers = activeUsers.filter((u) => u.status === 'editing');
  const onlineCount = activeUsers.filter(
    (u) => u.status === 'online' || u.status === 'editing'
  ).length;

  if (!isConnected || onlineCount === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {activeUsers.slice(0, 3).map((user) => (
              <div key={user.userId}>
                <PresenceIndicator
                  userId={user.userId}
                  userName={user.userName}
                  status={user.status}
                  lastSeen={user.lastSeen}
                />
              </div>
            ))}
            {activeUsers.length > 3 && (
              <div className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full text-xs font-medium text-gray-700">
                +{activeUsers.length - 3}
              </div>
            )}
          </div>

          <div className="text-sm">
            <span className="font-medium text-gray-900">
              {onlineCount === 1 ? 'Estás' : onlineCount + ' usuarios están'} trabajando aquí
            </span>
            {editingUsers.length > 0 && (
              <div className="text-xs text-gray-600">
                {editingUsers.length === 1
                  ? `${editingUsers[0].userName} está editando`
                  : `${editingUsers.map((u) => u.userName).join(', ')} están editando`}
              </div>
            )}
          </div>
        </div>

        {!isConnected && (
          <div className="text-xs text-orange-600 font-medium">
            Reconectando...
          </div>
        )}
      </div>
    </div>
  );
}
