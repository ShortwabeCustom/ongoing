import { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { FindingService } from '@/lib/services/finding-service'
import { apiError, ApiError, apiSuccess } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

const CommentCreateSchema = z.object({
  text: z.string().trim().min(1).max(2000),
})

const CommentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { valid, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })
    if (!valid) return error

    const { id } = await params
    const parsed = CommentListQuerySchema.safeParse(
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

    const result = await FindingService.getComments(id, parsed.data.limit, parsed.data.offset)
    return apiSuccess(result)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.CREATE_RESOLUTION,
    })
    if (!valid) return error

    const { id } = await params
    const body = await request.json()
    const parsed = CommentCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid comment data',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const comment = await FindingService.addComment(id, parsed.data.text, user.id)
    return apiSuccess(comment, 201)
  } catch (error) {
    return apiError(error)
  }
}
