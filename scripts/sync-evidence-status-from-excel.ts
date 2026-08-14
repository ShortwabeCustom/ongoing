/**
 * SYNC EVIDENCE STATUS FROM EXCEL
 *
 * Lee el Excel y actualiza el status de hallazgos que tienen ✓ en evidencias
 * Hallazgos completados: OPEN → RESOLVED
 */

import * as ExcelJS from 'exceljs';
import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

interface ExcelRow {
  observation?: string;
  evidenceColumn?: string;
  hasCheckmark?: boolean;
  sourceRow?: number;
  sourceSheet?: string;
}

async function readExcelAndFindChecked(): Promise<ExcelRow[]> {
  const excelPath = path.join(__dirname, '..', 'Pruebas Maria 2.0 (hoy).xlsx');

  log(`📂 Reading Excel: ${excelPath}\n`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  const checkedRows: ExcelRow[] = [];

  // Iterate through all sheets
  workbook.eachSheet((worksheet) => {
    const sheetName = worksheet.name;
    log(`📋 Scanning sheet: ${sheetName}`);

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      // Get row data
      const rowData: ExcelRow = {
        sourceSheet: sheetName,
        sourceRow: rowNumber,
      };

      // Check each cell for checkmark or observation
      // Check Col 1 for boolean checkbox (true = completed)
      const checkCell = row.getCell(1);
      if (checkCell.value === true) {
        rowData.hasCheckmark = true;
      }

      // Get observation from Col 2 (usually the observation/comment)
      const obsCell = row.getCell(2);
      if (obsCell && obsCell.value && typeof obsCell.value === 'string') {
        rowData.observation = obsCell.value.substring(0, 100);
      }

      if (rowData.hasCheckmark) {
        checkedRows.push(rowData);
      }
    });

    log(`   ✓ Checked: ${checkedRows.filter(r => r.sourceSheet === sheetName).length}`);
  });

  return checkedRows;
}

async function updateFindingsStatus(checkedRows: ExcelRow[]) {
  log(`\n🔄 Updating finding status in database...\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const row of checkedRows) {
    try {
      // Find finding by sourceSheet + sourceRow
      const finding = await prisma.finding.findFirst({
        where: {
          sourceSheet: row.sourceSheet,
          sourceRow: row.sourceRow,
        },
        select: {
          id: true,
          observation: true,
          status: true,
        },
      });

      if (!finding) {
        notFound++;
        continue;
      }

      // Only update if currently OPEN
      if (finding.status === 'OPEN') {
        await prisma.finding.update({
          where: { id: finding.id },
          data: {
            status: 'VALIDATED', // Mark as validated when evidence is checked
          },
        });

        updated++;

        if (updated % 20 === 0) {
          log(`✅ Updated ${updated}...`);
        }
      }
    } catch (err) {
      errors++;
      log(`❌ Error processing row ${row.sourceRow}: ${err}`);
    }
  }

  return { updated, notFound, errors };
}

async function main() {
  log('🔍 SYNC EVIDENCE STATUS FROM EXCEL\n');

  try {
    // Read Excel and find rows with checkmarks
    const checkedRows = await readExcelAndFindChecked();

    log(`\n📊 Found ${checkedRows.length} rows with checkmarks\n`);

    if (checkedRows.length === 0) {
      log('⚠️  No completed items found in Excel');
      return;
    }

    // Show sample
    log('Sample of completed items:');
    checkedRows.slice(0, 5).forEach((row) => {
      log(`   - ${row.sourceSheet} Row ${row.sourceRow}: ${row.observation}`);
    });
    log('');

    // Update findings status in BD
    const result = await updateFindingsStatus(checkedRows);

    log(`\n📊 SUMMARY`);
    log(`✅ Status updated: ${result.updated}`);
    log(`⚠️  Not found in DB: ${result.notFound}`);
    log(`❌ Errors: ${result.errors}`);
    log(`\n✨ Hallazgos completados ahora tienen status: VALIDATED`);

  } catch (err) {
    log(`❌ Fatal error: ${err}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
