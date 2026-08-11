import { nanoid } from 'nanoid'
import { type EvidenceType } from '@/lib/generated/prisma/client'
import { getDb } from '@/lib/db-lazy'
import { S3StorageClient } from '@/lib/storage/s3-client'
import { STORAGE_CONFIG } from '@/lib/storage/storage-config'

export interface UploadFileInput {
  buffer: Buffer
  mimeType: string
  originalFilename: string
  findingId: string
  caption?: string
  uploadedBy: string
}

export interface UploadFileResult {
  id: string
  findingId: string
  originalFilename: string
  mimeType: string
  fileSize: number
  storageKey: string
  url: string
  urlExpiresAt: Date
  caption?: string
  uploadedAt: Date
  uploadedBy: string
}

type ValidatedFile = {
  mimeType: string
  evidenceType: EvidenceType
  safeFilename: string
}

function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }

  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return 'application/pdf'
  }

  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase()
    return brand.includes('qt') ? 'video/quicktime' : 'video/mp4'
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'video/webm'
  }

  return null
}

function inferEvidenceType(mimeType: string): EvidenceType {
  if (mimeType.startsWith('image/')) return 'IMAGE'
  if (mimeType.startsWith('video/')) return 'VIDEO'
  return 'DOCUMENT'
}

function validateFile(buffer: Buffer, browserMimeType: string, filename: string): ValidatedFile {
  if (buffer.length > STORAGE_CONFIG.MAX_FILE_SIZE) {
    throw new Error('FILE_TOO_LARGE')
  }

  const detectedMimeType = detectMimeType(buffer)
  const mimeType = detectedMimeType ?? browserMimeType

  if (!detectedMimeType) {
    throw new Error('UNVERIFIABLE_FILE_TYPE')
  }

  if (!STORAGE_CONFIG.isAllowedType(mimeType)) {
    throw new Error('INVALID_FILE_TYPE')
  }

  if (browserMimeType && browserMimeType !== mimeType) {
    throw new Error('MIME_MISMATCH')
  }

  const extension = STORAGE_CONFIG.getExtension(filename)
  const allowedExtensions = STORAGE_CONFIG.getAllowedExtensionsForType(mimeType)
  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error('INVALID_FILE_EXTENSION')
  }

  return {
    mimeType,
    evidenceType: inferEvidenceType(mimeType),
    safeFilename: STORAGE_CONFIG.sanitizeFilename(filename),
  }
}

function getUrlExpiryDate() {
  return new Date(Date.now() + STORAGE_CONFIG.SIGNED_URL_EXPIRY * 1000)
}

function isLegacyStorageKey(storageKey: string) {
  return storageKey.startsWith('legacy/')
}

export class StorageService {
  /**
   * Upload a file to S3-compatible storage and create Evidence metadata.
   */
  static async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const { buffer, originalFilename, findingId, caption, uploadedBy } = input
    const validated = validateFile(buffer, input.mimeType, originalFilename)

    const db = getDb()
    const finding = await db.finding.findFirst({
      where: { id: findingId, deletedAt: null },
      select: { id: true },
    })

    if (!finding) {
      throw new Error('NOT_FOUND')
    }

    const evidenceId = nanoid()
    const storageKey = STORAGE_CONFIG.getStorageKey(
      findingId,
      evidenceId,
      validated.safeFilename,
    )

