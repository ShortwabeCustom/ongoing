import { NextRequest } from 'next/server'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { AnalyticsService } from '@/lib/services/analytics'
import { apiSuccess, apiError } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { valid, error } = await checkRBAC(request, {
    allowedRoles: RBAC_PERMISSIONS.VIEW_ANALYTICS,
  })
  if (!valid) return error

  try {
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10),
      100,
    )
    const summary = await AnalyticsService.getRecentActivitySummary(limit)
    return apiSuccess(summary)
  } catch (error) {
    return apiError(error)
  }
}
