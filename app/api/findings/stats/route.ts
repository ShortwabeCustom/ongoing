import { NextRequest } from 'next/server'
import { FindingService } from '@/lib/services/finding-service'
import { apiSuccess, apiError } from '@/lib/utils/api-response'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { valid, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ANALYTICS,
    })
    if (!valid) return error

    const stats = await FindingService.getStatistics()
    return apiSuccess(stats)
  } catch (error) {
    return apiError(error)
  }
}
