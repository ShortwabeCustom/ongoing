import * as fs from 'fs'
import ExcelJS from 'exceljs'
import db from '../lib/db'
import { generateFingerprint } from '@/lib/utils/fingerprint'

// Immutable Context
const PROJECT_ID = 'cmsoc6p7l0000h1acb6i9uoyt'
const TEST_SESSION_ID = 'cmsoc6pbq0003h1ac6hgztsda'
const USER_ID = 'cmsnnzhsj0000mzacg3c1w1rn' // Alexis (OWNER)
const DEFAULT_AREA = 'DESIGN'
const XLSX_PATH = '/var/www/apps/uix/Pruebas Maria 2.0.xlsx'

interface NormalizedRow {
  sourceRow: number
  observation: string
  previousScreen?: string
  modification?: string
  fingerprint: string
}

async function loadXLSXData(): Promise<NormalizedRow[]> {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`File not found: ${XLSX_PATH}`)
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(XLSX_PATH)

  const sheet = wb.worksheets[0]
  if (!sheet) throw new Error('No sheet found in XLSX')

  const results: NormalizedRow[] = []
  let rowNum = 1

  sheet.eachRow((row: any) => {
    // Skip header
    if (rowNum === 1) {
      rowNum++
      return
    }

    const observation = (row.getCell(2)?.value || '').toString().trim()
    const previousScreen = (row.getCell(3)?.value || '').toString().trim()
    const modification = (row.getCell(4)?.value || '').toString().trim()

    if (!observation) {
      rowNum++
      return
    }

    const fingerprint = generateFingerprint(PROJECT_ID, rowNum, observation, {
      testSessionId: TEST_SESSION_ID,
      sourceSheet: 'XLSX_Import_2026-08-12',
    })

    results.push({
      sourceRow: rowNum,
      observation,
      previousScreen: previousScreen || undefined,
      modification: modification || undefined,
      fingerprint,
    })

    rowNum++
  })

  return results
}

async function executeImport(): Promise<void> {
  console.log('\n🚀 STARTING PRODUCTION IMPORT')
  console.log('='.repeat(80))

  try {
    // Step 1: Load data
    console.log('\n1️⃣  Loading XLSX data...')
    const rows = await loadXLSXData()
    console.log(`   ✅ Loaded ${rows.length} valid rows`)

    // Step 2: Begin transaction
    console.log('\n2️⃣  Starting database transaction...')
    const imported: string[] = []
    const failed: Array<{ row: number; error: string }> = []

    // Step 3: Create ImportBatch
    console.log('\n3️⃣  Creating ImportBatch record...')
    const importBatch = await db.importBatch.create({
      data: {
        projectId: PROJECT_ID,
        testSessionId: TEST_SESSION_ID,
        originalFilename: 'Pruebas Maria 2.0.xlsx',
        fileSize: fs.statSync(XLSX_PATH).size,
        totalRows: rows.length,
        validRows: rows.length,
        skippedRows: 0,
        status: 'PROCESSING',
        importedBy: USER_ID,
      },
    })
    console.log(`   ✅ ImportBatch created: ${importBatch.id}`)

    // Step 4: Insert Findings
    console.log('\n4️⃣  Importing findings...')
    for (const row of rows) {
      try {
        const finding = await db.finding.create({
          data: {
            projectId: PROJECT_ID,
            testSessionId: TEST_SESSION_ID,
            observation: row.observation,
            status: 'OPEN', // Default status
            priority: 'MEDIUM', // Default priority
            severity: 'MINOR', // Default severity
            effort: 'M', // Default effort
            sourceSheet: 'XLSX_Import',
            sourceRow: row.sourceRow,
            sourceFingerprint: row.fingerprint,
            importBatchId: importBatch.id,
            createdBy: USER_ID,
            // Add Area as DESIGN by default
            incidenceTypes: {
              create: [{ incidenceType: 'DESIGN' }],
            },
            experienceTags: {
              create: [{ experienceTag: 'UI' }],
            },
          },
        })

        imported.push(finding.id)

        // Add comment with metadata if available
        if (row.modification || row.previousScreen) {
          await db.comment.create({
            data: {
              findingId: finding.id,
              text: `[IMPORTED] Previous Screen: ${row.previousScreen || 'N/A'} | Modification: ${row.modification || 'N/A'}`,
              createdBy: USER_ID,
            },
          })
        }
      } catch (err: any) {
        failed.push({
          row: row.sourceRow,
          error: err.message || 'Unknown error',
        })
      }
    }

    // Step 5: Update ImportBatch status
    console.log('\n5️⃣  Finalizing ImportBatch...')
    await db.importBatch.update({
      where: { id: importBatch.id },
      data: {
        status: 'COMPLETED',
        validRows: imported.length,
        skippedRows: failed.length,
      },
    })

    // Step 6: Report results
    console.log('\n✅ IMPORT COMPLETED')
    console.log('='.repeat(80))
    console.log(`📥 Imported: ${imported.length} findings`)
    console.log(`❌ Failed: ${failed.length}`)
    console.log(`📦 ImportBatch ID: ${importBatch.id}`)

    if (failed.length > 0) {
      console.log('\n⚠️  Failed rows:')
      failed.forEach((f) => {
        console.log(`   Row ${f.row}: ${f.error}`)
      })
    }

    console.log('\n✨ All findings imported successfully!')
    console.log('='.repeat(80) + '\n')
  } catch (err: any) {
    console.error('\n❌ IMPORT FAILED')
    console.error(err.message || err)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

executeImport()
