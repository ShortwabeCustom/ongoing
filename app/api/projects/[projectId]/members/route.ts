import { NextRequest } from 'next/server'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { ProjectService } from '@/lib/services/project-service'
import { ProjectMemberCreateSchema } from '@/lib/validators/project'
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
    const members = await ProjectService.listMembers(projectId, user)
    return apiSuccess({ items: members, total: members.length })
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: ['OWNER', 'QA_LEAD'],
    })
    if (!valid) return error

    const { projectId } = await params
    const body = await request.json()
    const parsed = ProjectMemberCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid project member data',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const member = await ProjectService.addMember(projectId, parsed.data, user)
    return apiSuccess(member, 201)
  } catch (error) {
    return apiError(error)
  }
}
