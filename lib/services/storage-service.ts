import { nanoid } from 'nanoid'
import { type EvidenceType } from '@/lib/generated/prisma/client'
import { getDb } from '@/lib/db-lazy'
import { PrivateFileStore } from '@/lib/storage/private-file-store'
import { getEvidenceStorageRoot } from '@/lib/storage/storage-root'
import { isLegacyStorageKey } from '@/lib/storage/storage-key'
import { STORAGE_CONFIG } from '@/lib/storage/storage-config'

export interface UploadFileInput {
  buffer: Buffer
  mimeType: string
  originalFilename: string
  findingId: string
  caption?: string
  uploadedBy: string
}

/**
 * Resultado del upload.
 *
 * `storageKey` NO forma parte del contrato (ADR-001 D5.5): la ruta interna del
 * almacén nunca se expone al cliente.
 */
export interface UploadFileResult {
  id: string
  findingId: string
  originalFilename: string
  mimeType: string
  fileSize: number
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

/**
 * COMPATIBILIDAD. Para la evidencia de runtime este valor **no controla nada**:
 * la autorización se evalúa en cada petición a `/api/evidence/{id}/file` y la
 * URL persistida no expira (ADR-001 D2, D4 — no hay signed URLs en P1-B). Se
 * mantiene únicamente para no romper la forma del JSON que ya consume el
 * frontend. Para legacy conserva su significado histórico.
 */
function getUrlExpiryDate() {
  return new Date(Date.now() + STORAGE_CONFIG.SIGNED_URL_EXPIRY * 1000)
}

/** URL de entrega autenticada de una evidencia de runtime (ADR-001 D5.1). */
function runtimeEvidenceUrl(evidenceId: string): string {
  return `/api/evidence/${evidenceId}/file`
}

export class StorageService {
  /**
   * Sube una evidencia de runtime siguiendo la máquina de estados de
   * ADR-001 D5.2. El orden es NORMATIVO y está congelado:
   *
   *   FASE 0  validar fichero, finding y configuración de storage
   *           => cero escrituras en BD si algo falla aquí
   *   FASE 1  transacción: Evidence.create(url = null) SIN AuditLog  => PENDING
   *   FASE 2  PrivateFileStore.put(storageKey, buffer)
   *   FASE 3  transacción: Evidence.update(url) + AuditLog CREATE    => CONFIRMED
   *
   * Esto invierte el orden defectuoso de C-02 (fila y URL primero, bytes
   * después): la URL solo se promete cuando los bytes ya están en disco.
   *
   * PROPIEDAD DE LOS FALLOS (D5.3): a partir de la FASE 1 NO se revierte nada
   * de forma síncrona. Si falla la FASE 2 o la FASE 3, la fila queda PENDING
   * (`url = null`), no se emite `AuditLog`, no se borra el objeto ya publicado
   * y no se elimina la fila. La conciliación de D5.4 es la única autoridad de
   * limpieza posterior. No hay reintentos automáticos.
   */
  static async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const { buffer, originalFilename, findingId, caption, uploadedBy } = input

    // ---- FASE 0 -----------------------------------------------------------
    const validated = validateFile(buffer, input.mimeType, originalFilename)

    const db = getDb()
    const finding = await db.finding.findFirst({
      where: { id: findingId, deletedAt: null },
      select: { id: true },
    })

    if (!finding) {
      throw new Error('NOT_FOUND')
    }

    // Configuración del almacén ANTES de tocar la BD (D14.3): con un storage
    // inválido el upload falla sin dejar ninguna fila huérfana.
    getEvidenceStorageRoot()

    const evidenceId = nanoid()
    const storageKey = STORAGE_CONFIG.getStorageKey(
      findingId,
      evidenceId,
      validated.safeFilename,
    )

    // ---- FASE 1: fila PENDING, sin AuditLog -------------------------------
    const created = await db.$transaction(async (tx) =>
      tx.evidence.create({
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
      }),
    )

    // ---- FASE 2: publicar los bytes ---------------------------------------
    // Un fallo aquí deja la fila PENDING a propósito: la conciliación (D5.4)
    // la recogerá. El almacén ya limpia su propio temporal.
    await PrivateFileStore.put(storageKey, buffer)

    // ---- FASE 3: confirmar --------------------------------------------------
    // Solo aquí la evidencia queda entregable y se emite el AuditLog CREATE.
    // Si esta transacción falla, el objeto publicado NO se borra y la fila
    // permanece PENDING (D5.3).
    const url = runtimeEvidenceUrl(evidenceId)
    const confirmed = await db.$transaction(async (tx) => {
      const updated = await tx.evidence.update({
        where: { id: evidenceId },
        data: { url },
      })

      // El update obtiene/espera el row lock antes de comprobar los bytes. Así,
      // un rollback concurrente de D5.4 no puede dejar CONFIRMED una fila cuyo
      // objeto final ya fue eliminado.
      await PrivateFileStore.stat(storageKey)

      await tx.auditLog.create({
        data: {
          entityType: 'Evidence',
          entityId: evidenceId,
          action: 'CREATE',
          actorId: uploadedBy,
          after: {
            findingId,
            storageKey,
            originalFilename: updated.originalFilename,
            mimeType: updated.mimeType,
            fileSize: updated.fileSize,
            url,
          },
        },
      })

      return updated
    })

    return {
      id: confirmed.id,
      findingId: confirmed.findingId,
      originalFilename: confirmed.originalFilename,
      mimeType: confirmed.mimeType,
      fileSize: confirmed.fileSize || 0,
      url,
      urlExpiresAt: getUrlExpiryDate(),
      caption: confirmed.caption || undefined,
      uploadedAt: created.createdAt,
      uploadedBy: confirmed.createdBy,
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

  /**
   * ¿Existen los bytes de la evidencia?
   *
   * Legacy conserva su semántica actual: se da por existente sin consultar el
   * almacén privado, al que no pertenece (D9).
   */
  static async objectExists(storageKey: string): Promise<boolean> {
    if (isLegacyStorageKey(storageKey)) return true
    return PrivateFileStore.exists(storageKey)
  }

  /**
   * COMPATIBILIDAD: conserva el nombre histórico, pero ya NO firma nada.
   *
   * No toca el filesystem y no genera signed URLs (ADR-001 D2, D4): se limita a
   * devolver la URL ya persistida en `Evidence.url`, que para runtime es el
   * readiness marker de D5.1. Se mantiene el endpoint por compatibilidad del
   * frontend existente; su retirada es posterior a P1-B.
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

    // Runtime: `url === null` significa upload PENDING (D5.1), no un fallo de
    // firma. No se puede entregar todavía.
    if (!evidence.url) {
      throw new Error('UPLOAD_INCOMPLETE')
    }

    return {
      id: evidenceId,
      url: evidence.url,
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

    // Legacy conserva su URL persistida tal cual. Runtime devuelve el readiness
    // marker de D5.1; si todavía es `null`, el upload está PENDING y la
    // evidencia no es entregable. En ningún caso se genera una signed URL.
    let url: string
    if (isLegacyStorageKey(evidence.storageKey)) {
      url = evidence.url || ''
    } else {
      if (!evidence.url) throw new Error('UPLOAD_INCOMPLETE')
      url = evidence.url
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
