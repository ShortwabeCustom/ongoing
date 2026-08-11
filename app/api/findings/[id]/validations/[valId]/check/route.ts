import { NextRequest } from 'next/server'
import { ValidationService } from '@/lib/services/validation-service'
import { CheckValidationSchema } from '@/lib/validators/workflow'
import { apiSuccess, apiError } from '@/lib/utils/api-response'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; valId: string }> },
) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.RUN_VALIDATION,
    })
    if (!valid) return error

    const { id: findingId, valId } = await params

    const body = await request.json()
    const input = CheckValidationSchema.parse(body)

    const validation = await ValidationService.checkValidation(
      findingId,
      valId,
      input,
      user.id,
    )

    return apiSuccess({
      status: 'success',
      data: validation,
      message: `Validation result: ${validation.result}`,
    })
  } catch (error) {
    return apiError(error)
  }
}
