import { PushSubscription } from '@/lib/generated/prisma'
import { prisma } from '@/lib/prisma'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('1234567890abcdef', 12)

export interface PushSubscriptionJSON {
  endpoint: string
  keys: {
    auth: string
    p256dh: string
  }
}

export class PushSubscriptionService {
  static async savePushSubscription(
    userId: string,
    subscription: PushSubscriptionJSON,
    userAgent?: string
  ): Promise<PushSubscription> {
    if (!userId || !subscription.endpoint) {
      throw new Error('userId and endpoint are required')
    }

    try {
      const pushSubscription = await prisma.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        update: {
          auth: subscription.keys.auth,
          p256dh: subscription.keys.p256dh,
          userAgent,
          expiresAt: null,
        },
        create: {
          id: nanoid(),
          userId,
          endpoint: subscription.endpoint,
          auth: subscription.keys.auth,
          p256dh: subscription.keys.p256dh,
          userAgent,
        },
      })

      return pushSubscription
    } catch (error) {
      console.error('Error saving push subscription:', error)
      throw error
    }
  }

  static async removePushSubscription(
    userId: string,
    endpoint: string
  ): Promise<void> {
    if (!userId || !endpoint) {
      throw new Error('userId and endpoint are required')
    }

    try {
      const subscription = await prisma.pushSubscription.findUnique({
        where: { endpoint },
      })

      if (!subscription) {
        throw new Error('Subscription not found')
      }

      if (subscription.userId !== userId) {
        throw new Error('Unauthorized to delete this subscription')
      }

      await prisma.pushSubscription.delete({
        where: { endpoint },
      })
    } catch (error) {
      console.error('Error removing push subscription:', error)
      throw error
    }
  }

  static async getPushSubscriptionsForUser(
    userId: string
  ): Promise<PushSubscription[]> {
    if (!userId) {
      throw new Error('userId is required')
    }

    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })

      return subscriptions
    } catch (error) {
      console.error('Error fetching user subscriptions:', error)
      throw error
    }
  }

  static async getAllActivePushSubscriptions(): Promise<PushSubscription[]> {
    try {
      const now = new Date()
      const subscriptions = await prisma.pushSubscription.findMany({
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      })

      return subscriptions
    } catch (error) {
      console.error('Error fetching all active subscriptions:', error)
      throw error
    }
  }

  static async markSubscriptionExpired(endpoint: string): Promise<void> {
    try {
      await prisma.pushSubscription.update({
        where: { endpoint },
        data: { expiresAt: new Date() },
      })
    } catch (error) {
      console.error('Error marking subscription as expired:', error)
      throw error
    }
  }

  static async deleteExpiredSubscriptions(): Promise<number> {
    try {
      const now = new Date()
      const result = await prisma.pushSubscription.deleteMany({
        where: {
          expiresAt: {
            lt: now,
            not: null,
          },
        },
      })

      return result.count
    } catch (error) {
      console.error('Error deleting expired subscriptions:', error)
      throw error
    }
  }
}
