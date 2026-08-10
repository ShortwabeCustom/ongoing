'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface UseRealtimeOptions {
  autoConnect?: boolean;
  userId?: string;
  userName?: string;
  role?: string;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!options.autoConnect && !options.userId) {
      return;
    }

    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

    socketRef.current = io(url, {
      auth: {
        userId: options.userId,
        userName: options.userName,
        role: options.role,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });

    socketRef.current.on('error', (err) => {
      setError(typeof err === 'string' ? err : 'Connection error');
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [options.autoConnect, options.userId, options.userName, options.role]);

  const joinFinding = useCallback((findingId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('Socket not connected');
      return;
    }
    socketRef.current.emit('finding:join', { findingId });
  }, []);

  const leaveFinding = useCallback((findingId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('Socket not connected');
      return;
    }
    socketRef.current.emit('finding:leave', { findingId });
  }, []);

  const updateFinding = useCallback(
    (findingId: string, data: Record<string, any>, version: number) => {
      if (!socketRef.current?.connected) {
        console.warn('Socket not connected');
        return;
      }
      socketRef.current.emit('finding:update', { findingId, data, version });
    },
    []
  );

  const updatePresence = useCallback(
    (status: 'online' | 'editing' | 'idle' | 'offline', resourceId?: string) => {
      if (!socketRef.current?.connected) {
        console.warn('Socket not connected');
        return;
      }
      socketRef.current.emit('presence:update', { status, resourceId });
    },
    []
  );

  const logActivity = useCallback(
    (action: string, resourceId: string, details?: Record<string, any>) => {
      if (!socketRef.current?.connected) {
        console.warn('Socket not connected');
        return;
      }
      socketRef.current.emit('activity:log', { action, resourceId, details });
    },
    []
  );

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  return {
    socket: socketRef.current,
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
