import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/utils/api-response'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { valid, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })
    if (!valid) return error

    return apiSuccess({
      findingStatuses: [
        'OPEN',
        'TRIAGED',
        'IN_PROGRESS',
        'READY_FOR_VALIDATION',
        'VALIDATED',
        'CLOSED',
        'BLOCKED',
        'REOPENED',
      ],
      incidenceTypes: ['DESIGN', 'FUNCTIONALITY', 'BUSINESS_RULE', 'COPY'],
      experienceTags: ['UI', 'UX', 'COPY'],
      priorities: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      severities: ['COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER'],
      efforts: ['S', 'M', 'L', 'XL'],
    })
  } catch (error) {
    return apiError(error)
  }
}
