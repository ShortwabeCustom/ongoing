import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST, DELETE } from '../subscribe/route'
import { NextRequest } from 'next/server'
import { checkRBAC } from '@/lib/middleware/rbac'
import { PushSubscriptionService } from '@/lib/services/push-subscription'

vi.mock('@/lib/middleware/rbac')
vi.mock('@/lib/services/push-subscription')

describe('POST /api/notifications/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should subscribe to push notifications', async () => {
    const mockRequest = new Request('http://localhost:3000/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        subscription: {
          endpoint: 'https://example.com/push',
          keys: {
            auth: 'auth-key',
            p256dh: 'p256dh-key',
          },
        },
      }),
    }) as unknown as NextRequest

    vi.mocked(checkRBAC).mockResolvedValue({
      valid: true,
      user: { id: 'user-123' },
    })

    vi.mocked(PushSubscriptionService.savePushSubscription).mockResolvedValue({
      id: 'sub-123',
      userId: 'user-123',
      endpoint: 'https://example.com/push',
      auth: 'auth-key',
      p256dh: 'p256dh-key',
      userAgent: 'Mozilla/5.0',
      createdAt: new Date(),
      expiresAt: null,
    } as any)

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.subscriptionId).toBe('sub-123')
  })

  it('should return 403 if RBAC check fails', async () => {
    const mockRequest = new Request('http://localhost:3000/api/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription: {} }),
    }) as unknown as NextRequest

    const mockErrorResponse = new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
    })

    vi.mocked(checkRBAC).mockResolvedValue({
      valid: false,
      error: mockErrorResponse,
    })

    const response = await POST(mockRequest)

    expect(response.status).toBe(403)
  })

  it('should return 400 for invalid subscription data', async () => {
    const mockRequest = new Request('http://localhost:3000/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: {
          endpoint: 'invalid-endpoint',
          keys: { auth: 'key' },
        },
      }),
    }) as unknown as NextRequest

    vi.mocked(checkRBAC).mockResolvedValue({
      valid: true,
      user: { id: 'user-123' },
    })

    const response = await POST(mockRequest)

    expect(response.status).toBe(400)
  })
})

describe('DELETE /api/notifications/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should unsubscribe from push notifications', async () => {
    const mockRequest = new Request('http://localhost:3000/api/notifications/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://example.com/push',
      }),
    }) as unknown as NextRequest

    vi.mocked(checkRBAC).mockResolvedValue({
      valid: true,
      user: { id: 'user-123' },
    })

    vi.mocked(PushSubscriptionService.removePushSubscription).mockResolvedValue(undefined)

    const response = await DELETE(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(PushSubscriptionService.removePushSubscription).toHaveBeenCalledWith(
      'user-123',
      'https://example.com/push'
    )
  })

  it('should return 403 if RBAC check fails', async () => {
    const mockRequest = new Request('http://localhost:3000/api/notifications/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: 'https://example.com' }),
    }) as unknown as NextRequest

    const mockErrorResponse = new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
    })

    vi.mocked(checkRBAC).mockResolvedValue({
      valid: false,
      error: mockErrorResponse,
    })

    const response = await DELETE(mockRequest)

    expect(response.status).toBe(403)
  })

  it('should return 400 for invalid endpoint', async () => {
    const mockRequest = new Request('http://localhost:3000/api/notifications/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'invalid',
      }),
    }) as unknown as NextRequest

    vi.mocked(checkRBAC).mockResolvedValue({
      valid: true,
      user: { id: 'user-123' },
    })

    const response = await DELETE(mockRequest)

    expect(response.status).toBe(400)
  })
})
