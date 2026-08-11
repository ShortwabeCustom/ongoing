import { NextRequest } from 'next/server'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { FindingService } from '@/lib/services/finding-service'
import { ProjectService } from '@/lib/services/project-service'
import { FindingCreateSchema } from '@/lib/validators/finding'
import { FindingsQuerySchema } from '@/lib/validators/query'
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
    await ProjectService.assertProjectAccess(projectId, user)

    const queryParams = {
      ...Object.fromEntries(request.nextUrl.searchParams.entries()),
      projectId,
    }
    const parsed = FindingsQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid query parameters',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const result = await FindingService.listFindings(parsed.data)
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
      allowedRoles: RBAC_PERMISSIONS.CREATE_FINDING,
    })
    if (!valid) return error

    const { projectId } = await params
    await ProjectService.assertProjectAccess(projectId, user)

    const body = await request.json()
    const parsed = FindingCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid finding data',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const finding = await FindingService.createFinding(projectId, parsed.data, user.id)
    return apiSuccess(finding, 201)
  } catch (error) {
    return apiError(error)
  }
}
