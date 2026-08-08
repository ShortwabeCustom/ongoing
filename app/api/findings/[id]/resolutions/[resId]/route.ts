import { NextRequest, NextResponse } from 'next/server'
import { ResolutionService } from '@/lib/services/resolution-service'
import { UpdateResolutionStateSchema } from '@/lib/validators/workflow'
import { apiSuccess, apiError } from '@/lib/utils/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; resId: string } },
) {
  try {
    const { id: findingId, resId } = params

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
    return handleApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; resId: string } },
) {
  try {
    const { id: findingId, resId } = params
    const userId = 'temp-user-id' // TODO: Get from session (FASE 7)

    const body = await request.json()
    const input = UpdateResolutionStateSchema.parse(body)

    const resolution = await ResolutionService.updateResolutionState(
      findingId,
      resId,
      input,
      userId,
    )

    return apiSuccess({
      status: 'success',
      data: resolution,
    })
  } catch (error) {
    return apiError(error)
  }
}
