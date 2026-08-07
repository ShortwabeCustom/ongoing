import { NextRequest } from 'next/server'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'
import { StorageService } from '@/lib/services/storage-service'
import { updateEvidenceSchema } from '@/lib/validators/evidence'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const evidenceId = params.id
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
  { params }: { params: { id: string } },
) {
  try {
    const evidenceId = params.id

    // Delete evidence
    await StorageService.deleteEvidence(evidenceId)

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
    }

    return apiError(error)
  }
}
