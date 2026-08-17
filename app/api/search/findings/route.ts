import { NextRequest } from 'next/server'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { SearchQuerySchema } from '@/lib/validators/search-query'
import { SearchService } from '@/lib/services/search-service'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // C-03: la búsqueda exige sesión. Mismo conjunto de roles que el resto de lecturas de
  // hallazgos (`GET /api/findings`, `GET /api/findings/[id]`): VIEW_ALL_FINDINGS.
  const { valid, error } = await checkRBAC(request, {
    allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
  })
  if (!valid) return error

  try {
    const queryParams = Object.fromEntries(request.nextUrl.searchParams.entries())

    const validationResult = SearchQuerySchema.safeParse(queryParams)
    if (!validationResult.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid search parameters',
        validationResult.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const filters = validationResult.data

    const result = await SearchService.search(filters)

    return apiSuccess(result)
  } catch (error) {
    return apiError(error)
  }
}
