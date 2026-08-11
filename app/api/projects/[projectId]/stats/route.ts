import { NextRequest } from 'next/server'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { FindingService } from '@/lib/services/finding-service'
import { ProjectService } from '@/lib/services/project-service'
import { apiError, apiSuccess } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

type Params = {
  projectId: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ANALYTICS,
    })
    if (!valid) return error

    const { projectId } = await params
    await ProjectService.assertProjectAccess(projectId, user)

    const stats = await FindingService.getStatistics(projectId)
    return apiSuccess(stats)
  } catch (error) {
    return apiError(error)
  }
}
