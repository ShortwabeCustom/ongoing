import { NextRequest } from 'next/server'
import { apiError, ApiError, apiSuccess } from '@/lib/utils/api-response'
import { StorageService } from '@/lib/services/storage-service'
import { uploadEvidenceSchema } from '@/lib/validators/evidence'
import { STORAGE_CONFIG } from '@/lib/storage/storage-config'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.CREATE_FINDING,
    })
    if (!valid) return error

    const { id: findingId } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const caption = (formData.get('caption') as string | null) || undefined

    if (!file) {
      throw new ApiError('MISSING_FILE', 'No file provided', undefined, 400)
    }

    const parsed = uploadEvidenceSchema.safeParse({ findingId, caption })
    if (!parsed.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid evidence data',
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    if (file.size > STORAGE_CONFIG.MAX_FILE_SIZE) {
      const maxSizeMB = STORAGE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)
      throw new ApiError(
        'FILE_TOO_LARGE',
        `File exceeds maximum size of ${maxSizeMB}MB`,
        undefined,
        413,
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await StorageService.uploadFile({
      buffer,
      mimeType: file.type,
      originalFilename: file.name,
      findingId: parsed.data.findingId,
      caption: parsed.data.caption,
      uploadedBy: user.id,
    })

    return apiSuccess(result, 201)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'FILE_TOO_LARGE') {
        const maxSizeMB = STORAGE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)
        return apiError(
          new ApiError(
            'FILE_TOO_LARGE',
            `File exceeds maximum size of ${maxSizeMB}MB`,
            undefined,
            413,
          ),
        )
      }

      if (error.message === 'INVALID_FILE_TYPE') {
        const allowedTypes = Object.keys(STORAGE_CONFIG.ALLOWED_TYPES).join(', ')
        return apiError(
          new ApiError(
            'INVALID_FILE_TYPE',
            `File type not supported. Supported: ${allowedTypes}`,
            undefined,
            415,
          ),
        )
      }

      if (error.message === 'UNVERIFIABLE_FILE_TYPE') {
        return apiError(
          new ApiError(
            'UNVERIFIABLE_FILE_TYPE',
            'File signature could not be verified',
            undefined,
            415,
          ),
        )
      }

      if (error.message === 'MIME_MISMATCH') {
        return apiError(
          new ApiError(
            'MIME_MISMATCH',
            'File content does not match the declared MIME type',
            undefined,
            415,
          ),
        )
      }

      if (error.message === 'INVALID_FILE_EXTENSION') {
        return apiError(
          new ApiError(
            'INVALID_FILE_EXTENSION',
            'File extension does not match the detected MIME type',
            undefined,
            415,
          ),
        )
      }

      if (error.message === 'NOT_FOUND') {
        return apiError(new ApiError('NOT_FOUND', 'Finding not found', undefined, 404))
      }
    }

    return apiError(error)
  }
}
