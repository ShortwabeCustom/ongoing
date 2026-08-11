import { NextRequest } from 'next/server'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'
import { StorageService } from '@/lib/services/storage-service'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { valid, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })
    if (!valid) return error

    const { id: evidenceId } = await params

    // Generate fresh signed URL
    const result = await StorageService.refreshSignedUrl(evidenceId)

    return apiSuccess(result)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return apiError(
          new ApiError(
            'NOT_FOUND',
            'Evidence not found',
            undefined,
            404,
          ),
        )
      }

      if (error.message === 'UNSIGNED_LEGACY_EVIDENCE') {
        return apiError(
          new ApiError(
            'UNSIGNED_LEGACY_EVIDENCE',
            'Legacy evidence cannot be signed because it has no public URL',
            undefined,
            422,
          ),
        )
      }
    }

    return apiError(error)
  }
}
