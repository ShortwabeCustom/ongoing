/**
 * Mueve el "Listado ONGOING PWA 2026" (cargado el 2026-09-18 por
 * `import-ongoing-listado.ts`) del proyecto donde se cargó (PWA 2.0) a un proyecto
 * nuevo "PWA 1.0", al que pertenece.
 *
 *   # Simulación (por defecto): no escribe nada, solo informa y valida
 *   node scripts/run-ts.cjs scripts/move-ongoing-to-pwa-1-0.ts --owner=alexis.pro_sk8@hotmail.com
 *
 *   # Migración real (una sola transacción; revierte todo si una verificación falla)
 *   node scripts/run-ts.cjs scripts/move-ongoing-to-pwa-1-0.ts --owner=... --apply
 *
 * Qué se mueve, y por qué:
 * - Los hallazgos de la sesión "Listado ONGOING PWA 2026" (deben ser exactamente --expect=155).
 * - Esa sesión de pruebas y su lote de importación: pertenecen a un proyecto, y dejarlos en
 *   PWA 2.0 dejaría datos cruzados entre proyectos. La sesión pasa a una versión "legacy-import"
 *   de PWA 1.0 (misma convención del importador: una por proyecto).
 * - `sourceFingerprint` se recalcula con el proyecto nuevo (incluye projectId): así el guardián
 *   de idempotencia del importador sigue siendo coherente.
 *
 * Lo que NO cambia: `updatedAt`/`version` de los hallazgos (UPDATE directo, no es una edición),
 * comentarios, historial de estados, evidencia y demás datos, que cuelgan del id del hallazgo.
 * Cada movimiento deja un registro en `audit_logs`.
 */
import { getDb } from '@/lib/db-lazy'
import { generateFingerprint } from '@/lib/utils/fingerprint'

const SOURCE_PROJECT = 'PWA 2.0'
const TARGET_PROJECT = 'PWA 1.0'
const SESSION_NAME = 'Listado ONGOING PWA 2026'
const IMPORT_VERSION = 'legacy-import'
const MONTH_SHEETS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre']

