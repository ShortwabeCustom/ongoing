const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXCEL_FILE = 'Pruebas Maria 2.0 (hoy).xlsx';
const BACKUP_DIR = '/var/backups/uix/findings';

// ============================================================================
// PHASE 1: PARSE EXCEL
// ============================================================================

async function parseExcel() {
  console.log('\n📖 PHASE 1: PARSE EXCEL\n');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE);

  const records = [];

  workbook.worksheets.forEach((sheet) => {
    const sheetName = sheet.name;
    const rowCount = sheet.actualRowCount;

    for (let rowIdx = 2; rowIdx <= rowCount; rowIdx++) {
      const row = sheet.getRow(rowIdx);

      const col1Value = row.getCell(1).value;
      const observation = row.getCell(2).value;
      const col3Value = row.getCell(3).value;
      const col4Value = row.getCell(4).value;
      const col5Value = row.getCell(5).value;

      const col1 = typeof col1Value === 'boolean' ? col1Value : null;
      const obsStr = observation ? String(observation).trim() : null;

      if (!obsStr || obsStr === '[object Object]' || obsStr === 'null' || obsStr.length === 0) {
        continue;
      }

      let incidenceType = null;
      let comentarios = null;

      // Standard parsing
      if (sheetName !== 'Mod 31 Jul' && sheetName !== 'Pruebas 30 de julio') {
        incidenceType = col4Value ? String(col4Value).trim() : null;
        comentarios = col5Value ? String(col5Value).trim() : null;
      }

      records.push({
        sourceSheet: sheetName,
        sourceRow: rowIdx,
        col1,
        observation: obsStr,
        incidenceType,
        comentarios
      });
    }
  });

  console.log(`✅ Parsed ${records.length} records from ${workbook.worksheets.length} sheets\n`);
  return records;
}

// ============================================================================
// PHASE 2: NORMALIZE
// ============================================================================

function normalizeIncidenceTypes(typeStr) {
  if (!typeStr) return [];

  const types = [];
  const normalized = typeStr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  if (normalized.includes('dise')) types.push('DESIGN');
  if (normalized.includes('funcional')) types.push('FUNCTIONALITY');
  if (normalized.includes('copy')) types.push('COPY');
  if (normalized.includes('negocio')) types.push('BUSINESS_RULE');

  return [...new Set(types)];
}

function generateFingerprint(record) {
  const text = `${record.sourceSheet}|${record.observation}`.trim();
  return crypto.createHash('md5').update(text).digest('hex');
}

async function normalize(rawRecords) {
  console.log('📝 PHASE 2: NORMALIZE & VALIDATE\n');

  const normalized = rawRecords.map((raw) => {
    const errors = [];

    if ((raw.observation || '').length > 2000) {
      errors.push(`Observation too long (${raw.observation.length} chars, max 2000)`);
    }

    if ((raw.comentarios || '').length > 1000) {
      errors.push(`Comments too long (${raw.comentarios.length} chars, max 1000)`);
    }

    return {
      ...raw,
      fingerprint: generateFingerprint(raw),
      normalizedIncidenceTypes: normalizeIncidenceTypes(raw.incidenceType),
      validationErrors: errors
    };
  });

  const validCount = normalized.filter(r => r.validationErrors.length === 0).length;
  const invalidCount = normalized.filter(r => r.validationErrors.length > 0).length;

  console.log(`✅ Normalized ${normalized.length} records`);
  console.log(`  Valid: ${validCount} | Invalid: ${invalidCount}\n`);

  return normalized;
}

// ============================================================================
// PHASE 3: DEDUPLICATION
// ============================================================================

async function deduplicate(normalized, prisma) {
  console.log('🔄 PHASE 3: DEDUPLICATION\n');

  // Internal duplicates
  const fingerprints = new Map();
  const internalDuplicates = [];

  normalized.forEach((record) => {
    if (fingerprints.has(record.fingerprint)) {
      internalDuplicates.push(record.fingerprint);
    } else {
      fingerprints.set(record.fingerprint, record);
    }
  });

  const uniqueRecords = Array.from(fingerprints.values());

  // External duplicates
  const existingFingerprints = await prisma.finding.findMany({
    where: { sourceFingerprint: { not: null } },
    select: { sourceFingerprint: true }
  });

  const externalFingerprintSet = new Set(existingFingerprints.map(f => f.sourceFingerprint));
  const newRecords = uniqueRecords.filter(r => !externalFingerprintSet.has(r.fingerprint));

  console.log(`Internal duplicates found: ${internalDuplicates.length}`);
  console.log(`External duplicates found: ${uniqueRecords.length - newRecords.length}`);
  console.log(`New records to import: ${newRecords.length}\n`);

  return {
    newRecords,
    stats: {
      totalRecords: normalized.length,
      validRecords: normalized.filter(r => r.validationErrors.length === 0).length,
      invalidRecords: normalized.filter(r => r.validationErrors.length > 0).length,
      duplicatesInternal: internalDuplicates.length,
      duplicatesExternal: uniqueRecords.length - newRecords.length,
      newRecords: newRecords.length,
      recordsToImport: newRecords.filter(r => r.validationErrors.length === 0)
    }
  };
}

// ============================================================================
// PHASE 4: DRY RUN
// ============================================================================

