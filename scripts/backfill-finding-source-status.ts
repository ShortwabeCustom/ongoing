/**
 * Rellena `findings.sourceStatus` de los hallazgos del "Listado ONGOING PWA 2026" con el
 * estatus literal del Excel (On hold, Refinamiento, Liberado, Cancelado).
 *
 * El importador tradujo esos estatus al flujo del sistema (`status`) y en la traducción
 * Liberado y Cancelado se fundieron en CLOSED; el original solo sobrevivió como comentario
 * privado. Este script lo guarda en una columna propia, leyendo el Excel fuente.
 *
 *   # Simulación (por defecto): no escribe nada, solo informa y valida
 *   node scripts/run-ts.cjs scripts/backfill-finding-source-status.ts --file="/var/www/Listado ONGOING PWA 2026.xlsx"
 *
 *   # Escritura real (una sola transacción; revierte si una verificación falla)
 *   node scripts/run-ts.cjs scripts/backfill-finding-source-status.ts --file=... --apply
 *
 * Reglas
 * - Se cruza por (hoja, fila del Excel, folio), los mismos datos que guardó el importador.
 * - Cada fila debe encontrar exactamente un hallazgo, y la traducción del estatus del Excel
 *   debe coincidir con el `status` ya guardado; si algo no cuadra, no se escribe nada.
 * - `updatedAt` y `version` no cambian (UPDATE directo: es procedencia, no una edición).
 * - Idempotente: solo escribe donde `sourceStatus` es NULL.
 */
import path from 'node:path'
import * as XLSX from 'xlsx'
import { getDb } from '@/lib/db-lazy'

const SESSION_NAME = 'Listado ONGOING PWA 2026'
const SHEETS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre']
// Misma traducción que usó el importador (import-ongoing-listado.ts)
const TRANSLATION: Record<string, string> = { 'on hold': 'OPEN', refinamiento: 'TRIAGED', liberado: 'CLOSED', cancelado: 'CLOSED' }

const text = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()

function parseArgs(argv: string[]) {
  const get = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  return { file: get('file'), expect: Number(get('expect') ?? 155), apply: argv.includes('--apply') }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Verificación fallida: ${message}`)
}

function readExcel(file: string) {
  const wb = XLSX.readFile(file)
  const rows = new Map<string, { sheet: string; sourceRow: number; folio: string; original: string }>()
  for (const sheet of SHEETS) {
    const ws = wb.Sheets[sheet]
    assert(ws, `la hoja "${sheet}" no existe`)
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
    const headers = (data[0] ?? []).map((h) => text(h))
    const col = (name: string) => headers.indexOf(name)
    data.slice(1).forEach((cells, index) => {
      const folio = text(cells[col('Folio')]).toUpperCase()
      if (!/^PROD\d+$/.test(folio)) return
      if (text(cells[col('Descripción')]).length < 5) return
      const original = text(cells[col('Estatus')])
      if (!(original.toLowerCase() in TRANSLATION)) return // el importador tampoco cargó estas filas
      rows.set(`${sheet}|${index + 2}|${folio}`, { sheet, sourceRow: index + 2, folio, original })
    })
  }
  return rows
}

async function main() {
  const { file, expect, apply } = parseArgs(process.argv.slice(2))
  if (!file) {
    console.error('Uso: --file=<xlsx> [--expect=155] [--apply]')
    process.exitCode = 1
    return
  }
  const db = getDb()
  const excel = readExcel(file)

  const findings = await db.finding.findMany({
    where: { testSession: { name: SESSION_NAME }, sourceSheet: { in: SHEETS } },
    select: { id: true, sourceSheet: true, sourceRow: true, folio: true, status: true, sourceStatus: true, deletedAt: true },
  })
  assert(findings.length === expect, `se esperaban ${expect} hallazgos del listado, hay ${findings.length}`)
  assert(excel.size === expect, `se esperaban ${expect} filas válidas en el Excel, hay ${excel.size}`)

  const plan = findings.map((f) => {
    const row = excel.get(`${f.sourceSheet}|${f.sourceRow}|${f.folio}`)
    assert(row, `el hallazgo ${f.id} (${f.sourceSheet} fila ${f.sourceRow} ${f.folio}) no está en el Excel`)
    assert(TRANSLATION[row.original.toLowerCase()] === f.status, `${f.folio}: el Excel dice "${row.original}" pero el hallazgo está en ${f.status}`)
    assert(f.sourceStatus === null || f.sourceStatus === row.original, `${f.folio}: ya tiene sourceStatus "${f.sourceStatus}" distinto de "${row.original}"`)
    return { id: f.id, folio: f.folio, value: row.original, already: f.sourceStatus === row.original }
  })
  assert(new Set(plan.map((p) => p.id)).size === expect, 'hay hallazgos repetidos en el plan')

  const tally = plan.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.value]: (acc[p.value] ?? 0) + 1 }), {})
  const pending = plan.filter((p) => !p.already)
  console.log(`Modo: ${apply ? 'ESCRITURA REAL' : 'SIMULACIÓN (no se escribe nada)'} · archivo: ${path.basename(file)}`)
  console.log(`Hallazgos del listado: ${findings.length} · con sourceStatus por escribir: ${pending.length}`)
  console.log('Estatus del Excel:', JSON.stringify(tally))
  console.log('Verificado: cada fila del Excel ↔ un hallazgo; traducción del estatus coincide con `status` en las 155.')

  if (!apply) {
    console.log('\nSimulación terminada. Añade --apply para escribir.')
    return
  }
  if (pending.length === 0) {
    console.log('\nNada que escribir.')
    return
  }

  const actor = await db.user.findUnique({ where: { email: 'alexis.pro_sk8@hotmail.com' }, select: { id: true } })
  await db.$transaction(
    async (tx) => {
      for (const p of pending) {
        const updated = await tx.$executeRaw`UPDATE findings SET "sourceStatus" = ${p.value} WHERE id = ${p.id} AND "sourceStatus" IS NULL`
        assert(updated === 1, `no se pudo escribir ${p.folio}`)
      }
      await tx.auditLog.createMany({
        data: pending.map((p) => ({
          entityType: 'Finding',
          entityId: p.id,
          action: 'UPDATE' as const,
          actorId: actor?.id ?? null,
          before: { sourceStatus: null },
          after: { sourceStatus: p.value, source: 'Listado ONGOING PWA 2026.xlsx' },
        })),
      })
      const grouped = await tx.finding.groupBy({ by: ['sourceStatus'], where: { testSession: { name: SESSION_NAME } }, _count: { _all: true } })
      const result = Object.fromEntries(grouped.map((g) => [g.sourceStatus, g._count._all]))
      assert(JSON.stringify(Object.entries(result).sort()) === JSON.stringify(Object.entries(tally).sort()), 'los conteos finales no coinciden con el Excel')
      console.log(`\n✅ sourceStatus escrito en ${pending.length} hallazgos:`, JSON.stringify(result))
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
