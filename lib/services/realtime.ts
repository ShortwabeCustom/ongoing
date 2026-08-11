import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer, Server as HTTPServer } from 'http';
import db from '@/lib/db';

export interface FindingUpdate {
  findingId: string;
  data: Record<string, any>;
  version: number;
  userId: string;
  timestamp: Date;
}

export interface UserActivity {
  userId: string;
  userName: string;
  role?: string;
  status: 'online' | 'editing' | 'idle' | 'offline';
  lastSeen: Date;
}

export class RealtimeService {
  private static io: SocketIOServer | null = null;
  private static activeUsers: Map<string, UserActivity> = new Map();
  private static findingRooms: Map<string, Set<string>> = new Map();

  static initialize(server: HTTPServer): SocketIOServer {
    if (this.io) return this.io;

    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001',
        methods: ['GET', 'POST'],
      },
      adapter: process.env.SOCKET_ADAPTER === 'redis' ? undefined : undefined,
    });

    this.setupEventHandlers();
    return this.io;
  }

  private static setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const userId = socket.handshake.auth?.userId;
      if (!userId) {
        socket.disconnect();
        return;
      }

      // User joined
      this.activeUsers.set(userId, {
        userId,
        userName: socket.handshake.auth?.userName || 'Unknown',
        role: socket.handshake.auth?.role,
        status: 'online',
        lastSeen: new Date(),
      });

      // Handle finding:join
      socket.on('finding:join', ({ findingId }) => {
        socket.join(`finding:${findingId}`);
        if (!this.findingRooms.has(findingId)) {
          this.findingRooms.set(findingId, new Set());
        }
        this.findingRooms.get(findingId)?.add(userId);
        this.broadcastPresenceChange(findingId);
      });

      // Handle finding:leave
      socket.on('finding:leave', ({ findingId }) => {
        socket.leave(`finding:${findingId}`);
        const users = this.findingRooms.get(findingId);
        if (users) {
          users.delete(userId);
          if (users.size === 0) {
            this.findingRooms.delete(findingId);
          }
        }
        this.broadcastPresenceChange(findingId);
      });

      // Handle finding:update
      socket.on('finding:update', async ({ findingId, data, version }) => {
        try {
          this.io?.to(`finding:${findingId}`).emit('finding:updated', {
            userId,
            data,
            version,
            timestamp: new Date(),
          });

          await this.logActivity(userId, 'FINDING_UPDATED', findingId, data);
        } catch (error) {
          console.error('Error updating finding:', error);
          socket.emit('error', { message: 'Failed to update finding' });
        }
      });

      // Handle presence:update
      socket.on('presence:update', ({ status, resourceId }) => {
        const user = this.activeUsers.get(userId);
        if (user) {
          user.status = status;
          user.lastSeen = new Date();
          this.activeUsers.set(userId, user);

          if (resourceId) {
            this.io?.to(`finding:${resourceId}`).emit('presence:changed', {
              userId,
              status,
              resourceId,
            });
          }
        }
      });

      // Handle activity:log
      socket.on('activity:log', async ({ action, resourceId, details }) => {
        try {
          await this.logActivity(userId, action, resourceId, details);
          this.io?.emit('activity:new', {
            userId,
            action,
            resourceId,
            timestamp: new Date(),
          });
        } catch (error) {
          console.error('Error logging activity:', error);
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.activeUsers.delete(userId);
        this.io?.emit('user:offline', { userId });
      });
    });
  }

  static getIO(): SocketIOServer | null {
    return this.io;
  }

  static joinFinding(userId: string, findingId: string) {
    if (!this.findingRooms.has(findingId)) {
      this.findingRooms.set(findingId, new Set());
    }
    this.findingRooms.get(findingId)?.add(userId);
  }

  static leaveFinding(userId: string, findingId: string) {
    const users = this.findingRooms.get(findingId);
    if (users) {
      users.delete(userId);
      if (users.size === 0) {
        this.findingRooms.delete(findingId);
      }
    }
  }

  static broadcastFindingUpdate(findingId: string, update: FindingUpdate) {
    this.io?.to(`finding:${findingId}`).emit('finding:updated', update);
  }

  static getActiveUsers(findingId: string): UserActivity[] {
    const userIds = this.findingRooms.get(findingId) || new Set();
    return Array.from(userIds)
      .map(userId => this.activeUsers.get(userId))
      .filter((user): user is UserActivity => !!user);
  }

  async getActivityLog(findingId: string, limit: number = 50) {
    return db.activity.findMany({
      where: { resourceId: findingId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: true },
    });
  }

  private static async logActivity(
    userId: string,
    action: string,
    resourceId: string,
    details?: Record<string, any>
  ) {
    try {
      await db.activity.create({
        data: {
          userId,
          action: action as any,
          resourceType: 'finding',
          resourceId,
          details: details ?? undefined,
        },
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  private static broadcastPresenceChange(findingId: string) {
    const users = this.getActiveUsers(findingId);
    this.io?.to(`finding:${findingId}`).emit('users:active', users);
  }
}
