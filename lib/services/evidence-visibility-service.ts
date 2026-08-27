import { getDb } from '@/lib/db-lazy'
import { LEGACY_STORAGE_KEY_PREFIX, isLegacyStorageKey } from '@/lib/storage/storage-key'
import type { EvidenceVisibility } from '@/lib/generated/prisma/client'

/**
 * Publicación explícita de evidencia de runtime hacia el reporte público
 * (ADR-001 D12). Cambia únicamente el flag `Evidence.visibility` en BD:
 * nunca toca `storageKey`, nunca lee ni escribe bytes — el almacén de
 * ficheros (`PrivateFileStore`) es ajeno a esta operación por completo.
 *
 * Sigue el mismo patrón operativo que `evidence-restore-service.ts`
 * (D6-bis.A): manual, `evidenceId` único, dry-run por defecto, sin UI y sin
 * endpoint HTTP — la decisión de qué evidencia se hace pública es deliberada
 * y de baja frecuencia, no una superficie que valga la pena exponer por API.
 */

type VisibilityDb = ReturnType<typeof getDb>

export type SetVisibilityResult = {
  status: 'eligible' | 'no-op' | 'changed'
  evidenceId: string
  visibility: EvidenceVisibility
}

export type SetVisibilityDependencies = { db: VisibilityDb }

export async function setEvidenceVisibility(
  evidenceId: string,
  visibility: EvidenceVisibility,
  options: { execute?: boolean; actorId?: string; reason?: string } = {},
  dependencies?: SetVisibilityDependencies,
): Promise<SetVisibilityResult> {
  if (!evidenceId.trim()) throw new Error('EVIDENCE_ID_REQUIRED')
  const deps = dependencies ?? { db: getDb() }

  const evidence = await deps.db.evidence.findUnique({
    where: { id: evidenceId },
    select: {
      id: true,
      storageKey: true,
      visibility: true,
      deletedAt: true,
      finding: { select: { deletedAt: true } },
    },
  })
  if (!evidence) throw new Error('NOT_FOUND')
  if (evidence.deletedAt !== null) throw new Error('EVIDENCE_DELETED')
  if (evidence.finding.deletedAt !== null) throw new Error('FINDING_DELETED')
  // La visibilidad legacy la decide únicamente isLegacyStorageKey (D9, D8.1):
  // este flag no tiene efecto sobre esas filas y marcarlo sería engañoso.
  if (isLegacyStorageKey(evidence.storageKey)) throw new Error('LEGACY_NOT_APPLICABLE')

  if (evidence.visibility === visibility) {
    return { status: 'no-op', evidenceId, visibility }
  }

  if (!options.execute) return { status: 'eligible', evidenceId, visibility }

  await deps.db.$transaction(async (tx) => {
    // CAS sobre el valor leído: si cambió entre el lookup y aquí (concurrencia
    // o soft delete en curso), no se escribe nada.
    const updated = await tx.evidence.updateMany({
      where: {
        id: evidenceId,
        visibility: evidence.visibility,
        deletedAt: null,
        finding: { deletedAt: null },
        NOT: { storageKey: { startsWith: LEGACY_STORAGE_KEY_PREFIX } },
      },
      data: { visibility },
    })
    if (updated.count === 0) throw new Error('STATE_CHANGED')

    await tx.auditLog.create({
      data: {
        entityType: 'Evidence',
        entityId: evidenceId,
        action: 'UPDATE',
        actorId: options.actorId ?? null,
        before: { visibility: evidence.visibility },
        after: {
          phase: 'VISIBILITY_CHANGE',
          visibility,
          ...(options.reason ? { reason: options.reason } : {}),
        },
      },
    })
  })

  return { status: 'changed', evidenceId, visibility }
}