    try {
      await S3StorageClient.uploadFile(
        STORAGE_CONFIG.BUCKET,
        storageKey,
        buffer,
        validated.mimeType,
      )

      const url = await S3StorageClient.generateSignedUrl(
        STORAGE_CONFIG.BUCKET,
        storageKey,
        STORAGE_CONFIG.SIGNED_URL_EXPIRY,
      )
      const urlExpiresAt = getUrlExpiryDate()

      const evidence = await db.$transaction(async (tx) => {
        const created = await tx.evidence.create({
          data: {
            id: evidenceId,
            findingId,
            type: validated.evidenceType,
            storageKey,
            url: null,
            originalFilename: validated.safeFilename,
            mimeType: validated.mimeType,
            fileSize: buffer.length,
            caption: caption || null,
            createdBy: uploadedBy,
          },
        })

        await tx.auditLog.create({
          data: {
            entityType: 'Evidence',
            entityId: created.id,
            action: 'CREATE',
            actorId: uploadedBy,
            after: {
              findingId,
              storageKey,
              originalFilename: created.originalFilename,
              mimeType: created.mimeType,
              fileSize: created.fileSize,
            },
          },
        })

        return created
      })

      return {
        id: evidence.id,
        findingId: evidence.findingId,
        originalFilename: evidence.originalFilename,
        mimeType: evidence.mimeType,
        fileSize: evidence.fileSize || 0,
        storageKey: evidence.storageKey,
        url,
        urlExpiresAt,
        caption: evidence.caption || undefined,
        uploadedAt: evidence.createdAt,
        uploadedBy: evidence.createdBy,
      }
    } catch (error) {
      try {
        await S3StorageClient.deleteFile(STORAGE_CONFIG.BUCKET, storageKey)
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded object after metadata error:', cleanupError)
      }
      throw error
    }
  }

  /**
   * Soft-delete evidence metadata. The object is retained for audit/rollback.
   */
  static async deleteEvidence(evidenceId: string, deletedBy?: string): Promise<void> {
    const db = getDb()
    const deletedAt = new Date()

    await db.$transaction(async (tx) => {
      const evidence = await tx.evidence.findUnique({
        where: { id: evidenceId },
      })

      if (!evidence) throw new Error('NOT_FOUND')
      if (evidence.deletedAt) throw new Error('ALREADY_DELETED')

      await tx.evidence.update({
        where: { id: evidenceId },
        data: {
          deletedAt,
          deletedBy: deletedBy ?? null,
          url: null,
        },
      })

      await tx.auditLog.create({
        data: {
          entityType: 'Evidence',
          entityId: evidenceId,
          action: 'DELETE',
          actorId: deletedBy ?? null,
          before: {
            findingId: evidence.findingId,
            storageKey: evidence.storageKey,
            deletedAt: evidence.deletedAt,
          },
          after: {
            deletedAt,
            retainedObject: true,
          },
        },
      })
    })
  }

  static async objectExists(storageKey: string): Promise<boolean> {
    if (isLegacyStorageKey(storageKey)) return true
    return S3StorageClient.exists(STORAGE_CONFIG.BUCKET, storageKey)
  }

  /**
   * Generate a fresh signed URL for existing evidence.
   */
  static async refreshSignedUrl(evidenceId: string): Promise<{
    id: string
    url: string
    urlExpiresAt: Date
  }> {
    const db = getDb()

    const evidence = await db.evidence.findFirst({
      where: { id: evidenceId, deletedAt: null },
    })

    if (!evidence) {
      throw new Error('NOT_FOUND')
    }

    if (isLegacyStorageKey(evidence.storageKey)) {
      if (!evidence.url) throw new Error('UNSIGNED_LEGACY_EVIDENCE')
      return {
        id: evidenceId,
        url: evidence.url,
        urlExpiresAt: getUrlExpiryDate(),
      }
    }

    const url = await S3StorageClient.generateSignedUrl(
      STORAGE_CONFIG.BUCKET,
      evidence.storageKey,
      STORAGE_CONFIG.SIGNED_URL_EXPIRY,
    )

    return {
      id: evidenceId,
      url,
      urlExpiresAt: getUrlExpiryDate(),
    }
  }

  /**
   * Update evidence metadata.
   */
  static async updateEvidence(
    evidenceId: string,
    data: { caption?: string },
  ): Promise<{
    id: string
    caption?: string
    updatedAt: Date
  }> {
    const db = getDb()

    const evidence = await db.evidence.findFirst({
      where: { id: evidenceId, deletedAt: null },
    })

    if (!evidence) {
      throw new Error('NOT_FOUND')
    }

    const updated = await db.evidence.update({
      where: { id: evidenceId },
      data: {
        caption: data.caption !== undefined ? data.caption : evidence.caption,
      },
    })

    return {
      id: updated.id,
      caption: updated.caption || undefined,
      updatedAt: updated.updatedAt,
    }
  }

  /**
   * Get evidence metadata with a fresh signed URL.
   */
  static async getEvidenceWithUrl(evidenceId: string): Promise<{
    id: string
    findingId: string
    originalFilename: string
    mimeType: string
    fileSize: number
    url: string
    urlExpiresAt: Date
    caption?: string
    uploadedAt: Date
  }> {
    const db = getDb()

    const evidence = await db.evidence.findFirst({
      where: { id: evidenceId, deletedAt: null },
    })

    if (!evidence) {
      throw new Error('NOT_FOUND')
    }

    let url = evidence.url || ''
    if (!isLegacyStorageKey(evidence.storageKey)) {
      url = await S3StorageClient.generateSignedUrl(
        STORAGE_CONFIG.BUCKET,
        evidence.storageKey,
        STORAGE_CONFIG.SIGNED_URL_EXPIRY,
      )
    }

    return {
      id: evidence.id,
      findingId: evidence.findingId,
      originalFilename: evidence.originalFilename,
      mimeType: evidence.mimeType,
      fileSize: evidence.fileSize || 0,
      url,
      urlExpiresAt: getUrlExpiryDate(),
      caption: evidence.caption || undefined,
      uploadedAt: evidence.createdAt,
    }
  }
}
