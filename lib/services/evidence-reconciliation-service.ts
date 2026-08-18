import { getDb } from '@/lib/db-lazy'
import { PrivateFileStore } from '@/lib/storage/private-file-store'
import { getEvidenceStorageRoot } from '@/lib/storage/storage-root'
import {
  LEGACY_STORAGE_KEY_PREFIX,
  isLegacyStorageKey,
} from '@/lib/storage/storage-key'

const DEFAULT_BATCH_SIZE = 100

type ReconciliationDb = ReturnType<typeof getDb>

type Candidate = {
  id: string
  findingId: string
  storageKey: string
  createdAt: Date
}

export type ReconciliationResult = {
  scanned: number
  cleaned: number
  skipped: number
  failed: number
  failures: Array<{ evidenceId: string; error: unknown }>
}

export type ReconciliationOptions = {
  cutoff: Date
  execute?: boolean
  batchSize?: number
}

export type ReconciliationDependencies = {
  db: ReconciliationDb
  deleteObject: (storageKey: string) => Promise<void>
  validateStorage: () => unknown
}

function assertOptions(options: ReconciliationOptions): number {
  if (!(options.cutoff instanceof Date) || Number.isNaN(options.cutoff.getTime())) {
    throw new Error('cutoff must be a valid Date')
  }

  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
    throw new Error('batchSize must be a positive integer')
  }
  return batchSize
}

/**
 * Reconciles runtime Evidence rows that never reached upload FASE 3 (ADR-001 D5.4).
 * The caller must choose the cutoff explicitly; this service has no grace-period default.
 */
export async function reconcilePendingEvidence(
  options: ReconciliationOptions,
  dependencies?: ReconciliationDependencies,
): Promise<ReconciliationResult> {
  const batchSize = assertOptions(options)
  const runtimeDependencies = dependencies ?? {
    db: getDb(),
    deleteObject: (storageKey: string) => PrivateFileStore.delete(storageKey),
    validateStorage: getEvidenceStorageRoot,
  }

  // D14: fail closed before even a dry-run query and, critically, before DB writes.
  runtimeDependencies.validateStorage()

  const result: ReconciliationResult = {
    scanned: 0,
    cleaned: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  }
  let after: Pick<Candidate, 'createdAt' | 'id'> | undefined

  for (;;) {
    const rows: Candidate[] = await runtimeDependencies.db.evidence.findMany({
      where: {
        url: null,
        deletedAt: null,
        createdAt: { lte: options.cutoff },
        ...(after && {
          OR: [
            { createdAt: { gt: after.createdAt } },
            { createdAt: after.createdAt, id: { gt: after.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: batchSize,
      select: { id: true, findingId: true, storageKey: true, createdAt: true },
    })

    if (rows.length === 0) break
    const last = rows.at(-1)!
    after = { createdAt: last.createdAt, id: last.id }

    for (const candidate of rows) {
      // Use the single domain definition; legacy rows are traversed but never candidates.
      if (isLegacyStorageKey(candidate.storageKey)) continue
      result.scanned += 1

      if (!options.execute) continue

      try {
        const outcome = await runtimeDependencies.db.$transaction(async (tx) => {
          const deleted = await tx.evidence.deleteMany({
            where: {
              id: candidate.id,
              url: null,
              deletedAt: null,
              createdAt: { lte: options.cutoff },
              NOT: { storageKey: { startsWith: LEGACY_STORAGE_KEY_PREFIX } },
            },
          })

          if (deleted.count === 0) return 'skipped' as const

          await runtimeDependencies.deleteObject(candidate.storageKey)
          await tx.auditLog.create({
            data: {
              entityType: 'Evidence',
              entityId: candidate.id,
              action: 'DELETE',
              actorId: null,
              before: {
                findingId: candidate.findingId,
                storageKey: candidate.storageKey,
                createdAt: candidate.createdAt,
              },
              after: { phase: 'INCOMPLETE_UPLOAD_CLEANUP' },
            },
          })
          return 'cleaned' as const
        })

        result[outcome] += 1
      } catch (error) {
        result.failed += 1
        result.failures.push({ evidenceId: candidate.id, error })
      }
    }

    if (rows.length < batchSize) break
  }

  return result
}
