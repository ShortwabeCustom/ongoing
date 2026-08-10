import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PushNotificationService } from '../push-notification'
import { PushSubscriptionService } from '../push-subscription'
import { WebPushHandler } from '../web-push-handler'
import { prisma } from '@/lib/prisma'

vi.mock('../push-subscription')
vi.mock('../web-push-handler')
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

describe('PushNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendPushToUser', () => {
    it('should send push notification to a user', async () => {
      const userId = 'user-123'
      const notification = {
        title: 'Test Notification',
        body: 'This is a test',
      }

      const mockSubscriptions = [
        {
          id: 'sub-1',
          endpoint: 'https://example.com/endpoint',
          auth: 'auth-key',
          p256dh: 'p256dh-key',
        },
      ]

      vi.mocked(PushSubscriptionService.getPushSubscriptionsForUser).mockResolvedValue(
        mockSubscriptions as any
      )

      vi.spyOn(PushNotificationService, 'sendPushWithRetry').mockResolvedValue({
        sent: 1,
        failed: 0,
      })

      const result = await PushNotificationService.sendPushToUser(userId, notification)

      expect(result.sent).toBe(1)
      expect(PushSubscriptionService.getPushSubscriptionsForUser).toHaveBeenCalledWith(userId)
    })

    it('should return 0 sent if user has no subscriptions', async () => {
      vi.mocked(PushSubscriptionService.getPushSubscriptionsForUser).mockResolvedValue([])

      const result = await PushNotificationService.sendPushToUser('user-123', {
        title: 'Test',
        body: 'Test',
      })

      expect(result).toEqual({ sent: 0, failed: 0 })
    })

    it('should throw error if title or body is missing', async () => {
      await expect(
        PushNotificationService.sendPushToUser('user-123', {
          title: '',
          body: 'Test',
        })
      ).rejects.toThrow('userId, title, and body are required')
    })
  })

  describe('sendPushToUsers', () => {
    it('should send push to multiple users', async () => {
      const userIds = ['user-1', 'user-2']
      const notification = { title: 'Test', body: 'Test' }

      vi.spyOn(PushNotificationService, 'sendPushToUser').mockResolvedValue({
        sent: 1,
        failed: 0,
      })

      await PushNotificationService.sendPushToUsers(userIds, notification)

      expect(PushNotificationService.sendPushToUser).toHaveBeenCalledTimes(2)
    })

    it('should throw error if userIds is empty', async () => {
      await expect(
        PushNotificationService.sendPushToUsers([], { title: 'Test', body: 'Test' })
      ).rejects.toThrow('userIds array is required')
    })
  })

  describe('sendPushToAll', () => {
    it('should send push to all active subscriptions', async () => {
      const notification = { title: 'Test', body: 'Test' }

      const mockSubscriptions = [
        {
          id: 'sub-1',
          endpoint: 'https://example.com/1',
          auth: 'auth',
          p256dh: 'key',
        },
      ]

      vi.mocked(PushSubscriptionService.getAllActivePushSubscriptions).mockResolvedValue(
        mockSubscriptions as any
      )

      vi.spyOn(PushNotificationService, 'sendPushWithRetry').mockResolvedValue({
        sent: 1,
        failed: 0,
      })

      await PushNotificationService.sendPushToAll(notification)

      expect(PushSubscriptionService.getAllActivePushSubscriptions).toHaveBeenCalled()
    })
  })

  describe('sendPushWithRetry', () => {
    it('should send push notifications with retry logic', async () => {
      const endpoints = [
        {
          endpoint: 'https://example.com/1',
          keys: { auth: 'auth', p256dh: 'key' },
        },
      ]

      const notification = { title: 'Test', body: 'Test' }

      vi.mocked(WebPushHandler.sendNotificationToBrowser).mockResolvedValue(undefined)

      const result = await PushNotificationService.sendPushWithRetry(
        endpoints,
        notification
      )

      expect(result.sent).toBe(1)
      expect(WebPushHandler.sendNotificationToBrowser).toHaveBeenCalled()
    })

    it('should handle 410 Gone errors', async () => {
      const endpoints = [
        {
          endpoint: 'https://example.com/1',
          keys: { auth: 'auth', p256dh: 'key' },
        },
      ]

      const error = new Error('Gone') as any
      error.statusCode = 410

      vi.mocked(WebPushHandler.sendNotificationToBrowser).mockRejectedValue(error)

      vi.spyOn(PushSubscriptionService, 'markSubscriptionExpired').mockResolvedValue(
        undefined
      )

      const result = await PushNotificationService.sendPushWithRetry(
        endpoints,
        { title: 'Test', body: 'Test' },
        3
      )

      expect(result.failed).toBe(1)
      expect(PushSubscriptionService.markSubscriptionExpired).toHaveBeenCalled()
    })
  })

  describe('logNotification', () => {
    it('should log a notification to database', async () => {
      const notification = { title: 'Test', body: 'Test' }

      vi.mocked(prisma.notification.create).mockResolvedValue({} as any)

      await PushNotificationService.logNotification('user-123', notification)

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          title: 'Test',
          body: 'Test',
        }),
      })
    })
  })

  describe('getNotifications', () => {
    it('should get user notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          title: 'Test',
          body: 'Test',
          isRead: false,
          createdAt: new Date(),
        },
      ]

      vi.mocked(prisma.notification.findMany).mockResolvedValue(mockNotifications as any)

      const result = await PushNotificationService.getNotifications('user-1')

      expect(result).toEqual(mockNotifications)
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    })
  })

  describe('getUnreadCount', () => {
    it('should get count of unread notifications', async () => {
      vi.mocked(prisma.notification.count).mockResolvedValue(5)

      const result = await PushNotificationService.getUnreadCount('user-1')

      expect(result).toBe(5)
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      })
    })
  })
})
