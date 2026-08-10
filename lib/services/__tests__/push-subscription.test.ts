import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PushSubscriptionService } from '../push-subscription'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

describe('PushSubscriptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('savePushSubscription', () => {
    it('should save a new push subscription', async () => {
      const userId = 'user-123'
      const subscription = {
        endpoint: 'https://push.example.com/v1/subscription',
        keys: {
          auth: 'auth-key',
          p256dh: 'p256dh-key',
        },
      }

      const mockResult = {
        id: 'sub-123',
        userId,
        ...subscription,
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
        expiresAt: null,
      }

      vi.mocked(prisma.pushSubscription.upsert).mockResolvedValue(mockResult as any)

      const result = await PushSubscriptionService.savePushSubscription(
        userId,
        subscription,
        'Mozilla/5.0'
      )

      expect(result).toEqual(mockResult)
      expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
        where: { endpoint: subscription.endpoint },
        update: {
          auth: subscription.keys.auth,
          p256dh: subscription.keys.p256dh,
          userAgent: 'Mozilla/5.0',
          expiresAt: null,
        },
        create: expect.objectContaining({
          userId,
          endpoint: subscription.endpoint,
          auth: subscription.keys.auth,
          p256dh: subscription.keys.p256dh,
        }),
      })
    })

    it('should throw error if userId is missing', async () => {
      const subscription = {
        endpoint: 'https://push.example.com/v1/subscription',
        keys: { auth: 'key', p256dh: 'key' },
      }

      await expect(
        PushSubscriptionService.savePushSubscription('', subscription)
      ).rejects.toThrow('userId and endpoint are required')
    })

    it('should throw error if endpoint is missing', async () => {
      const subscription = {
        endpoint: '',
        keys: { auth: 'key', p256dh: 'key' },
      }

      await expect(
        PushSubscriptionService.savePushSubscription('user-123', subscription as any)
      ).rejects.toThrow('userId and endpoint are required')
    })
  })

  describe('removePushSubscription', () => {
    it('should remove a push subscription', async () => {
      const userId = 'user-123'
      const endpoint = 'https://push.example.com/v1/subscription'

      vi.mocked(prisma.pushSubscription.findUnique).mockResolvedValue({
        id: 'sub-123',
        userId,
        endpoint,
        auth: 'key',
        p256dh: 'key',
        userAgent: null,
        createdAt: new Date(),
        expiresAt: null,
      } as any)

      vi.mocked(prisma.pushSubscription.delete).mockResolvedValue({} as any)

      await PushSubscriptionService.removePushSubscription(userId, endpoint)

      expect(prisma.pushSubscription.findUnique).toHaveBeenCalledWith({
        where: { endpoint },
      })
      expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
        where: { endpoint },
      })
    })

    it('should throw error if subscription not found', async () => {
      vi.mocked(prisma.pushSubscription.findUnique).mockResolvedValue(null)

      await expect(
        PushSubscriptionService.removePushSubscription('user-123', 'https://example.com')
      ).rejects.toThrow('Subscription not found')
    })

    it('should throw error if user is not owner', async () => {
      vi.mocked(prisma.pushSubscription.findUnique).mockResolvedValue({
        id: 'sub-123',
        userId: 'different-user',
        endpoint: 'https://example.com',
        auth: 'key',
        p256dh: 'key',
        userAgent: null,
        createdAt: new Date(),
        expiresAt: null,
      } as any)

      await expect(
        PushSubscriptionService.removePushSubscription('user-123', 'https://example.com')
      ).rejects.toThrow('Unauthorized to delete this subscription')
    })
  })

  describe('getPushSubscriptionsForUser', () => {
    it('should get all push subscriptions for a user', async () => {
      const userId = 'user-123'
      const mockSubscriptions = [
        {
          id: 'sub-1',
          userId,
          endpoint: 'https://example.com/1',
          auth: 'key',
          p256dh: 'key',
          userAgent: null,
          createdAt: new Date(),
          expiresAt: null,
        },
      ]

      vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue(mockSubscriptions as any)

      const result = await PushSubscriptionService.getPushSubscriptionsForUser(userId)

      expect(result).toEqual(mockSubscriptions)
      expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should return empty array if no subscriptions found', async () => {
      vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue([])

      const result = await PushSubscriptionService.getPushSubscriptionsForUser('user-123')

      expect(result).toEqual([])
    })
  })

  describe('getAllActivePushSubscriptions', () => {
    it('should get all active push subscriptions', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          userId: 'user-1',
          endpoint: 'https://example.com/1',
          auth: 'key',
          p256dh: 'key',
          userAgent: null,
          createdAt: new Date(),
          expiresAt: null,
        },
      ]

      vi.mocked(prisma.pushSubscription.findMany).mockResolvedValue(mockSubscriptions as any)

      const result = await PushSubscriptionService.getAllActivePushSubscriptions()

      expect(result).toEqual(mockSubscriptions)
      expect(prisma.pushSubscription.findMany).toHaveBeenCalled()
    })
  })

  describe('markSubscriptionExpired', () => {
    it('should mark a subscription as expired', async () => {
      const endpoint = 'https://example.com'

      vi.mocked(prisma.pushSubscription.update).mockResolvedValue({} as any)

      await PushSubscriptionService.markSubscriptionExpired(endpoint)

      expect(prisma.pushSubscription.update).toHaveBeenCalledWith({
        where: { endpoint },
        data: { expiresAt: expect.any(Date) },
      })
    })
  })

  describe('deleteExpiredSubscriptions', () => {
    it('should delete expired subscriptions', async () => {
      vi.mocked(prisma.pushSubscription.deleteMany).mockResolvedValue({
        count: 5,
      } as any)

      const result = await PushSubscriptionService.deleteExpiredSubscriptions()

      expect(result).toBe(5)
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalled()
    })
  })
})
