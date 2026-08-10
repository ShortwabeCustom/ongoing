import { NextRequest } from 'next/server'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { AnalyticsService } from '@/lib/services/analytics'
import { AnalyticsQuerySchema } from '@/lib/validators/analytics-query'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { valid, error } = await checkRBAC(request, {
    allowedRoles: RBAC_PERMISSIONS.VIEW_ANALYTICS,
  })
  if (!valid) return error

  try {
    const queryParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = AnalyticsQuerySchema.safeParse(queryParams)

    if (!parsed.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Parámetros de consulta inválidos',
        Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [
            k,
            v ?? [],
          ]),
        ),
      )
    }

    const filters = parsed.data

    const [kpis, statusBreakdown, priorityBreakdown, severityBreakdown, timeSeries, resolutionFunnel, validationRate] = await Promise.all([
      AnalyticsService.getKPIs(filters),
      AnalyticsService.getStatusBreakdown(filters),
      AnalyticsService.getPriorityBreakdown(filters),
      AnalyticsService.getSeverityBreakdown(filters),
      AnalyticsService.getTimeSeries(filters, filters.granularity),
      AnalyticsService.getResolutionFunnel(filters),
      AnalyticsService.getValidationRate(filters),
    ])

    return apiSuccess({
      kpis,
      statusBreakdown,
      priorityBreakdown,
      severityBreakdown,
      timeSeries,
      resolutionFunnel,
      validationRate,
    })
  } catch (error) {
    return apiError(error)
  }
}
