'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRealtime } from './useRealtime';

export interface UserPresence {
  userId: string;
  userName: string;
  role?: string;
  status: 'online' | 'editing' | 'idle' | 'offline';
  lastSeen: Date;
}

export interface UsePresenceOptions {
  findingId?: string;
  userId?: string;
  userName?: string;
  role?: string;
}

export function usePresence(options: UsePresenceOptions = {}) {
  const { joinFinding, leaveFinding, updatePresence, on, off, isConnected } =
    useRealtime({
      autoConnect: true,
      userId: options.userId,
      userName: options.userName,
      role: options.role,
    });

  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [userStatus, setUserStatus] = useState<'online' | 'editing' | 'idle' | 'offline'>('online');
  const statusTimeoutRef = useRef<NodeJS.Timeout>();

  // Join finding room
  useEffect(() => {
    if (isConnected && options.findingId) {
      joinFinding(options.findingId);

      return () => {
        leaveFinding(options.findingId!);
      };
    }
  }, [isConnected, options.findingId, joinFinding, leaveFinding]);

  // Listen for presence changes
  useEffect(() => {
    const handlePresenceChanged = (data: any) => {
      setActiveUsers((prev) => {
        const filtered = prev.filter((u) => u.userId !== data.userId);
        if (data.status !== 'offline') {
          return [...filtered, { ...data, lastSeen: new Date() }];
        }
        return filtered;
      });
    };

    const handleUsersActive = (users: UserPresence[]) => {
      setActiveUsers(users);
    };

    on('presence:changed', handlePresenceChanged);
    on('users:active', handleUsersActive);

    return () => {
      off('presence:changed', handlePresenceChanged);
      off('users:active', handleUsersActive);
    };
  }, [on, off]);

  // Auto-update presence status
  useEffect(() => {
    if (!isConnected) return;

    // Update presence on mount
    updatePresence(userStatus, options.findingId);

    // Auto-idle after 5 minutes of inactivity
    const handleActivity = () => {
      if (userStatus !== 'editing') {
        setUserStatus('online');
        updatePresence('online', options.findingId);
      }

      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }

      statusTimeoutRef.current = setTimeout(() => {
        setUserStatus('idle');
        updatePresence('idle', options.findingId);
      }, 5 * 60 * 1000); // 5 minutes
    };

    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);

    return () => {
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, [isConnected, userStatus, updatePresence, options.findingId]);

  const setEditing = useCallback(() => {
    setUserStatus('editing');
    updatePresence('editing', options.findingId);
  }, [updatePresence, options.findingId]);

  const setViewing = useCallback(() => {
    setUserStatus('online');
    updatePresence('online', options.findingId);
  }, [updatePresence, options.findingId]);

  const setIdle = useCallback(() => {
    setUserStatus('idle');
    updatePresence('idle', options.findingId);
  }, [updatePresence, options.findingId]);

  return {
    activeUsers,
    userStatus,
    isConnected,
    setEditing,
    setViewing,
    setIdle,
  };
}
