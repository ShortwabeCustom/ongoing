'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseRealtimeOptions {
  autoConnect?: boolean;
  userId?: string;
  userName?: string;
  role?: string;
}

type RealtimeHandler = (...args: any[]) => void;

export function useRealtime(options: UseRealtimeOptions = {}) {
  const handlersRef = useRef<Map<string, Set<RealtimeHandler>>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!options.autoConnect && !options.userId) return;

    // Realtime is intentionally optional in the first dynamic/offline phase.
    // The app keeps working via Route Handlers when no socket client is bundled.
    setIsConnected(false);
    setError(null);
  }, [options.autoConnect, options.userId, options.userName, options.role]);

  const emitLocal = useCallback((event: string, payload: unknown) => {
    const handlers = handlersRef.current.get(event);
    handlers?.forEach((handler) => handler(payload));
  }, []);

  const joinFinding = useCallback((findingId: string) => {
    emitLocal('finding:joined', { findingId });
  }, [emitLocal]);

  const leaveFinding = useCallback((findingId: string) => {
    emitLocal('finding:left', { findingId });
  }, [emitLocal]);

  const updateFinding = useCallback(
    (findingId: string, data: Record<string, any>, version: number) => {
      emitLocal('finding:update:queued', { findingId, data, version });
    },
    [emitLocal],
  );

  const updatePresence = useCallback(
    (status: 'online' | 'editing' | 'idle' | 'offline', resourceId?: string) => {
      emitLocal('presence:changed', {
        userId: options.userId,
        userName: options.userName,
        role: options.role,
        status,
        resourceId,
      });
    },
    [emitLocal, options.role, options.userId, options.userName],
  );

  const logActivity = useCallback(
    (action: string, resourceId: string, details?: Record<string, any>) => {
      emitLocal('activity:local', { action, resourceId, details });
    },
    [emitLocal],
  );

  const on = useCallback((event: string, callback: RealtimeHandler) => {
    const handlers = handlersRef.current.get(event) ?? new Set<RealtimeHandler>();
    handlers.add(callback);
    handlersRef.current.set(event, handlers);
  }, []);

  const off = useCallback((event: string, callback?: RealtimeHandler) => {
    if (!callback) {
      handlersRef.current.delete(event);
      return;
    }

    const handlers = handlersRef.current.get(event);
    handlers?.delete(callback);
  }, []);

  return {
    socket: null,
    isConnected,
    error,
    joinFinding,
    leaveFinding,
    updateFinding,
    updatePresence,
    logActivity,
    on,
    off,
  };
}
