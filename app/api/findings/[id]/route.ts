import { NextRequest } from 'next/server'
import { FindingUpdateSchema } from '@/lib/validators/finding'
import { FindingService } from '@/lib/services/finding-service'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params

    // Validate ID is a valid CUID
    if (!id || typeof id !== 'string' || id.length < 5) {
      throw new ApiError('INVALID_ID', 'Invalid finding ID format', undefined, 400)
    }

    const finding = await FindingService.getFindingWithSignedUrls(id)

    if (!finding) {
      throw new ApiError('NOT_FOUND', 'Finding not found', undefined, 404)
    }

    if (finding.deletedAt) {
      throw new ApiError('RESOURCE_DELETED', 'This finding has been deleted', undefined, 410)
    }

    return apiSuccess(finding)
  } catch (error) {
    return apiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params
    const body = await request.json()

    // Validate ID
    if (!id || typeof id !== 'string' || id.length < 5) {
      throw new ApiError('INVALID_ID', 'Invalid finding ID format', undefined, 400)
    }

    // Validate update payload
    const validationResult = FindingUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid update data',
        validationResult.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const updates = validationResult.data

    // Extract version for optimistic locking
    if (typeof updates.version !== 'number' || updates.version < 1) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Version is required for optimistic locking',
        { version: ['Must be a positive integer'] },
        400,
      )
    }

    const currentVersion = updates.version
    const { version, ...updateData } = updates

    // Update finding with optimistic locking
    const updated = await FindingService.updateFinding(
      id,
      updateData,
      currentVersion,
      'system', // TODO: use actual user from auth in FASE 7
    )

    return apiSuccess(updated)
  } catch (error) {
    return apiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params

    // Validate ID
    if (!id || typeof id !== 'string' || id.length < 5) {
      throw new ApiError('INVALID_ID', 'Invalid finding ID format', undefined, 400)
    }

    // Soft delete finding
    await FindingService.deleteFinding(id, 'system')

    // Return 204 No Content
    return new Response(null, { status: 204 })
  } catch (error) {
    return apiError(error)
  }
}
