import { NextRequest } from 'next/server'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { FindingService } from '@/lib/services/finding-service'
import { apiError, apiSuccess } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })
    if (!valid) return error

    const { id, commentId } = await params
    const result = await FindingService.deleteComment(id, commentId, user.id, user.role)
    return apiSuccess(result)
  } catch (error) {
    return apiError(error)
  }
}
