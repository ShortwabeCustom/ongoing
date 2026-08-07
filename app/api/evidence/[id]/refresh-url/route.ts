import { NextRequest } from 'next/server'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'
import { StorageService } from '@/lib/services/storage-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const evidenceId = params.id

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
    }

    return apiError(error)
  }
}
