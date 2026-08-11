import { NextRequest } from 'next/server'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { ProjectService } from '@/lib/services/project-service'
import { ProjectUpdateSchema } from '@/lib/validators/project'
import { apiError, ApiError, apiSuccess } from '@/lib/utils/api-response'

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
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })
    if (!valid) return error

    const { projectId } = await params
    if (!projectId || projectId.length < 5) {
      throw new ApiError('INVALID_ID', 'Invalid project ID format', undefined, 400)
    }

    const project = await ProjectService.getProject(projectId, user)
    if (!project) throw new ApiError('NOT_FOUND', 'Project not found', undefined, 404)

    return apiSuccess(project)
  } catch (error) {
    return apiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: ['OWNER', 'QA_LEAD'],
    })
    if (!valid) return error

    const { projectId } = await params
    if (!projectId || projectId.length < 5) {
      throw new ApiError('INVALID_ID', 'Invalid project ID format', undefined, 400)
    }

    const body = await request.json()
    const parsed = ProjectUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid project data',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const project = await ProjectService.updateProject(projectId, parsed.data, user)
    return apiSuccess(project)
  } catch (error) {
    return apiError(error)
  }
}
