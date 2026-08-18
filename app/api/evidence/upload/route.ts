import { NextRequest } from 'next/server'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'
import { StorageService } from '@/lib/services/storage-service'
import { uploadEvidenceSchema } from '@/lib/validators/evidence'
import { STORAGE_CONFIG } from '@/lib/storage/storage-config'
import { StorageError } from '@/lib/storage/storage-errors'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export async function POST(request: NextRequest) {
  try {
    // FASE 7: RBAC validation (only editors can upload evidence)
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.CREATE_FINDING,
    })
    if (!valid) return error

    const formData = await request.formData()
    const file = formData.get('file') as File
    const findingId = formData.get('findingId') as string
    const caption = (formData.get('caption') as string) || undefined

    // Validate form data
    if (!file) {
      throw new ApiError('MISSING_FILE', 'No file provided', undefined, 400)
    }

    if (!findingId) {
      throw new ApiError(
        'MISSING_FINDING_ID',
        'Finding ID is required',
        undefined,
        400,
      )
    }

    // Validate input schema
    const parsed = uploadEvidenceSchema.safeParse({
      findingId,
      caption,
    })

    if (!parsed.success) {
      const fields: Record<string, string[]> = {}
      parsed.error.issues.forEach((issue) => {
        const path = issue.path.join('.')
        if (!fields[path]) fields[path] = []
        fields[path].push(issue.message)
      })
      throw new ApiError('VALIDATION_ERROR', 'Invalid input', fields, 400)
    }

    // Validate file size
    if (file.size > STORAGE_CONFIG.MAX_FILE_SIZE) {
      const maxSizeMB = STORAGE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)
      throw new ApiError(
        'FILE_TOO_LARGE',
        `File exceeds maximum size of ${maxSizeMB}MB`,
        undefined,
        413,
      )
    }

    // Read file to buffer
    const buffer = await file.arrayBuffer()

    // Upload to storage
    const result = await StorageService.uploadFile({
      buffer: Buffer.from(buffer),
      mimeType: file.type,
      originalFilename: file.name,
      findingId: parsed.data.findingId,
      caption: parsed.data.caption,
      uploadedBy: user.id,
    })

    return apiSuccess(result, 201)
  } catch (error) {
    // Cualquier fallo del almacén privado se colapsa en un 500 genérico: no se
    // filtran rutas, errno (EEXIST, EACCES…) ni detalles del filesystem. La
    // causa se conserva solo en el log del servidor.
    if (error instanceof StorageError) {
      console.error('[evidence/upload] storage failure:', error)
      return apiError(
        new ApiError(
          'STORAGE_UNAVAILABLE',
          'Evidence storage is unavailable',
          undefined,
          500,
        ),
      )
    }

    // Handle specific storage service errors
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
        return apiError(
          new ApiError('NOT_FOUND', 'Finding not found', undefined, 404),
        )
      }
    }

    return apiError(error)
  }
}
