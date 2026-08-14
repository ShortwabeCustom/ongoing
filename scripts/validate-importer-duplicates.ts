#!/usr/bin/env node
/**
 * Validador de Importador — Verifica que no existan duplicados
 *
 * Uso:
 *   npx tsx scripts/validate-importer-duplicates.ts --batchId imp_abc123 --verbose
 *   npx tsx scripts/validate-importer-duplicates.ts --checkAll
 *
 * Garantía: Detecta duplicados en sourceFingerprint (único por diseño)
 */

import { getDb } from '@/lib/db-lazy'

interface ValidationResult {
  totalFindings: number
  findingsWithFingerprint: number
  duplicateFingerprints: number
  duplicates: Array<{
    fingerprint: string
    occurrences: number
    findingIds: string[]
  }>
  importBatches: number
  errors: string[]
  status: 'PASSED' | 'FAILED'
  timestamp: string
}

async function validateImporterDuplicates(): Promise<ValidationResult> {
  const args = process.argv.slice(2)
  const batchId = args.includes('--batchId') ? args[args.indexOf('--batchId') + 1] : null
  const checkAll = args.includes('--checkAll')
  const verbose = args.includes('--verbose')

  const result: ValidationResult = {
    totalFindings: 0,
    findingsWithFingerprint: 0,
    duplicateFingerprints: 0,
    duplicates: [],
    importBatches: 0,
    errors: [],
    status: 'PASSED',
    timestamp: new Date().toISOString(),
  }

  const db = getDb()

  console.log('\n🔍 Validador de Importador — Verificando duplicados...\n')

  try {
    // 1. Contar findings totales
    const totalFindings = await db.finding.count({ where: { deletedAt: null } })
    result.totalFindings = totalFindings
    console.log(`📊 Total de findings: ${totalFindings}`)

    // 2. Contar findings con fingerprint
    const findingsWithFingerprint = await db.finding.count({
      where: { sourceFingerprint: { not: null }, deletedAt: null },
    })
    result.findingsWithFingerprint = findingsWithFingerprint
    console.log(`📌 Findings con fingerprint: ${findingsWithFingerprint}`)

    // 3. Contar import batches
    const importBatches = await db.importBatch.count()
    result.importBatches = importBatches
    console.log(`📦 Import batches totales: ${importBatches}`)

    // 4. Detectar duplicados en sourceFingerprint
    console.log('\n🔎 Buscando duplicados en sourceFingerprint...')

    const duplicateQuery = await db.$queryRaw<
      Array<{ fingerprint: string; count: number }>
    >`
      SELECT
        "sourceFingerprint" as fingerprint,
        COUNT(*) as count
      FROM "Finding"
      WHERE
        "sourceFingerprint" IS NOT NULL
        AND "deletedAt" IS NULL
      GROUP BY "sourceFingerprint"
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `

    result.duplicateFingerprints = duplicateQuery.length

    if (duplicateQuery.length === 0) {
      console.log('✅ NO hay duplicados detectados (sourceFingerprint es único)')
    } else {
      console.log(`❌ ${duplicateQuery.length} fingerprints duplicados encontrados:`)
      result.status = 'FAILED'
      result.errors.push(`${duplicateQuery.length} duplicados en sourceFingerprint`)

      for (const dup of duplicateQuery) {
        const findingIds = await db.finding.findMany({
          where: { sourceFingerprint: dup.fingerprint, deletedAt: null },
          select: { id: true, observation: true, sourceSheet: true, sourceRow: true },
        })

        result.duplicates.push({
          fingerprint: dup.fingerprint,
          occurrences: dup.count,
          findingIds: findingIds.map((f) => f.id),
        })

        console.log(`\n  📄 Fingerprint: ${dup.fingerprint}`)
        console.log(`     Ocurrencias: ${dup.count}`)
        findingIds.forEach((finding, idx) => {
          console.log(
            `     [${idx + 1}] ID: ${finding.id} | ${finding.sourceSheet}:${finding.sourceRow} | "${finding.observation?.substring(0, 50)}..."`
          )
        })
      }
    }

    // 5. Si batchId especificado, validar ese batch
    if (batchId) {
      console.log(`\n🎯 Validando batch específico: ${batchId}`)

      const batch = await db.importBatch.findUnique({
        where: { id: batchId },
        include: {
          _count: {
            select: { findings: true },
          },
        },
      })

      if (!batch) {
        console.log(`❌ Batch no encontrado: ${batchId}`)
        result.errors.push(`Batch ${batchId} no encontrado`)
        result.status = 'FAILED'
      } else {
        console.log(`   Status: ${batch.status}`)
        console.log(`   Findings creados: ${batch._count.findings}`)
        console.log(`   Filas totales: ${batch.totalRows}`)
        console.log(`   Filas válidas: ${batch.validRows}`)
        console.log(`   Filas saltadas: ${batch.skippedRows}`)

        // Buscar duplicados en este batch
        const batchDuplicates = await db.$queryRaw<
          Array<{ fingerprint: string; count: number }>
        >`
          SELECT
            "sourceFingerprint" as fingerprint,
            COUNT(*) as count
          FROM "Finding"
          WHERE
            "importBatchId" = ${batchId}
            AND "sourceFingerprint" IS NOT NULL
            AND "deletedAt" IS NULL
          GROUP BY "sourceFingerprint"
          HAVING COUNT(*) > 1
        `

        if (batchDuplicates.length === 0) {
          console.log('   ✅ Sin duplicados en este batch')
        } else {
          console.log(
            `   ❌ ${batchDuplicates.length} duplicados encontrados en este batch`
          )
          result.errors.push(`${batchDuplicates.length} duplicados en batch ${batchId}`)
          result.status = 'FAILED'
        }
      }
    }

    // 6. Validación de constraint único
    console.log('\n✔️ Verificando constraint UNIQUE en sourceFingerprint...')
    const constraintCheck = await db.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'Finding'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%sourceFingerprint%'
    `

    if (constraintCheck.length > 0) {
      console.log(`   ✅ Constraint UNIQUE existe: ${constraintCheck[0].constraint_name}`)
    } else {
      console.log('   ⚠️ No se encontró constraint UNIQUE en sourceFingerprint')
      result.errors.push('Constraint UNIQUE no configurado en sourceFingerprint')
    }

    // 7. Reporte final
    console.log('\n' + '='.repeat(60))
    console.log('📋 REPORTE FINAL')
    console.log('='.repeat(60))
    console.log(`Status: ${result.status === 'PASSED' ? '✅ PASSED' : '❌ FAILED'}`)
    console.log(`Total findings: ${result.totalFindings}`)
    console.log(`Con fingerprint: ${result.findingsWithFingerprint}`)
    console.log(`Duplicados detectados: ${result.duplicateFingerprints}`)
    console.log(`Import batches: ${result.importBatches}`)
    console.log(`Timestamp: ${result.timestamp}`)

    if (result.errors.length > 0) {
      console.log(`\n⚠️ Errores encontrados:`)
      result.errors.forEach((err) => console.log(`   • ${err}`))
    }

    if (verbose && result.duplicates.length > 0) {
      console.log('\n📊 Detalles de duplicados:')
      console.log(JSON.stringify(result.duplicates, null, 2))
    }

    console.log('\n')
  } catch (error) {
    console.error('❌ Error durante validación:', error)
    result.status = 'FAILED'
    result.errors.push(`Error: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await db.$disconnect()
  }

  return result
}

// Ejecutar
validateImporterDuplicates()
  .then((result) => {
    process.exit(result.status === 'PASSED' ? 0 : 1)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
