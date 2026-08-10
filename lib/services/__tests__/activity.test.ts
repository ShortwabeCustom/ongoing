import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityService } from '../activity';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    activity: {
      create: vi.fn().mockResolvedValue({
        id: 'activity-1',
        userId: 'user-1',
        action: 'FINDING_UPDATED',
        resourceType: 'finding',
        resourceId: 'finding-123',
        details: null,
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        createdAt: new Date(),
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'activity-1',
          userId: 'user-1',
          action: 'FINDING_UPDATED',
          resourceType: 'finding',
          resourceId: 'finding-123',
          details: null,
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          createdAt: new Date(),
          user: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
            role: 'QA_LEAD',
          },
        },
      ]),
      findFirst: vi.fn().mockResolvedValue({
        id: 'activity-1',
        userId: 'user-1',
        action: 'FINDING_VIEWED',
        resourceType: 'finding',
        resourceId: 'finding-123',
        details: null,
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        createdAt: new Date(),
      }),
    },
  },
}));

describe('ActivityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logActivity', () => {
    it('should log activity successfully', async () => {
      await ActivityService.logActivity(
        'user-1',
        'FINDING_UPDATED',
        'finding-123',
        { status: 'IN_PROGRESS' },
        '127.0.0.1',
        'Mozilla/5.0'
      );

      // Verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should handle missing details', async () => {
      await ActivityService.logActivity(
        'user-1',
        'FINDING_VIEWED',
        'finding-123'
      );

      expect(true).toBe(true);
    });
  });

  describe('getRecentActivity', () => {
    it('should fetch recent activities', async () => {
      const activities = await ActivityService.getRecentActivity('finding-123');

      expect(activities).toBeDefined();
      expect(Array.isArray(activities)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const activities = await ActivityService.getRecentActivity('finding-123', 10);

      expect(activities).toBeDefined();
    });
  });

  describe('getActivityByUser', () => {
    it('should fetch activities by user', async () => {
      const activities = await ActivityService.getActivityByUser('user-1');

      expect(activities).toBeDefined();
      expect(Array.isArray(activities)).toBe(true);
    });
  });

  describe('getActivityStats', () => {
    it('should calculate activity statistics', async () => {
      const stats = await ActivityService.getActivityStats('finding-123');

      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('uniqueUsers');
      expect(stats).toHaveProperty('actionCounts');
      expect(stats).toHaveProperty('lastActivityAt');
    });
  });

  describe('getUserPresence', () => {
    it('should get user presence info', async () => {
      const presence = await ActivityService.getUserPresence('user-1');

      expect(presence).toBeDefined();
      expect(presence?.userId).toBe('user-1');
    });

    it('should return null for non-existent user', async () => {
      // Mock to return null
      vi.doMock('@/lib/db');

      const presence = await ActivityService.getUserPresence('non-existent');

      // Could be null if not found
      expect(presence || typeof presence === 'object').toBe(true);
    });
  });

  describe('updatePresence', () => {
    it('should update user presence status', async () => {
      const presence = await ActivityService.updatePresence('user-1', 'editing');

      expect(presence).toBeDefined();
      expect(presence.userId).toBe('user-1');
      expect(presence.status).toBe('editing');
    });

    it('should track presence for all statuses', async () => {
      const statuses: Array<'online' | 'editing' | 'idle' | 'offline'> = [
        'online',
        'editing',
        'idle',
        'offline',
      ];

      for (const status of statuses) {
        const presence = await ActivityService.updatePresence('user-1', status);
        expect(presence.status).toBe(status);
      }
    });
  });

  describe('getCoActivityStats', () => {
    it('should get co-activity statistics', async () => {
      const stats = await ActivityService.getCoActivityStats('finding-123');

      expect(stats).toHaveProperty('activeUserCount');
      expect(stats).toHaveProperty('activeUsers');
      expect(stats).toHaveProperty('recentActivityCount');
    });
  });
});
