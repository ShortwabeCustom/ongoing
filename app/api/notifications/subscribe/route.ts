import { NextRequest, NextResponse } from 'next/server'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { PushSubscriptionService } from '@/lib/services/push-subscription'
import { z } from 'zod'

const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      auth: z.string(),
      p256dh: z.string(),
    }),
  }),
})

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

export async function POST(request: NextRequest) {
  try {
    // RBAC: Only users who can receive notifications
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.RECEIVE_NOTIFICATIONS,
    })
    if (!valid) return error

    const body = await request.json()

    // Validate input
    const parsed = subscriptionSchema.safeParse(body)
    if (!parsed.success) {
      const fields: Record<string, string[]> = {}
      parsed.error.issues.forEach((issue) => {
        const path = issue.path.join('.')
        if (!fields[path]) fields[path] = []
        fields[path].push(issue.message)
      })
      throw new ApiError('VALIDATION_ERROR', 'Invalid subscription', fields, 400)
    }

    const { subscription } = parsed.data
    const userAgent = request.headers.get('user-agent') || undefined

    // Save subscription
    const result = await PushSubscriptionService.savePushSubscription(
      user.id,
      subscription,
      userAgent
    )

    return apiSuccess(
      {
        success: true,
        subscriptionId: result.id,
      },
      201
    )
  } catch (error: any) {
    if (error instanceof ApiError) {
      return error.toResponse()
    }

    console.error('Error in POST /api/notifications/subscribe:', error)
    return apiError('INTERNAL_SERVER_ERROR', 'Failed to save subscription', 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // RBAC: Only users who can receive notifications
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.RECEIVE_NOTIFICATIONS,
    })
    if (!valid) return error

    const body = await request.json()

    // Validate input
    const parsed = unsubscribeSchema.safeParse(body)
    if (!parsed.success) {
      const fields: Record<string, string[]> = {}
      parsed.error.issues.forEach((issue) => {
        const path = issue.path.join('.')
        if (!fields[path]) fields[path] = []
        fields[path].push(issue.message)
      })
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid endpoint',
        fields,
        400
      )
    }

    const { endpoint } = parsed.data

    // Remove subscription
    await PushSubscriptionService.removePushSubscription(user.id, endpoint)

    return apiSuccess({
      success: true,
    })
  } catch (error: any) {
    if (error instanceof ApiError) {
      return error.toResponse()
    }

    console.error('Error in DELETE /api/notifications/subscribe:', error)
    return apiError('INTERNAL_SERVER_ERROR', 'Failed to remove subscription', 500)
  }
}
