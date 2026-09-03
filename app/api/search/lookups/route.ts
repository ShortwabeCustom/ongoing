import { NextRequest } from 'next/server'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { LookupService } from '@/lib/services/lookup-service'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })
    if (!valid) return error

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') // 'assignees' | 'projects'
    const projectId = searchParams.get('projectId')

    if (type === 'assignees') {
      const assignees = await LookupService.getAssignees(projectId || undefined)
      return apiSuccess({ assignees })
    }

    if (type === 'projects') {
      // Siempre se deriva del usuario autenticado de la sesión, nunca de un
      // `userId` que mande el cliente (antes era opcional e inseguro).
      const projects = await LookupService.getProjects(user)
      return apiSuccess({ projects })
    }

    return apiError(
      new ApiError(
        'VALIDATION_ERROR',
        'Missing or invalid type parameter (assignees|projects)',
        undefined,
        400,
      ),
    )
  } catch (error) {
    return apiError(error)
  }
}
