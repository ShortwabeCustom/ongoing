import { getDb } from '@/lib/db-lazy'
import { PrivateFileStore } from '@/lib/storage/private-file-store'
import { getEvidenceStorageRoot } from '@/lib/storage/storage-root'
import { LEGACY_STORAGE_KEY_PREFIX, isLegacyStorageKey } from '@/lib/storage/storage-key'

type PurgeDb = ReturnType<typeof getDb>
type Candidate = { id: string; findingId: string; storageKey: string; deletedAt: Date }
export type PurgeDependencies = { db: PurgeDb; validateStorage: () => unknown; deleteObject: (key: string) => Promise<void> }
export type PurgeResult = { scanned: number; purged: number; skipped: number; failed: number; failures: string[] }

export async function purgeEvidence(
  options: { cutoff: Date; execute?: boolean; gateOpen?: boolean; batchSize?: number },
  dependencies?: PurgeDependencies,
): Promise<PurgeResult> {
  if (!(options.cutoff instanceof Date) || Number.isNaN(options.cutoff.getTime())) throw new Error('INVALID_CUTOFF')
  const batchSize = options.batchSize ?? 100
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) throw new Error('INVALID_BATCH_SIZE')
  if (options.execute && !options.gateOpen) throw new Error('PURGE_GATE_CLOSED')
  const deps = dependencies ?? { db: getDb(), validateStorage: getEvidenceStorageRoot, deleteObject: (key: string) => PrivateFileStore.delete(key) }
  deps.validateStorage()
  const result: PurgeResult = { scanned: 0, purged: 0, skipped: 0, failed: 0, failures: [] }
  let after: { deletedAt: Date; id: string } | undefined

  for (;;) {
    const fetched = await deps.db.evidence.findMany({
      where: { deletedAt: { lte: options.cutoff }, url: null, ...(after && { OR: [{ deletedAt: { gt: after.deletedAt } }, { deletedAt: after.deletedAt, id: { gt: after.id } }] }) },
      orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }], take: batchSize,
      select: { id: true, findingId: true, storageKey: true, deletedAt: true },
    })
    const rows: Candidate[] = fetched.map((row) => {
      if (row.deletedAt === null) throw new Error('INVALID_PURGE_CANDIDATE')
      return { ...row, deletedAt: row.deletedAt }
    })
    if (rows.length === 0) break
    const last = rows.at(-1)!
    after = { deletedAt: last.deletedAt, id: last.id }
    for (const candidate of rows) {
      if (isLegacyStorageKey(candidate.storageKey)) continue
      result.scanned += 1
      if (!options.execute) continue
      try {
        const outcome = await deps.db.$transaction(async (tx) => {
          const locked = await tx.evidence.updateMany({
            where: { id: candidate.id, deletedAt: candidate.deletedAt, url: null, NOT: { storageKey: { startsWith: LEGACY_STORAGE_KEY_PREFIX } } },
            data: { deletedAt: candidate.deletedAt },
          })
          if (locked.count === 0) return 'skipped' as const
          const prior = await tx.auditLog.findFirst({
            where: { entityType: 'Evidence', entityId: candidate.id, action: 'DELETE', after: { path: ['phase'], equals: 'PHYSICAL_PURGE' } },
            select: { id: true },
          })
          if (prior) return 'skipped' as const
          await deps.deleteObject(candidate.storageKey)
          await tx.auditLog.create({ data: {
            entityType: 'Evidence', entityId: candidate.id, action: 'DELETE', actorId: null,
            before: { deletedAt: candidate.deletedAt, findingId: candidate.findingId },
            after: { phase: 'PHYSICAL_PURGE', deletedAt: candidate.deletedAt },
          } })
          return 'purged' as const
        })
        result[outcome] += 1
      } catch {
        result.failed += 1
        result.failures.push(candidate.id)
      }
    }
    if (rows.length < batchSize) break
  }
  return result
}
