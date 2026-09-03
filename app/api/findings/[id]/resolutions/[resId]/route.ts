import { NextRequest } from 'next/server'
import { ResolutionService } from '@/lib/services/resolution-service'
import { UpdateResolutionStateSchema } from '@/lib/validators/workflow'
import { apiSuccess, apiError } from '@/lib/utils/api-response'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { FindingService } from '@/lib/services/finding-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resId: string }> },
) {
  try {
    // Igual que en resolutions/route.ts: GET no tenía checkRBAC alguno (gap
    // preexistente). Se añade VIEW_ALL_FINDINGS + guard de proyecto.
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })
    if (!valid) return error

    const { id: findingId, resId } = await params
    await FindingService.assertFindingAccess(findingId, user)

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
    await FindingService.assertFindingAccess(findingId, user)

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resId: string }> },
) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.DELETE_RESOLUTION,
    })
    if (!valid) return error

    const { id: findingId, resId } = await params
    await FindingService.assertFindingAccess(findingId, user)
    await ResolutionService.deleteResolution(findingId, resId, user.id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return apiError(error)
  }
}
