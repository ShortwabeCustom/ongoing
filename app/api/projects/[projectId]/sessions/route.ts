import { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { TestSessionService } from '@/lib/services/test-session-service'
import { TestSessionCreateSchema } from '@/lib/validators/project'
import { apiError, ApiError, apiSuccess } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

type Params = {
  projectId: string
}

const SessionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

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
    const parsed = SessionListQuerySchema.safeParse(
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

    const result = await TestSessionService.listSessions(
      projectId,
      user,
      parsed.data.limit,
      parsed.data.offset,
    )
    return apiSuccess(result)
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
    const parsed = TestSessionCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid test session data',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const session = await TestSessionService.createSession(projectId, parsed.data, user)
    return apiSuccess(session, 201)
  } catch (error) {
    return apiError(error)
  }
}