function parseArgs(argv: string[]) {
  const get = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  return { owner: get('owner')?.toLowerCase(), expect: Number(get('expect') ?? 155), apply: argv.includes('--apply') }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Verificación fallida: ${message}`)
}

async function main() {
  const { owner: ownerEmail, expect, apply } = parseArgs(process.argv.slice(2))
  if (!ownerEmail) {
    console.error('Uso: --owner=<email del owner de PWA 1.0> [--expect=155] [--apply]')
    process.exitCode = 1
    return
  }
  const db = getDb()

  const owner = await db.user.findUnique({ where: { email: ownerEmail }, select: { id: true, email: true, name: true } })
  assert(owner, `usuario ${ownerEmail} no encontrado`)
  const source = await db.project.findFirst({ where: { name: SOURCE_PROJECT, deletedAt: null }, select: { id: true, name: true } })
  assert(source, `proyecto "${SOURCE_PROJECT}" no encontrado`)

  const sessions = await db.testSession.findMany({ where: { projectId: source.id, name: SESSION_NAME }, select: { id: true, name: true } })
  assert(sessions.length === 1, `se esperaba 1 sesión "${SESSION_NAME}" en ${SOURCE_PROJECT}, hay ${sessions.length}`)
  const [session] = sessions
  const batches = await db.importBatch.findMany({ where: { testSessionId: session.id }, select: { id: true, projectId: true } })
  assert(batches.length === 1 && batches[0].projectId === source.id, 'se esperaba 1 lote de importación de esa sesión, en el proyecto origen')
  const [batch] = batches

  // Conjunto exacto: TODOS los hallazgos de la sesión (vivos o borrados), y solo ellos.
  const findings = await db.finding.findMany({
    where: { testSessionId: session.id },
    select: { id: true, projectId: true, folio: true, observation: true, sourceRow: true, sourceSheet: true, sourceFingerprint: true, importBatchId: true, status: true, deletedAt: true },
  })
  assert(findings.length === expect, `se esperaban ${expect} hallazgos en la sesión, hay ${findings.length}`)
  assert(findings.every((f) => f.projectId === source.id), 'hay hallazgos de la sesión fuera del proyecto origen')
  assert(findings.every((f) => f.importBatchId === batch.id), 'hay hallazgos de la sesión fuera del lote de importación')
  assert(findings.every((f) => f.sourceSheet && MONTH_SHEETS.includes(f.sourceSheet)), 'hay hallazgos que no vienen de una hoja mensual del listado')
  const otherInBatch = await db.finding.count({ where: { importBatchId: batch.id, testSessionId: { not: session.id } } })
  assert(otherInBatch === 0, 'el lote contiene hallazgos de otra sesión')
  assert(findings.every((f) => f.sourceRow !== null && f.sourceFingerprint !== null), 'faltan sourceRow o sourceFingerprint')

  // La huella actual debe poder reproducirse con la receta del importador (valida la receta).
  const fingerprint = (projectId: string, f: (typeof findings)[number]) =>
    generateFingerprint(projectId, f.sourceRow as number, f.observation, { testSessionId: session.id, sourceSheet: f.sourceSheet as string, sourceId: f.folio ?? undefined })
  const mismatched = findings.filter((f) => fingerprint(source.id, f) !== f.sourceFingerprint)
  assert(mismatched.length === 0, `${mismatched.length} huellas actuales no coinciden con la receta del importador (ids: ${mismatched.slice(0, 3).map((f) => f.id).join(', ')})`)

  const existingTarget = await db.project.findFirst({ where: { name: TARGET_PROJECT, deletedAt: null }, select: { id: true } })
  assert(!existingTarget, `ya existe un proyecto "${TARGET_PROJECT}" (${existingTarget?.id}); revisa antes de continuar`)

  const byStatus = findings.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.status]: (acc[f.status] ?? 0) + 1 }), {})
  console.log(`Modo: ${apply ? 'MIGRACIÓN REAL' : 'SIMULACIÓN (no se escribe nada)'}`)
  console.log(`Origen : ${source.name} (${source.id})`)
  console.log(`Destino: ${TARGET_PROJECT} (se crea) · owner: ${owner.name} <${owner.email}> · versión "${IMPORT_VERSION}"`)
  console.log(`Sesión : ${session.name} (${session.id}) · lote ${batch.id}`)
  console.log(`Hallazgos a mover: ${findings.length} · por estado: ${JSON.stringify(byStatus)}`)
  console.log('Verificado: conjunto cerrado (sesión = lote = hojas mensuales), huellas reproducibles con la receta del importador.')

  if (!apply) {
    console.log('\nSimulación terminada. Añade --apply para migrar.')
    return
  }

  await db.$transaction(
    async (tx) => {
      // 1) Proyecto nuevo (misma forma que ProjectService.createProject) + auditoría
      const target = await tx.project.create({
        data: { name: TARGET_PROJECT, ownerId: owner.id, members: { create: { userId: owner.id, role: 'OWNER' } } },
        include: { members: true },
      })
      await tx.auditLog.create({
        data: { entityType: 'Project', entityId: target.id, action: 'CREATE', actorId: owner.id, after: JSON.parse(JSON.stringify(target)) },
      })
      const version = await tx.productVersion.create({ data: { projectId: target.id, version: IMPORT_VERSION } })

      // 2) Sesión y lote
      await tx.testSession.update({ where: { id: session.id }, data: { projectId: target.id, versionId: version.id } })
      await tx.importBatch.update({ where: { id: batch.id }, data: { projectId: target.id } })
      await tx.auditLog.createMany({
        data: [
          { entityType: 'TestSession', entityId: session.id, action: 'UPDATE', actorId: owner.id, before: { projectId: source.id }, after: { projectId: target.id, versionId: version.id } },
          { entityType: 'ImportBatch', entityId: batch.id, action: 'UPDATE', actorId: owner.id, before: { projectId: source.id }, after: { projectId: target.id } },
        ],
      })

      // 3) Hallazgos: UPDATE directo para no tocar updatedAt/version (no es una edición del hallazgo)
      for (const f of findings) {
        const updated = await tx.$executeRaw`UPDATE findings SET "projectId" = ${target.id}, "sourceFingerprint" = ${fingerprint(target.id, f)} WHERE id = ${f.id} AND "projectId" = ${source.id}`
        assert(updated === 1, `no se pudo mover el hallazgo ${f.id}`)
      }
      await tx.auditLog.createMany({
        data: findings.map((f) => ({
          entityType: 'Finding',
          entityId: f.id,
          action: 'UPDATE' as const,
          actorId: owner.id,
          before: { projectId: source.id, sourceFingerprint: f.sourceFingerprint },
          after: { projectId: target.id, sourceFingerprint: fingerprint(target.id, f) },
        })),
      })

      // 4) Postcondiciones: si algo no cuadra, se revierte todo
      const inTarget = await tx.finding.count({ where: { projectId: target.id } })
      const sessionFindingsElsewhere = await tx.finding.count({ where: { testSessionId: session.id, projectId: { not: target.id } } })
      const stillInSource = await tx.finding.count({ where: { projectId: source.id, testSessionId: session.id } })
      const s = await tx.testSession.findUniqueOrThrow({ where: { id: session.id }, select: { projectId: true, version: { select: { projectId: true } } } })
      assert(inTarget === expect && sessionFindingsElsewhere === 0 && stillInSource === 0, 'conteos finales de hallazgos')
      assert(s.projectId === target.id && s.version.projectId === target.id, 'la sesión y su versión deben pertenecer al proyecto nuevo')
      console.log(`\n✅ Proyecto ${TARGET_PROJECT} creado (${target.id}) · ${inTarget} hallazgos movidos · sesión ${session.id} · lote ${batch.id}`)
    },
    { timeout: 120_000, maxWait: 20_000 },
  )
}

main()
  .catch((error) => {
    console.error('❌', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await getDb().$disconnect()
  })