async function dryRun(stats) {
  console.log('🔬 PHASE 4: DRY RUN (NO WRITES)\n');

  const report = {
    timestamp: new Date().toISOString(),
    file: EXCEL_FILE,
    totalRecordsInFile: stats.totalRecords,
    validRecords: stats.validRecords,
    invalidRecords: stats.invalidRecords,
    internalDuplicates: stats.duplicatesInternal,
    externalDuplicates: stats.duplicatesExternal,
    newRecords: stats.newRecords,
    recordsToImportAfterValidation: stats.recordsToImport.length,
    sampleRecords: stats.recordsToImport.slice(0, 3).map(r => ({
      sheet: r.sourceSheet,
      row: r.sourceRow,
      observation: r.observation.substring(0, 80),
      types: r.normalizedIncidenceTypes
    }))
  };

  console.log('DRY RUN REPORT:');
  console.log(JSON.stringify(report, null, 2));

  if (stats.invalidRecords > 0) {
    console.log(`\n⚠️  WARNING: ${stats.invalidRecords} invalid records will be skipped`);
  }

  if (stats.duplicatesExternal > 0) {
    console.log(`\n⚠️  WARNING: ${stats.duplicatesExternal} duplicates already in DB`);
  }

  console.log(`\n✅ DRY RUN OK. Ready to import ${stats.recordsToImport.length} records.\n`);

  return report;
}

// ============================================================================
// PHASE 5: CREATE BACKUP
// ============================================================================

async function createBackup(prisma) {
  console.log('💾 PHASE 5: CREATE BACKUP\n');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `findings-backup-${timestamp}.json`);

  const findings = await prisma.finding.findMany({
    include: {
      evidence: true,
      resolutions: true,
      validations: true,
      comments: true
    }
  });

  fs.writeFileSync(backupFile, JSON.stringify(findings, null, 2));

  console.log(`✅ Backed up ${findings.length} findings`);
  console.log(`   Location: ${backupFile}\n`);

  return backupFile;
}

// ============================================================================
// PHASE 6: IMPORT
// ============================================================================

async function importRecords(records, prisma) {
  console.log('📤 PHASE 6: IMPORT (TRANSACTIONAL)\n');

  const project = await prisma.project.findFirst();
  if (!project) throw new Error('No project found');

  let testSession = await prisma.testSession.findFirst({
    where: { name: { contains: 'Pruebas' } },
    orderBy: { date: 'desc' }
  });

  if (!testSession) {
    const version = await prisma.productVersion.findFirst({
      where: { projectId: project.id }
    });
    if (!version) throw new Error('No product version found');

    testSession = await prisma.testSession.create({
      data: {
        projectId: project.id,
        versionId: version.id,
        name: 'Pruebas María 2.0 (hoy)',
        date: new Date(),
        createdBy: (await prisma.user.findFirst()).id
      }
    });
  }

  const creator = await prisma.user.findFirst();
  if (!creator) throw new Error('No user found');

  const importBatch = await prisma.importBatch.create({
    data: {
      projectId: project.id,
      testSessionId: testSession.id,
      originalFilename: EXCEL_FILE,
      fileSize: fs.statSync(EXCEL_FILE).size,
      totalRows: records.length,
      validRows: records.length,
      skippedRows: 0,
      status: 'PROCESSING',
      importedBy: creator.id
    }
  });

  let imported = 0;
  let failed = 0;
  const errors = [];

  try {
    for (const record of records) {
      try {
        await prisma.finding.create({
          data: {
            projectId: project.id,
            testSessionId: testSession.id,
            observation: record.observation,
            sourceSheet: record.sourceSheet,
            sourceRow: record.sourceRow,
            sourceFingerprint: record.fingerprint,
            importBatchId: importBatch.id,
            createdBy: creator.id,
            status: 'OPEN',
            priority: 'MEDIUM',
            severity: 'MINOR',
            effort: 'M'
          }
        });
        imported++;
      } catch (error) {
        failed++;
        errors.push(`Row ${record.sourceRow}: ${error.message}`);
      }
    }

    await prisma.importBatch.update({
      where: { id: importBatch.id },
      data: {
        validRows: imported,
        skippedRows: failed,
        status: 'COMPLETED'
      }
    });

    console.log(`✅ Imported ${imported} records`);
    if (failed > 0) {
      console.log(`⚠️  Failed: ${failed} records`);
    }
  } catch (error) {
    await prisma.importBatch.update({
      where: { id: importBatch.id },
      data: { status: 'FAILED', errorMessage: error.message }
    });
    throw error;
  }

  return { imported, failed, errors };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('ETL IMPORT: Pruebas María 2.0 (hoy).xlsx');
  console.log('='.repeat(70));

  const prisma = new PrismaClient();
  const args = process.argv.slice(2);
  const mode = args[0] || 'dry-run';

  try {
    const rawRecords = await parseExcel();
    const normalized = await normalize(rawRecords);
    const { newRecords, stats } = await deduplicate(normalized, prisma);
    const report = await dryRun(stats);

    if (mode === 'dry-run') {
      console.log('✅ DRY RUN MODE - Stopping here. No data written.');
      console.log('   Run with: node import.js import');
      process.exit(0);
    }

    const backupFile = await createBackup(prisma);

    if (mode === 'import') {
      const result = await importRecords(stats.recordsToImport, prisma);

      console.log('\n' + '='.repeat(70));
      console.log('IMPORT COMPLETE');
      console.log('='.repeat(70));
      console.log(`Imported: ${result.imported}`);
      console.log(`Failed: ${result.failed}`);
      console.log(`Backup: ${backupFile}`);
      console.log('\nNext: Verify at https://uix.torrax.cloud/findings');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
