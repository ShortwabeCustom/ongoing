import { getDb } from '@/lib/db-lazy'
import { PrivateFileStore } from '@/lib/storage/private-file-store'
import { getEvidenceStorageRoot } from '@/lib/storage/storage-root'
import { LEGACY_STORAGE_KEY_PREFIX, isLegacyStorageKey } from '@/lib/storage/storage-key'
import { EVIDENCE_RETENTION_MS } from '@/lib/services/storage-service'

type RestoreDb = ReturnType<typeof getDb>

export type RestoreResult = {
  status: 'eligible' | 'restored' | 'already-active'
  evidenceId: string
  outsideRetentionWindow: boolean
}

export type RestoreDependencies = {
  db: RestoreDb
  validateStorage: () => unknown
  statObject: (storageKey: string) => Promise<{ size: number }>
}

function runtimeUrl(evidenceId: string): string {
  return `/api/evidence/${evidenceId}/file`
}

export async function restoreEvidence(
  evidenceId: string,
  options: { execute?: boolean; actorId?: string; now?: Date } = {},
  dependencies?: RestoreDependencies,
): Promise<RestoreResult> {
  if (!evidenceId.trim()) throw new Error('EVIDENCE_ID_REQUIRED')
  const deps = dependencies ?? {
    db: getDb(),
    validateStorage: getEvidenceStorageRoot,
    statObject: (key: string) => PrivateFileStore.stat(key),
  }
  const now = options.now ?? new Date()

  const evidence = await deps.db.evidence.findUnique({
    where: { id: evidenceId },
    select: { id: true, findingId: true, storageKey: true, deletedAt: true, finding: { select: { deletedAt: true } } },
  })
  if (!evidence) throw new Error('NOT_FOUND')
  if (evidence.deletedAt === null) {
    return { status: 'already-active', evidenceId, outsideRetentionWindow: false }
  }
  if (evidence.finding.deletedAt !== null) throw new Error('FINDING_INACTIVE')
  if (isLegacyStorageKey(evidence.storageKey)) throw new Error('LEGACY_NOT_RESTORABLE')

  deps.validateStorage()
  try {
    await deps.statObject(evidence.storageKey)
  } catch (error) {
    if (error && typeof error === 'object' && 'errno' in error && error.errno === 'ENOENT') {
      throw new Error('OBJECT_ALREADY_PURGED')
    }
    throw error
  }

  const outsideRetentionWindow = evidence.deletedAt.getTime() <= now.getTime() - EVIDENCE_RETENTION_MS
  if (!options.execute) return { status: 'eligible', evidenceId, outsideRetentionWindow }

  await deps.db.$transaction(async (tx) => {
    const restored = await tx.evidence.updateMany({
      where: {
        id: evidenceId,
        deletedAt: evidence.deletedAt,
        finding: { deletedAt: null },
        NOT: { storageKey: { startsWith: LEGACY_STORAGE_KEY_PREFIX } },
      },
      data: { deletedAt: null, deletedBy: null, url: runtimeUrl(evidenceId) },
    })
    if (restored.count === 0) throw new Error('STATE_CHANGED')

    // Después de obtener el row lock: un purge concurrente no puede dejar la
    // fila activa si los bytes desaparecieron.
    try {
      await deps.statObject(evidence.storageKey)
    } catch (error) {
      if (error && typeof error === 'object' && 'errno' in error && error.errno === 'ENOENT') {
        throw new Error('OBJECT_ALREADY_PURGED')
      }
      throw error
    }

    await tx.auditLog.create({
      data: {
        entityType: 'Evidence', entityId: evidenceId, action: 'UPDATE',
        actorId: options.actorId ?? null,
        before: { deletedAt: evidence.deletedAt, findingId: evidence.findingId },
        after: { phase: 'RESTORE', outsideRetentionWindow, url: runtimeUrl(evidenceId) },
      },
    })
  })

  return { status: 'restored', evidenceId, outsideRetentionWindow }
}
