import { NextRequest } from 'next/server'
import { FindingsQuerySchema } from '@/lib/validators/query'
import { FindingService } from '@/lib/services/finding-service'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { valid, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })
    if (!valid) return error

    const searchParams = request.nextUrl.searchParams

    // Convert URLSearchParams to object for validation
    const queryParams = Object.fromEntries(searchParams.entries())

    // Validate query parameters
    const validationResult = FindingsQuerySchema.safeParse(queryParams)
    if (!validationResult.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid query parameters',
        validationResult.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const filters = validationResult.data

    // Get findings with filters, sorting, and pagination
    const result = await FindingService.listFindings(filters)

    return apiSuccess(result)
  } catch (error) {
    return apiError(error)
  }
}
