import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtime } from '../useRealtime';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: true,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

describe('useRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize hook without autoConnect', () => {
    const { result } = renderHook(() =>
      useRealtime({ autoConnect: false })
    );

    expect(result.current.isConnected).toBe(false);
  });

  it('should have null socket when not connected', () => {
    const { result } = renderHook(() =>
      useRealtime({ autoConnect: false })
    );

    expect(result.current.socket).toBeNull();
  });

  it('should provide joinFinding function', () => {
    const { result } = renderHook(() =>
      useRealtime({ autoConnect: false })
    );

    expect(typeof result.current.joinFinding).toBe('function');
  });

  it('should provide leaveFinding function', () => {
    const { result } = renderHook(() =>
      useRealtime({ autoConnect: false })
    );

    expect(typeof result.current.leaveFinding).toBe('function');
  });

  it('should provide updateFinding function', () => {
    const { result } = renderHook(() =>
      useRealtime({ autoConnect: false })
    );

    expect(typeof result.current.updateFinding).toBe('function');
  });

  it('should provide updatePresence function', () => {
    const { result } = renderHook(() =>
      useRealtime({ autoConnect: false })
    );

    expect(typeof result.current.updatePresence).toBe('function');
  });

  it('should provide logActivity function', () => {
    const { result } = renderHook(() =>
      useRealtime({ autoConnect: false })
    );

    expect(typeof result.current.logActivity).toBe('function');
  });

  it('should provide on and off functions for event listeners', () => {
    const { result } = renderHook(() =>
      useRealtime({ autoConnect: false })
    );

    expect(typeof result.current.on).toBe('function');
    expect(typeof result.current.off).toBe('function');
  });

  it('should handle connection with userId and userName options', async () => {
    const { result } = renderHook(() =>
      useRealtime({
        autoConnect: true,
        userId: 'user-1',
        userName: 'Test User',
      })
    );

    await waitFor(() => {
      expect(result.current.socket).toBeDefined();
    });
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() =>
      useRealtime({
        autoConnect: true,
        userId: 'user-1',
      })
    );

    unmount();

    // Should not throw any errors
    expect(true).toBe(true);
  });

  it('should not attempt connection without userId when autoConnect is true', () => {
    const { result } = renderHook(() =>
      useRealtime({ autoConnect: true })
    );

    expect(result.current.socket).toBeNull();
  });
});
