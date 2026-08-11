import { NextRequest } from 'next/server'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'
import { StorageService } from '@/lib/services/storage-service'
import { updateEvidenceSchema } from '@/lib/validators/evidence'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { valid, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.CREATE_FINDING,
    })
    if (!valid) return error

    const { id: evidenceId } = await params
    const body = await request.json()

    // Validate input
    const parsed = updateEvidenceSchema.safeParse(body)

    if (!parsed.success) {
      const fields: Record<string, string[]> = {}
      parsed.error.issues.forEach((issue) => {
        const path = issue.path.join('.')
        if (!fields[path]) fields[path] = []
        fields[path].push(issue.message)
      })
      throw new ApiError('VALIDATION_ERROR', 'Invalid input', fields, 400)
    }

    // Update evidence
    const result = await StorageService.updateEvidence(
      evidenceId,
      parsed.data,
    )

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
    }

    return apiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.CREATE_FINDING,
    })
    if (!valid) return error

    const { id: evidenceId } = await params

    // Delete evidence
    await StorageService.deleteEvidence(evidenceId, user.id)

    // Return 204 No Content
    return new Response(null, { status: 204 })
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

      if (error.message === 'ALREADY_DELETED') {
        return apiError(
          new ApiError(
            'ALREADY_DELETED',
            'Evidence is already deleted',
            undefined,
            410,
          ),
        )
      }
    }

    return apiError(error)
  }
}
