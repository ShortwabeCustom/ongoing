import { NextRequest } from 'next/server'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { FindingService } from '@/lib/services/finding-service'
import { apiError, apiSuccess, ApiError } from '@/lib/utils/api-response'
import { BulkDeleteSchema } from '@/lib/validators/bulk-delete'

export async function POST(request: NextRequest) {
  const { valid, user, error } = await checkRBAC(request, {
    allowedRoles: RBAC_PERMISSIONS.DELETE_FINDING,
  })
  if (!valid) return error

  try {
    const parsed = BulkDeleteSchema.safeParse(await request.json())
    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', 'IDs de hallazgos inválidos', parsed.error.flatten().fieldErrors, 400)
    }
    return apiSuccess(await FindingService.bulkDeleteFindings(parsed.data.ids, user.id))
  } catch (cause) {
    return apiError(cause)
  }
}
