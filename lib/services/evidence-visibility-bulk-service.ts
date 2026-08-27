import { getDb } from '@/lib/db-lazy'
import { PrivateFileStore } from '@/lib/storage/private-file-store'
import { isLegacyStorageKey } from '@/lib/storage/storage-key'
import { setEvidenceVisibility, type SetVisibilityDependencies } from './evidence-visibility-service'
import type { EvidenceVisibility } from '@/lib/generated/prisma/client'

/**
 * Publicación/despublicación MASIVA de evidencia de runtime (ADR-001 D12-bis).
 *
 * Extiende `evidence-visibility-service.ts` (mutación fila-a-fila, CAS,
 * `AuditLog` por cambio) con la clasificación de elegibilidad que el
 * mecanismo manual no necesita: solo se puede publicar en bloque una
 * evidencia cuyos bytes existen realmente en `PrivateFileStore` — cualquier
 * fila cuya `storageKey` no resuelva a un objeto real queda excluida
 * (`skippedUnsupported`), aunque su patrón no sea legacy.
 *
 * `--execute` reutiliza `setEvidenceVisibility` fila por fila: cada cambio es
 * su propia transacción con CAS + `AuditLog`, igual que el camino manual. Un
 * fallo puntual (carrera, soft-delete concurrente) se cuenta como `failed` y
 * NO aborta el resto del lote — a esta escala (cientos de filas) preferimos
 * progreso parcial auditado sobre atomicidad de todo-o-nada, porque un fallo
 * en una fila no tiene relación causal con las demás.
 *
 * `dry-run` (por defecto) no abre transacciones ni llama a `setEvidenceVisibility`:
 * solo lee `Evidence` y comprueba bytes en el almacén, cero escrituras.
 */

type BulkDb = ReturnType<typeof getDb>
export type BulkDependencies = { db: BulkDb }

export type DryRunSummary = {
  mode: 'dry-run'
  eligible: number
  alreadyTarget: number
  skippedPending: number
  skippedDeleted: number
  skippedDeletedFinding: number
  skippedLegacy: number
  skippedUnsupported: number
  total: number
}

export type ExecuteSummary = {
  mode: 'execute'
  changed: number
  unchanged: number
  skipped: number
  failed: number
  total: number
  failedIds: string[]
}

export type BulkVisibilityResult = DryRunSummary | ExecuteSummary

type Row = {
  id: string
  storageKey: string
  url: string | null
  visibility: EvidenceVisibility
  type: string
  deletedAt: Date | null
  finding: { deletedAt: Date | null }
}

/** Tipos de evidencia que, por semántica, no viven en `PrivateFileStore` (D9/D12-bis). */
const NON_STORAGE_BACKED_TYPES = new Set(['FIGMA_URL', 'EXTERNAL_URL'])

type Classification =
  | { bucket: 'skippedDeleted' }
  | { bucket: 'skippedLegacy' }
  | { bucket: 'skippedDeletedFinding' }
  | { bucket: 'skippedPending' }
  | { bucket: 'skippedUnsupported' }
  | { bucket: 'alreadyTarget' }
  | { bucket: 'eligible' }

async function classify(row: Row, visibility: EvidenceVisibility): Promise<Classification> {
  if (row.deletedAt !== null) return { bucket: 'skippedDeleted' }
  if (isLegacyStorageKey(row.storageKey)) return { bucket: 'skippedLegacy' }
  if (row.finding.deletedAt !== null) return { bucket: 'skippedDeletedFinding' }
  if (!row.url) return { bucket: 'skippedPending' }
  if (NON_STORAGE_BACKED_TYPES.has(row.type)) return { bucket: 'skippedUnsupported' }

  const bytesExist = await PrivateFileStore.exists(row.storageKey)
  if (!bytesExist) return { bucket: 'skippedUnsupported' }

  if (row.visibility === visibility) return { bucket: 'alreadyTarget' }
  return { bucket: 'eligible' }
}

/**
 * Publica/despublica en bloque toda la evidencia de runtime activa elegible.
 *
 * `visibility` es el estado DESTINO — el mismo mecanismo sirve tanto para el
 * backfill inicial (`PUBLIC_REPORT`) como para un rollback de datos
 * (`PRIVATE`), con idénticas reglas de elegibilidad.
 */
export async function setAllActiveRuntimeVisibility(
  visibility: EvidenceVisibility,
  options: { execute?: boolean; actorId?: string; reason?: string } = {},
  dependencies?: BulkDependencies,
): Promise<BulkVisibilityResult> {
  const db = dependencies?.db ?? getDb()

  const rows = (await db.evidence.findMany({
    select: {
      id: true,
      storageKey: true,
      url: true,
      visibility: true,
      type: true,
      deletedAt: true,
      finding: { select: { deletedAt: true } },
    },
  })) as Row[]

  const summary = {
    eligible: [] as string[],
    alreadyTarget: 0,
    skippedPending: 0,
    skippedDeleted: 0,
    skippedDeletedFinding: 0,
    skippedLegacy: 0,
    skippedUnsupported: 0,
  }

  for (const row of rows) {
    const result = await classify(row, visibility)
    if (result.bucket === 'eligible') summary.eligible.push(row.id)
    else summary[result.bucket]++
  }

  const total = rows.length

  if (!options.execute) {
    return {
      mode: 'dry-run',
      eligible: summary.eligible.length,
      alreadyTarget: summary.alreadyTarget,
      skippedPending: summary.skippedPending,
      skippedDeleted: summary.skippedDeleted,
      skippedDeletedFinding: summary.skippedDeletedFinding,
      skippedLegacy: summary.skippedLegacy,
      skippedUnsupported: summary.skippedUnsupported,
      total,
    }
  }

  const singleDeps: SetVisibilityDependencies | undefined = dependencies
    ? { db: dependencies.db }
    : undefined

  let changed = 0
  let failed = 0
  const failedIds: string[] = []

  for (const evidenceId of summary.eligible) {
    try {
      const result = await setEvidenceVisibility(
        evidenceId,
        visibility,
        { execute: true, actorId: options.actorId, reason: options.reason },
        singleDeps,
      )
      if (result.status === 'changed') {
        changed++
      } else {
        // no-op inesperado: el estado ya no era el clasificado (carrera concurrente).
        failed++
        failedIds.push(evidenceId)
      }
    } catch {
      failed++
      failedIds.push(evidenceId)
    }
  }

  const skipped =
    summary.skippedPending +
    summary.skippedDeleted +
    summary.skippedDeletedFinding +
    summary.skippedLegacy +
    summary.skippedUnsupported

  return {
    mode: 'execute',
    changed,
    unchanged: summary.alreadyTarget,
    skipped,
    failed,
    total,
    failedIds,
  }
}
