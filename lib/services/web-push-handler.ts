'use server'

import webpush from 'web-push'

export interface PushNotification {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, any>
}

export class WebPushHandler {
  static initialized = false

  static initialize() {
    if (this.initialized) return

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT

    if (!publicKey || !privateKey || !subject) {
      throw new Error(
        'VAPID keys or subject not configured in environment variables'
      )
    }

    webpush.setVapidDetails(subject, publicKey, privateKey)
    this.initialized = true

    console.log('WebPush initialized successfully')
  }

  static async sendNotificationToBrowser(
    subscription: {
      endpoint: string
      keys: {
        auth: string
        p256dh: string
      }
    },
    notification: PushNotification
  ): Promise<void> {
    this.initialize()

    if (!subscription.endpoint || !subscription.keys) {
      throw new Error('Invalid subscription format')
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icons/app-icon-192.png',
      badge: notification.badge || '/icons/badge-96.png',
      tag: notification.tag || 'notification',
      data: notification.data || {},
    })

    try {
      await webpush.sendNotification(subscription, payload)
    } catch (error: any) {
      const statusCode = error.statusCode || 500
      const body = error.body || ''

      const webPushError = new Error(
        `Web Push Error: ${statusCode} - ${body}`
      ) as any
      webPushError.statusCode = statusCode
      webPushError.body = body
      webPushError.originalError = error

      throw webPushError
    }
  }

  static async handleSubscriptionExpired(
    _userId: string,
    _endpoint: string
  ): Promise<void> {
    // This is handled in PushSubscriptionService.markSubscriptionExpired
    // This method is here for clarity in the interface
  }

  static getPublicKey(): string | undefined {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  }

  static validateSubscription(subscription: any): boolean {
    if (!subscription) return false
    if (!subscription.endpoint) return false
    if (!subscription.keys) return false
    if (!subscription.keys.auth) return false
    if (!subscription.keys.p256dh) return false

    return true
  }
}
