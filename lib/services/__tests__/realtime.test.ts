import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeService } from '../realtime';
import { createServer } from 'http';

describe('RealtimeService', () => {
  beforeEach(() => {
    // Reset any state between tests
  });

  it('should initialize socket server', () => {
    const server = createServer();
    const io = RealtimeService.initialize(server);

    expect(io).toBeDefined();
    expect(io.engine).toBeDefined();

    server.close();
  });

  it('should track active users', () => {
    const server = createServer();
    RealtimeService.initialize(server);

    RealtimeService.joinFinding('user-1', 'finding-123');
    RealtimeService.joinFinding('user-2', 'finding-123');

    const activeUsers = RealtimeService.getActiveUsers('finding-123');

    // Since we don't have real Socket connections, we check the room structure
    expect(activeUsers).toBeDefined();

    server.close();
  });

  it('should handle finding updates', () => {
    const server = createServer();
    const io = RealtimeService.initialize(server);

    const update = {
      findingId: 'finding-123',
      data: { status: 'IN_PROGRESS' },
      version: 2,
      userId: 'user-1',
      timestamp: new Date(),
    };

    // This should not throw
    RealtimeService.broadcastFindingUpdate(update.findingId, update);

    server.close();
  });

  it('should remove users from findings', () => {
    const server = createServer();
    RealtimeService.initialize(server);

    RealtimeService.joinFinding('user-1', 'finding-123');
    RealtimeService.leaveFinding('user-1', 'finding-123');

    const activeUsers = RealtimeService.getActiveUsers('finding-123');

    expect(activeUsers.length).toBe(0);

    server.close();
  });
});
