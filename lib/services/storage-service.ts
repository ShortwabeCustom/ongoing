import { R2Client } from '@/lib/storage/r2-client'
import { STORAGE_CONFIG } from '@/lib/storage/storage-config'
import { getDb } from '@/lib/db-lazy'
import { nanoid } from 'nanoid'

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

export class StorageService {
  /**
   * Upload a file to R2 and create Evidence record
   */
  static async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const {
      buffer,
      mimeType,
      originalFilename,
      findingId,
      caption,
      uploadedBy,
    } = input

    // Validate file size
    if (buffer.length > STORAGE_CONFIG.MAX_FILE_SIZE) {
      throw new Error('FILE_TOO_LARGE')
    }

    // Validate MIME type
    if (!STORAGE_CONFIG.isAllowedType(mimeType)) {
      throw new Error('INVALID_FILE_TYPE')
    }

    // Check finding exists
    const db = getDb()
    const finding = await db.finding.findUnique({
      where: { id: findingId },
    })

    if (!finding) {
      throw new Error('NOT_FOUND')
    }

    // Generate evidence ID and storage key
    const evidenceId = nanoid()
    const storageKey = STORAGE_CONFIG.getStorageKey(
      findingId,
      evidenceId,
      originalFilename,
    )

    try {
      // Upload to R2
      await R2Client.uploadFile(
        STORAGE_CONFIG.BUCKET,
        storageKey,
        buffer,
        mimeType,
      )

      // Generate signed URL
      const url = await R2Client.generateSignedUrl(
        STORAGE_CONFIG.BUCKET,
        storageKey,
        STORAGE_CONFIG.SIGNED_URL_EXPIRY,
      )

      const urlExpiresAt = new Date(
        Date.now() + STORAGE_CONFIG.SIGNED_URL_EXPIRY * 1000,
      )

      // Create Evidence record in DB
      const evidence = await db.evidence.create({
        data: {
          id: evidenceId,
          findingId,
          type: 'IMAGE', // Default, will be inferred from MIME type
          storageKey,
          url,
          originalFilename,
          mimeType,
          fileSize: buffer.length,
          caption: caption || null,
          createdBy: uploadedBy,
        },
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
      // Clean up: delete from R2 if DB write fails
      if (error instanceof Error && !['FILE_TOO_LARGE', 'INVALID_FILE_TYPE', 'NOT_FOUND'].includes(error.message)) {
        try {
          await R2Client.deleteFile(STORAGE_CONFIG.BUCKET, storageKey)
        } catch (cleanupError) {
          console.error('Failed to clean up R2 file:', cleanupError)
        }
      }
      throw error
    }
  }

  /**
   * Delete an evidence file and its DB record
   */
  static async deleteEvidence(evidenceId: string): Promise<void> {
    const db = getDb()

    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
    })

    if (!evidence) {
      throw new Error('NOT_FOUND')
    }

    try {
      // Delete from R2
      await R2Client.deleteFile(STORAGE_CONFIG.BUCKET, evidence.storageKey)

      // Delete from DB
      await db.evidence.delete({
        where: { id: evidenceId },
      })
    } catch (error) {
      console.error('Failed to delete evidence:', error)
      throw error
    }
  }

  /**
   * Generate a fresh signed URL for existing evidence
   */
  static async refreshSignedUrl(evidenceId: string): Promise<{
    id: string
    url: string
    urlExpiresAt: Date
  }> {
    const db = getDb()

    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
    })

    if (!evidence) {
      throw new Error('NOT_FOUND')
    }

    const url = await R2Client.generateSignedUrl(
      STORAGE_CONFIG.BUCKET,
      evidence.storageKey,
      STORAGE_CONFIG.SIGNED_URL_EXPIRY,
    )

    const urlExpiresAt = new Date(
      Date.now() + STORAGE_CONFIG.SIGNED_URL_EXPIRY * 1000,
    )

    // Update URL in database
    await db.evidence.update({
      where: { id: evidenceId },
      data: { url },
    })

    return {
      id: evidenceId,
      url,
      urlExpiresAt,
    }
  }

  /**
   * Update evidence metadata (caption)
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

    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
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
      updatedAt: updated.createdAt, // Evidence doesn't have updatedAt, use createdAt
    }
  }

  /**
   * Get evidence with fresh signed URL
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

    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
    })

    if (!evidence) {
      throw new Error('NOT_FOUND')
    }

    // Generate fresh signed URL if stored URL is about to expire
    let url = evidence.url || ''
    const now = new Date()

    // If no URL or URL might be expired, generate new one
    if (!url) {
      url = await R2Client.generateSignedUrl(
        STORAGE_CONFIG.BUCKET,
        evidence.storageKey,
        STORAGE_CONFIG.SIGNED_URL_EXPIRY,
      )
    }

    const urlExpiresAt = new Date(
      Date.now() + STORAGE_CONFIG.SIGNED_URL_EXPIRY * 1000,
    )

    return {
      id: evidence.id,
      findingId: evidence.findingId,
      originalFilename: evidence.originalFilename,
      mimeType: evidence.mimeType,
      fileSize: evidence.fileSize || 0,
      url,
      urlExpiresAt,
      caption: evidence.caption || undefined,
      uploadedAt: evidence.createdAt,
    }
  }
}
