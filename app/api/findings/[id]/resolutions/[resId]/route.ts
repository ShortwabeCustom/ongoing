import { NextRequest } from 'next/server'
import { ResolutionService } from '@/lib/services/resolution-service'
import { UpdateResolutionStateSchema } from '@/lib/validators/workflow'
import { apiSuccess, apiError } from '@/lib/utils/api-response'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resId: string }> },
) {
  try {
    const { id: findingId, resId } = await params

    const resolution = await ResolutionService.getResolution(findingId, resId)

    if (!resolution) {
      return apiSuccess(
        {
          status: 'error',
          message: 'Resolution not found',
        },
        404,
      )
    }

    return apiSuccess({
      status: 'success',
      data: resolution,
    })
  } catch (error) {
    return apiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resId: string }> },
) {
  try {
    // FASE 7: RBAC validation
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.CHANGE_RESOLUTION_STATE_ANY,
    })
    if (!valid) return error

    const { id: findingId, resId } = await params

    const body = await request.json()
    const input = UpdateResolutionStateSchema.parse(body)

    const resolution = await ResolutionService.updateResolutionState(
      findingId,
      resId,
      input,
      user.id,
    )

    return apiSuccess({
      status: 'success',
      data: resolution,
    })
  } catch (error) {
    return apiError(error)
  }
}
