import { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { ProjectService } from '@/lib/services/project-service'
import { ProjectCreateSchema } from '@/lib/validators/project'
import { apiError, ApiError, apiSuccess } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

const ProjectListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function GET(request: NextRequest) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })
    if (!valid) return error

    const parsed = ProjectListQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    )
    if (!parsed.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid query parameters',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const result = await ProjectService.listProjects(user, parsed.data.limit, parsed.data.offset)
    return apiSuccess(result)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: ['OWNER', 'QA_LEAD'],
    })
    if (!valid) return error

    const body = await request.json()
    const parsed = ProjectCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid project data',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const project = await ProjectService.createProject(parsed.data, user.id)
    return apiSuccess(project, 201)
  } catch (error) {
    return apiError(error)
  }
}
