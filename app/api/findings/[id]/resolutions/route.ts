import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ResolutionService } from '@/lib/services/resolution-service'
import { CreateResolutionSchema } from '@/lib/validators/workflow'
import { apiSuccess, apiError } from '@/lib/utils/api-response'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // FASE 7: RBAC validation
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.CREATE_RESOLUTION,
    })
    if (!valid) return error

    const findingId = params.id

    const body = await request.json()
    const input = CreateResolutionSchema.parse(body)

    const resolution = await ResolutionService.createResolution(
      findingId,
      input,
      user.id,
    )

    return apiSuccess({ status: 'success', data: resolution }, 201)
  } catch (error) {
    return apiError(error)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const findingId = params.id
    const { searchParams } = new URL(request.url)

    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const result = await ResolutionService.getResolutions(findingId, limit, offset)

    return apiSuccess({ status: 'success', data: result })
  } catch (error) {
    return apiError(error)
  }
}
