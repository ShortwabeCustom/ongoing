import { NextRequest } from 'next/server'
import { checkRBAC } from '@/lib/middleware/rbac'
import { ProjectService } from '@/lib/services/project-service'
import { ProjectMemberUpdateSchema } from '@/lib/validators/project'
import { apiError, ApiError, apiSuccess } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

type Params = {
  projectId: string
  memberId: string
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

    const { projectId, memberId } = await params
    const body = await request.json()
    const parsed = ProjectMemberUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid project member data',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const member = await ProjectService.updateMember(projectId, memberId, parsed.data, user)
    return apiSuccess(member)
  } catch (error) {
    return apiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: ['OWNER', 'QA_LEAD'],
    })
    if (!valid) return error

    const { projectId, memberId } = await params
    await ProjectService.removeMember(projectId, memberId, user)

    return new Response(null, { status: 204 })
  } catch (error) {
    return apiError(error)
  }
}
