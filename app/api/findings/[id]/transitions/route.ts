import { NextRequest } from 'next/server'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { FindingService } from '@/lib/services/finding-service'
import { FindingStatusTransitionSchema } from '@/lib/validators/finding'
import { apiError, ApiError, apiSuccess } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.EDIT_FINDING_ANY,
    })
    if (!valid) return error

    const { id } = await params
    if (!id || id.length < 5) {
      throw new ApiError('INVALID_ID', 'Invalid finding ID format', undefined, 400)
    }

    const body = await request.json()
    const parsed = FindingStatusTransitionSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid transition data',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const finding = await FindingService.transitionFinding(id, parsed.data, user.id)
    return apiSuccess(finding)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('INVALID_STATUS_TRANSITION:')) {
      const [, from, to, allowed] = error.message.split(':')
      return apiError(
        new ApiError(
          'INVALID_STATUS_TRANSITION',
          `Cannot transition finding from ${from} to ${to}`,
          { toStatus: [`Allowed next statuses: ${allowed || 'none'}`] },
          409,
        ),
      )
    }

    return apiError(error)
  }
}
