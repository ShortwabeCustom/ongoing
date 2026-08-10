'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRealtime } from './useRealtime';

export interface ActivityEvent {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resourceId: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface UseActivityOptions {
  findingId?: string;
  userId?: string;
  userName?: string;
  limit?: number;
}

export function useActivity(options: UseActivityOptions = {}) {
  const { on, off, isConnected } = useRealtime({
    autoConnect: true,
    userId: options.userId,
    userName: options.userName,
  });

  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial activity log
  const fetchActivityLog = useCallback(async () => {
    if (!options.findingId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        findingId: options.findingId,
        limit: (options.limit || 50).toString(),
      });

      const response = await fetch(`/api/realtime/activity?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }

      const data = await response.json();
      setActivities(
        data.data.map((activity: any) => ({
          ...activity,
          timestamp: new Date(activity.createdAt),
          userName: activity.user.name,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [options.findingId, options.limit]);

  // Initial fetch
  useEffect(() => {
    if (isConnected && options.findingId) {
      fetchActivityLog();
    }
  }, [isConnected, options.findingId, fetchActivityLog]);

  // Listen for new activities
  useEffect(() => {
    const handleNewActivity = (activity: any) => {
      setActivities((prev) => {
        // Add new activity to the beginning
        const newActivity: ActivityEvent = {
          id: activity.resourceId + Date.now(),
          timestamp: new Date(activity.timestamp),
          userName: activity.userName || 'Unknown',
          ...activity,
        };

        // Keep only the limit
        return [newActivity, ...prev].slice(0, options.limit || 50);
      });
    };

    on('activity:new', handleNewActivity);

    return () => {
      off('activity:new', handleNewActivity);
    };
  }, [on, off, options.limit]);

  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  const getActivitiesByAction = useCallback(
    (action: string) => {
      return activities.filter((a) => a.action === action);
    },
    [activities]
  );

  const getActivitiesByUser = useCallback(
    (userId: string) => {
      return activities.filter((a) => a.userId === userId);
    },
    [activities]
  );

  return {
    activities,
    isLoading,
    error,
    fetchActivityLog,
    clearActivities,
    getActivitiesByAction,
    getActivitiesByUser,
  };
}
