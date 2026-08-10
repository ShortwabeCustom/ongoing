import { prisma } from '@/lib/prisma'
import { WebPushHandler } from '@/lib/services/web-push-handler'
import { PushSubscriptionService } from '@/lib/services/push-subscription'

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, any>
}

export class PushNotificationService {
  static async sendPushToUser(
    userId: string,
    notification: PushNotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    if (!userId || !notification.title || !notification.body) {
      throw new Error('userId, title, and body are required')
    }

    try {
      const subscriptions = await PushSubscriptionService.getPushSubscriptionsForUser(userId)

      if (subscriptions.length === 0) {
        return { sent: 0, failed: 0 }
      }

      const endpoints = subscriptions.map((sub) => ({
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh,
        },
      }))

      return await this.sendPushWithRetry(endpoints, notification, 3)
    } catch (error) {
      console.error('Error sending push to user:', error)
      throw error
    }
  }

  static async sendPushToUsers(
    userIds: string[],
    notification: PushNotificationPayload
  ): Promise<void> {
    if (!userIds || userIds.length === 0) {
      throw new Error('userIds array is required')
    }

    try {
      const promises = userIds.map((userId) =>
        this.sendPushToUser(userId, notification)
      )

      await Promise.all(promises)
    } catch (error) {
      console.error('Error sending push to multiple users:', error)
      throw error
    }
  }

  static async sendPushToAll(
    notification: PushNotificationPayload
  ): Promise<void> {
    if (!notification.title || !notification.body) {
      throw new Error('title and body are required')
    }

    try {
      const subscriptions = await PushSubscriptionService.getAllActivePushSubscriptions()

      if (subscriptions.length === 0) {
        console.log('No active subscriptions found')
        return
      }

      const endpoints = subscriptions.map((sub) => ({
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh,
        },
      }))

      await this.sendPushWithRetry(endpoints, notification, 3)
    } catch (error) {
      console.error('Error sending push to all users:', error)
      throw error
    }
  }

  static async sendPushWithRetry(
    endpoints: Array<{
      endpoint: string
      keys: { auth: string; p256dh: string }
    }>,
    notification: PushNotificationPayload,
    maxRetries: number = 3
  ): Promise<{ sent: number; failed: number }> {
    if (!endpoints || endpoints.length === 0) {
      return { sent: 0, failed: 0 }
    }

    let sent = 0
    let failed = 0

    for (const endpoint of endpoints) {
      let retries = 0
      let success = false

      while (retries < maxRetries && !success) {
        try {
          await WebPushHandler.sendNotificationToBrowser(endpoint, notification)
          sent++
          success = true
        } catch (error: any) {
          retries++

          // Mark subscription as expired if 410 Gone
          if (error.statusCode === 410) {
            console.log(`Subscription expired: ${endpoint.endpoint}`)
            await PushSubscriptionService.markSubscriptionExpired(endpoint.endpoint)
            failed++
            success = true // Don't retry 410 errors
          } else if (retries >= maxRetries) {
            console.error(`Failed to send push after ${maxRetries} retries:`, error)
            failed++
            success = true // Exit retry loop
          } else {
            // Exponential backoff: 100ms, 200ms, 400ms
            const delay = Math.pow(2, retries - 1) * 100
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        }
      }
    }

    return { sent, failed }
  }

  static async logNotification(
    userId: string,
    notification: PushNotificationPayload
  ): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          title: notification.title,
          body: notification.body,
          type: notification.tag,
          data: notification.data || null,
          isRead: false,
        },
      })
    } catch (error) {
      console.error('Error logging notification:', error)
      // Don't throw - logging failure shouldn't block push sending
    }
  }

  static async getNotifications(
    userId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      return await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
    } catch (error) {
      console.error('Error fetching notifications:', error)
      throw error
    }
  }

  static async markAsRead(notificationId: string): Promise<void> {
    try {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      })
    } catch (error) {
      console.error('Error marking notification as read:', error)
      throw error
    }
  }

  static async deleteNotification(notificationId: string): Promise<void> {
    try {
      await prisma.notification.delete({
        where: { id: notificationId },
      })
    } catch (error) {
      console.error('Error deleting notification:', error)
      throw error
    }
  }

  static async clearAllNotifications(userId: string): Promise<void> {
    try {
      await prisma.notification.deleteMany({
        where: { userId },
      })
    } catch (error) {
      console.error('Error clearing notifications:', error)
      throw error
    }
  }

  static async getUnreadCount(userId: string): Promise<number> {
    try {
      return await prisma.notification.count({
        where: { userId, isRead: false },
      })
    } catch (error) {
      console.error('Error getting unread count:', error)
      throw error
    }
  }
}
