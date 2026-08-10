'use client';

import { useEffect, useState } from 'react';
import { UserCircle } from 'lucide-react';
import clsx from 'clsx';

interface PresenceIndicatorProps {
  userId: string;
  userName: string;
  status: 'online' | 'editing' | 'idle' | 'offline';
  lastSeen?: Date;
}

export function PresenceIndicator({
  userId,
  userName,
  status,
  lastSeen,
}: PresenceIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const statusColors: Record<string, string> = {
    online: 'bg-green-500',
    editing: 'bg-blue-500',
    idle: 'bg-yellow-500',
    offline: 'bg-gray-400',
  };

  const statusLabels: Record<string, string> = {
    online: 'Online',
    editing: 'Editing',
    idle: 'Idle',
    offline: 'Offline',
  };

  const formatLastSeen = (date?: Date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div
      className="relative inline-flex items-center gap-2"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="relative">
        <UserCircle className="w-8 h-8 text-gray-400" />
        <div
          className={clsx(
            'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white',
            statusColors[status],
            status === 'online' && 'animate-pulse'
          )}
        />
      </div>

      {showTooltip && (
        <div className="absolute bottom-full mb-2 left-0 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50">
          <div className="font-medium">{userName}</div>
          <div className="text-gray-300">{statusLabels[status]}</div>
          <div className="text-gray-400 text-xs">
            Last: {formatLastSeen(lastSeen)}
          </div>
        </div>
      )}
    </div>
  );
}
