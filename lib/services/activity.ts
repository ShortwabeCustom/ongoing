import db from '@/lib/db';
import { ActivityAction } from '@/lib/generated/prisma/client';

export interface PresenceInfo {
  userId: string;
  status: 'online' | 'editing' | 'idle' | 'offline';
  lastSeen: Date;
}

export class ActivityService {
  static async logActivity(
    userId: string,
    action: ActivityAction,
    resourceId: string,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      await db.activity.create({
        data: {
          userId,
          action,
          resourceType: 'finding',
          resourceId,
          details: details ?? undefined,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
      throw error;
    }
  }

  static async getRecentActivity(findingId: string, limit: number = 50) {
    return db.activity.findMany({
      where: { resourceId: findingId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  static async getActivityByUser(userId: string, limit: number = 50) {
    return db.activity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  static async getActivityStats(findingId: string) {
    const activities = await db.activity.findMany({
      where: { resourceId: findingId },
    });

    const stats = {
      totalEvents: activities.length,
      uniqueUsers: new Set(activities.map(a => a.userId)).size,
      actionCounts: {} as Record<string, number>,
      lastActivityAt: activities.length > 0 ? activities[0].createdAt : null,
    };

    for (const activity of activities) {
      stats.actionCounts[activity.action] =
        (stats.actionCounts[activity.action] || 0) + 1;
    }

    return stats;
  }

  static async getUserPresence(userId: string): Promise<PresenceInfo | null> {
    // In a real implementation, this would come from Redis cache
    // For now, return based on last activity
    const lastActivity = await db.activity.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastActivity) {
      return null;
    }

    // If activity was in last 5 minutes, user is online
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isRecent = lastActivity.createdAt > fiveMinutesAgo;

    return {
      userId,
      status: isRecent ? 'online' : 'offline',
      lastSeen: lastActivity.createdAt,
    };
  }

  static async updatePresence(
    userId: string,
    status: 'online' | 'editing' | 'idle' | 'offline'
  ): Promise<PresenceInfo> {
    // In a real implementation, this would store in Redis with TTL
    // For now, just log the activity
    await this.logActivity(
      userId,
      'FINDING_VIEWED',
      'presence-update',
      { status }
    );

    return {
      userId,
      status,
      lastSeen: new Date(),
    };
  }

  static async clearExpiredPresence(maxAgeMinutes: number = 15) {
    // Clean up activities older than maxAgeMinutes
    const cutoffDate = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    // In a real implementation with Redis, this would be automatic via TTL
    // This is just for reference/cleanup purposes
    return {
      message: `Activities before ${cutoffDate.toISOString()} would be cleaned up`,
    };
  }

  static async getCoActivityStats(findingId: string) {
    const activities = await this.getRecentActivity(findingId, 100);
    const recentUsers = new Set<string>();
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    for (const activity of activities) {
      if (activity.createdAt > tenMinutesAgo) {
        recentUsers.add(activity.userId);
      }
    }

    return {
      activeUserCount: recentUsers.size,
      activeUsers: Array.from(recentUsers),
      recentActivityCount: activities.filter(
        a => a.createdAt > tenMinutesAgo
      ).length,
    };
  }
}
