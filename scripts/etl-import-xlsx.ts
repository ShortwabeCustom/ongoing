import * as fs from 'fs'
import * as path from 'path'
import ExcelJS from 'exceljs'
import db from '../lib/db'
import { generateFingerprint } from '@/lib/utils/fingerprint'

// Context
const PROJECT_ID = 'cmsoc6p7l0000h1acb6i9uoyt'
const TEST_SESSION_ID = 'cmsoc6pbq0003h1ac6hgztsda'
const USER_ID = 'cmsnnzhsj0000mzacg3c1w1rn' // Alexis
const DEFAULT_AREA = 'DESIGN'

interface ImportedRow {
  sourceRow: number
  observation: string
  modification?: string
  previousScreen?: string
  mediaFiles: string[]
  fingerprint: string
  status: 'valid' | 'skipped'
  reason?: string
}

async function extractMediaFromXLSX(
  xlsxPath: string,
  outputDir: string,
): Promise<Map<number, string[]>> {
  const mediaMap = new Map<number, string[]>()

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(xlsxPath)

  const sheet = wb.worksheets[0]
  if (!sheet) return mediaMap

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  let rowNum = 1
  sheet.eachRow((row: any) => {
    // Skip header
    if (rowNum === 1) {
      rowNum++
      return
    }

    // Extract media from cells
    const mediaFiles: string[] = []

    row.eachCell((cell: any) => {
      if (cell.type === ExcelJS.ValueType.SharedString && cell.hyperlink) {
        const filename = `row_${rowNum}_${Date.now()}.url`
        fs.writeFileSync(
          path.join(outputDir, filename),
          `[InternetShortcut]\nURL=${cell.hyperlink}`,
        )
        mediaFiles.push(filename)
      }

      // Extract embedded images from drawing
      if (cell.drawing) {
        // This would require more complex image extraction
        // For now, we document that images exist
        mediaFiles.push(`[embedded_image_in_cell_${cell.address}]`)
      }
    })

    if (mediaFiles.length > 0) {
      mediaMap.set(rowNum, mediaFiles)
    }

    rowNum++
  })

  return mediaMap
}

async function normalizeXLSXData(xlsxPath: string): Promise<ImportedRow[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(xlsxPath)

  const sheet = wb.worksheets[0]
  if (!sheet) return []

  const results: ImportedRow[] = []
  let rowNum = 1

  sheet.eachRow((row: any) => {
    // Skip header (row 1)
    if (rowNum === 1) {
      rowNum++
      return
    }

    // ExcelJS uses 1-based column indexing
    // Col 1: boolean flag (ignored)
    // Col 2: Observación (main content)
    // Col 3: Pantalla Anterior
    // Col 4: Modificación

    const observation = (row.getCell(2)?.value || '').toString().trim()
    const previousScreen = (row.getCell(3)?.value || '').toString().trim()
    const modification = (row.getCell(4)?.value || '').toString().trim()

    if (!observation) {
      results.push({
        sourceRow: rowNum,
        observation: '',
        status: 'skipped',
        reason: 'Empty observation',
        fingerprint: '',
        mediaFiles: [],
      })
      rowNum++
      return
    }

    const fingerprint = generateFingerprint(PROJECT_ID, rowNum, observation, {
      testSessionId: TEST_SESSION_ID,
      sourceSheet: 'XLSX',
    })

    results.push({
      sourceRow: rowNum,
      observation,
      previousScreen: previousScreen || undefined,
      modification: modification || undefined,
      fingerprint,
      status: 'valid',
      mediaFiles: [],
    })

    rowNum++
  })

  return results
}

async function detectDuplicates(rows: ImportedRow[]): Promise<Set<string>> {
  const duplicates = new Set<string>()
  const seen = new Map<string, number>()

  for (const row of rows) {
    if (row.status === 'valid') {
      if (seen.has(row.fingerprint)) {
        duplicates.add(row.fingerprint)
      } else {
        seen.set(row.fingerprint, row.sourceRow)
      }
    }
  }

  return duplicates
}

async function checkExistingFingerprints(
  fingerprints: string[],
): Promise<Set<string>> {
  if (fingerprints.length === 0) return new Set()

  const existing = await db.finding.findMany({
    where: {
      sourceFingerprint: { in: fingerprints },
      deletedAt: null,
    },
    select: { sourceFingerprint: true },
  })

  return new Set(
    existing
      .map((f) => f.sourceFingerprint)
      .filter((f): f is string => !!f),
  )
}

async function dryRun(xlsxPath: string): Promise<void> {
  console.log('\n📊 IMPORT DRY-RUN (XLSX → PostgreSQL)')
  console.log('='.repeat(80))

  // Step 1: Normalize data
  console.log('\n1️⃣  Normalizing data...')
  const rows = await normalizeXLSXData(xlsxPath)
  const validRows = rows.filter((r) => r.status === 'valid')
  const skipped = rows.filter((r) => r.status === 'skipped')

  console.log(`   ✅ Total rows: ${rows.length}`)
  console.log(`   ✅ Valid rows: ${validRows.length}`)
  console.log(`   ⚠️  Skipped rows: ${skipped.length}`)

  // Step 2: Detect duplicates in file
  console.log('\n2️⃣  Detecting duplicates in file...')
  const duplicatesInFile = await detectDuplicates(validRows)
  console.log(
    `   ✅ Duplicate fingerprints: ${duplicatesInFile.size > 0 ? duplicatesInFile.size : 'none'}`,
  )

  // Step 3: Check existing fingerprints
  console.log('\n3️⃣  Checking existing fingerprints in DB...')
  const fingerprints = validRows.map((r) => r.fingerprint)
  const existingFingerprints = await checkExistingFingerprints(fingerprints)
  console.log(
    `   ✅ Existing in DB: ${existingFingerprints.size > 0 ? existingFingerprints.size : 'none'}`,
  )

  // Step 4: Summary
  console.log('\n📈 SUMMARY')
  console.log('='.repeat(80))

  const toImport = validRows.filter((r) => !existingFingerprints.has(r.fingerprint) && !duplicatesInFile.has(r.fingerprint))
  const toSkipDuplicate = validRows.filter((r) => duplicatesInFile.has(r.fingerprint))
  const toSkipExists = validRows.filter((r) => existingFingerprints.has(r.fingerprint))

  console.log(`📥 Registros a importar: ${toImport.length}`)
  console.log(`🔄 Registros a actualizar (ya existen): ${toSkipExists.length}`)
  console.log(`⚠️  Registros duplicados en archivo: ${toSkipDuplicate.length}`)
  console.log(`❌ Registros sin observación: ${skipped.length}`)

  console.log('\n✅ DRY-RUN COMPLETADO (sin cambios en DB)')
  console.log('='.repeat(80) + '\n')

  // Show sample data
  if (toImport.length > 0) {
    console.log('📋 MUESTRA DE PRIMEROS 3 REGISTROS A IMPORTAR:\n')
    toImport.slice(0, 3).forEach((row) => {
      console.log(`Row ${row.sourceRow}:`)
      console.log(`  Observación: ${row.observation.substring(0, 80)}...`)
      console.log(`  Fingerprint: ${row.fingerprint}`)
      console.log()
    })
  }
}

async function main() {
  const xlsxPath = '/var/www/apps/uix/Pruebas Maria 2.0.xlsx'

  if (!fs.existsSync(xlsxPath)) {
    console.error(`❌ File not found: ${xlsxPath}`)
    process.exit(1)
  }

  try {
    await dryRun(xlsxPath)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

main()
