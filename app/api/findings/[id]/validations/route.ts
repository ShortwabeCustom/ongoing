import { NextRequest } from 'next/server'
import { ValidationService } from '@/lib/services/validation-service'
import { CreateValidationSchema } from '@/lib/validators/workflow'
import { apiSuccess, apiError } from '@/lib/utils/api-response'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.RUN_VALIDATION,
    })
    if (!valid) return error

    const { id: findingId } = await params

    const body = await request.json()
    const input = CreateValidationSchema.parse(body)

    const validation = await ValidationService.createValidation(
      findingId,
      input,
      user.id,
    )

    return apiSuccess(
      {
        status: 'success',
        data: validation,
      },
      201,
    )
  } catch (error) {
    return apiError(error)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { valid, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })
    if (!valid) return error

    const { id: findingId } = await params
    const { searchParams } = new URL(request.url)

    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const result = await ValidationService.getValidations(findingId, limit, offset)

    return apiSuccess({
      status: 'success',
      data: result,
    })
  } catch (error) {
    return apiError(error)
  }
}
