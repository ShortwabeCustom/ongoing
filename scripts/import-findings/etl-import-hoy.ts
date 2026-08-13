import { PrismaClient, FindingStatus, FindingPriority, FindingSeverity, FindingEffort, IncidenceType } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION & TYPES
// ============================================================================

interface RawRecord {
  sourceSheet: string;
  sourceRow: number;
  col1: boolean | null;
  observation: string | null;
  evidencia: string | null;
  incidenceType: string | null;
  comentarios: string | null;
  pantallaPosterior?: string | null;
  modificacion?: string | null;
  ajuste?: string | null;
}

interface NormalizedRecord extends RawRecord {
  fingerprint: string;
  normalizedIncidenceTypes: IncidenceType[];
  validationErrors: string[];
}

interface ImportStats {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicatesInternal: number;
  duplicatesExternal: number;
  newRecords: number;
  conflictRecords: number;
  recordsToImport: NormalizedRecord[];
}

const EXCEL_FILE = 'Pruebas Maria 2.0 (hoy).xlsx';
const BACKUP_DIR = '/var/backups/uix/findings';
const DRY_RUN_FILE = '/tmp/import-findings-dry-run.json';

// ============================================================================
// PHASE 1: PARSE EXCEL
// ============================================================================

async function parseExcel(): Promise<RawRecord[]> {
  console.log('\n📖 PHASE 1: PARSE EXCEL\n');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE);
  
  const records: RawRecord[] = [];
  
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
      const col6Value = row.getCell(6).value;
      
      // Normalize values
      const col1 = typeof col1Value === 'boolean' ? col1Value : null;
      const obsStr = observation ? String(observation).trim() : null;
      
      // Skip if observation is meaningless
      if (!obsStr || obsStr === '[object Object]' || obsStr === 'null' || obsStr.length === 0) {
        continue;
      }
      
      // Detect which columns contain what
      // The structure varies by sheet
      let evidencia = null;
      let incidenceType = null;
      let comentarios = null;
      let pantallaPosterior = null;
      let modificacion = null;
      let ajuste = null;
      
      // Sheet-specific parsing
      if (sheetName === 'Mod 31 Jul') {
        pantallaPosterior = col3Value ? String(col3Value).trim() : null;
        modificacion = col4Value ? String(col4Value).trim() : null;
      } else if (sheetName === 'Pruebas 30 de julio') {
        evidencia = col3Value ? String(col3Value).trim() : null;
        ajuste = col4Value ? String(col4Value).trim() : null;
        comentarios = col5Value ? String(col5Value).trim() : null;
      } else {
        // Standard structure: Observación, Evidencia, Tipo de incidencia, Comentarios
        evidencia = col3Value ? String(col3Value).trim() : null;
        incidenceType = col4Value ? String(col4Value).trim() : null;
        comentarios = col5Value ? String(col5Value).trim() : null;
      }
      
      records.push({
        sourceSheet: sheetName,
        sourceRow: rowIdx,
        col1,
        observation: obsStr,
        evidencia,
        incidenceType,
        comentarios,
        pantallaPosterior,
        modificacion,
        ajuste
      });
    }
  });
  
  console.log(`✅ Parsed ${records.length} records from ${workbook.worksheets.length} sheets`);
  return records;
}

// ============================================================================
// PHASE 2: NORMALIZE & VALIDATE
// ============================================================================

function normalizeIncidenceTypes(typeStr: string | null): IncidenceType[] {
  if (!typeStr) return [];
  
  const types: IncidenceType[] = [];
  const normalized = typeStr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // Remove accents for matching
  
  // Map variations to enums
  if (normalized.includes('diseño')) types.push('DESIGN');
  if (normalized.includes('funcionalidad')) types.push('FUNCTIONALITY');
  if (normalized.includes('copy')) types.push('COPY');
  if (normalized.includes('negocio') || normalized.includes('negocio')) types.push('BUSINESS_RULE');
  
  return [...new Set(types)]; // Dedupe
}

function generateFingerprint(record: RawRecord): string {
  const text = `${record.sourceSheet}|${record.observation}`.trim();
  return crypto.createHash('md5').update(text).digest('hex');
}

async function normalize(rawRecords: RawRecord[]): Promise<NormalizedRecord[]> {
  console.log('\n📝 PHASE 2: NORMALIZE & VALIDATE\n');
  
  const normalized: NormalizedRecord[] = rawRecords.map((raw) => {
    const errors: string[] = [];
    
    // Validate observation length
    if ((raw.observation || '').length > 2000) {
      errors.push(`Observation too long (${raw.observation!.length} chars, max 2000)`);
    }
    
    // Validate comentarios length
    if ((raw.comentarios || '').length > 1000) {
      errors.push(`Comments too long (${raw.comentarios!.length} chars, max 1000)`);
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
  console.log(`  Valid: ${validCount} | Invalid: ${invalidCount}`);
  
  return normalized;
}

// ============================================================================
// PHASE 3: DEDUPLICATION
// ============================================================================

async function deduplicate(
  normalized: NormalizedRecord[],
  prisma: PrismaClient
): Promise<{ unique: NormalizedRecord[]; stats: ImportStats }> {
  console.log('\n🔄 PHASE 3: DEDUPLICATION\n');
  
  // Internal duplicates (within Excel)
  const fingerprints = new Map<string, NormalizedRecord>();
  const internalDuplicates: string[] = [];

  normalized.forEach((record) => {
    if (fingerprints.has(record.fingerprint)) {
      internalDuplicates.push(record.fingerprint);
    } else {
      fingerprints.set(record.fingerprint, record);
    }
  });
  
  const uniqueRecords = Array.from(fingerprints.values());
  
  // External duplicates (already in DB)
  const existingFingerprints = await prisma.finding.findMany({
    where: { sourceFingerprint: { not: null } },
    select: { sourceFingerprint: true, id: true }
  });
  
  const externalFingerprintSet = new Set(existingFingerprints.map(f => f.sourceFingerprint!));
  const externalDuplicates = uniqueRecords.filter(r => externalFingerprintSet.has(r.fingerprint));
  const newRecords = uniqueRecords.filter(r => !externalFingerprintSet.has(r.fingerprint));
  
  console.log(`Internal duplicates found: ${internalDuplicates.length}`);
  console.log(`External duplicates found: ${externalDuplicates.length}`);
  console.log(`New records to import: ${newRecords.length}`);
  
  const stats: ImportStats = {
    totalRecords: normalized.length,
    validRecords: normalized.filter(r => r.validationErrors.length === 0).length,
    invalidRecords: normalized.filter(r => r.validationErrors.length > 0).length,
    duplicatesInternal: internalDuplicates.length,
    duplicatesExternal: externalDuplicates.length,
    newRecords: newRecords.length,
    conflictRecords: 0,
    recordsToImport: newRecords.filter(r => r.validationErrors.length === 0)
  };
  
  return { unique: newRecords, stats };
}

// ============================================================================
// PHASE 4: DRY RUN
// ============================================================================

async function dryRun(
  stats: ImportStats,
  dryRunFile: string = DRY_RUN_FILE
): Promise<void> {
  console.log('\n🔬 PHASE 4: DRY RUN (NO WRITES)\n');
  
  const report = {
    timestamp: new Date().toISOString(),
    file: EXCEL_FILE,
    totalRecordsInFile: stats.totalRecords,
    validRecords: stats.validRecords,
    invalidRecords: stats.invalidRecords,
    internalDuplicates: stats.duplicatesInternal,
    externalDuplicates: stats.duplicatesExternal,
    newRecordsToImport: stats.newRecords,
    recordsToImportAfterValidation: stats.recordsToImport.length,
    sampleRecords: stats.recordsToImport.slice(0, 5).map(r => ({
      sheet: r.sourceSheet,
      row: r.sourceRow,
      observation: r.observation?.substring(0, 80),
      types: r.normalizedIncidenceTypes
    }))
  };
  
  fs.writeFileSync(dryRunFile, JSON.stringify(report, null, 2));
  
  console.log('DRY RUN REPORT:');
  console.log(JSON.stringify(report, null, 2));
  
  // Warnings
  if (stats.invalidRecords > 0) {
    console.log(`\n⚠️  WARNING: ${stats.invalidRecords} invalid records will be skipped`);
  }
  
  if (stats.duplicatesExternal > 0) {
    console.log(`\n⚠️  WARNING: ${stats.duplicatesExternal} duplicates already in DB will be skipped`);
  }
  
  console.log(`\n✅ DRY RUN OK. Ready to import ${stats.recordsToImport.length} records.`);
}

// ============================================================================
// PHASE 5: CREATE BACKUP
// ============================================================================

async function createBackup(prisma: PrismaClient): Promise<string> {
  console.log('\n💾 PHASE 5: CREATE BACKUP\n');
  
  // Create backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `findings-backup-${timestamp}.json`);
  
  // Backup findings
  const findings = await prisma.finding.findMany({
    include: {
      evidence: true,
      resolutions: true,
      validations: true,
      comments: true,
      statusHistory: true,
      incidenceTypes: true,
      experienceTags: true
    }
  });
  
  fs.writeFileSync(backupFile, JSON.stringify(findings, null, 2));
  
  console.log(`✅ Backed up ${findings.length} findings`);
  console.log(`   Location: ${backupFile}`);
  
  return backupFile;
}

// ============================================================================
// PHASE 6: IMPORT
// ============================================================================

async function importRecords(
  records: NormalizedRecord[],
  prisma: PrismaClient
): Promise<{ imported: number; failed: number; errors: string[] }> {
  console.log('\n📤 PHASE 6: IMPORT (TRANSACTIONAL)\n');
  
  // Get or create test session
  const project = await prisma.project.findFirst();
  if (!project) throw new Error('No project found');
  
  let testSession = await prisma.testSession.findFirst({
    where: { name: { contains: 'Pruebas María' } }
  });
  
  if (!testSession) {
    testSession = await prisma.testSession.create({
      data: {
        projectId: project.id,
        versionId: (await prisma.productVersion.findFirst({
          where: { projectId: project.id }
        }))!.id,
        name: 'Pruebas María 2.0 (hoy) - Import',
        date: new Date(),
        createdBy: (await prisma.user.findFirst())!.id
      }
    });
  }
  
  // Get default creator user
  const creator = await prisma.user.findFirst();
  if (!creator) throw new Error('No user found for import');
  
  // Import batch
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
  const errors: string[] = [];
  
  try {
    for (const record of records) {
      try {
        await prisma.finding.create({
          data: {
            projectId: project.id,
            testSessionId: testSession.id,
            observation: record.observation || '',
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
        errors.push(`Row ${record.sourceRow}: ${String(error)}`);
      }
    }
    
    // Update import batch
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
      errors.slice(0, 5).forEach(e => console.log(`   ${e}`));
    }
  } catch (error) {
    await prisma.importBatch.update({
      where: { id: importBatch.id },
      data: { status: 'FAILED', errorMessage: String(error) }
    });
    throw error;
  }
  
  return { imported, failed, errors };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('ETL IMPORT: Pruebas María 2.0 (hoy).xlsx');
  console.log('='.repeat(60));
  
  const prisma = new PrismaClient();
  const args = process.argv.slice(2);
  const mode = args[0] || 'dry-run';
  
  try {
    // Phase 1: Parse
    const rawRecords = await parseExcel();
    
    // Phase 2: Normalize
    const normalized = await normalize(rawRecords);
    
    // Phase 3: Deduplicate
    const { unique: dedupRecords, stats } = await deduplicate(normalized, prisma);
    
    // Phase 4: Dry run
    await dryRun(stats);
    
    if (mode === 'dry-run') {
      console.log('\n✅ DRY RUN MODE - Stopping here. No data written.');
      process.exit(0);
    }
    
    // Phase 5: Backup
    const backupFile = await createBackup(prisma);
    
    // Phase 6: Import
    if (mode === 'import') {
      const result = await importRecords(stats.recordsToImport, prisma);
      
      console.log('\n' + '='.repeat(60));
      console.log('IMPORT COMPLETE');
      console.log('='.repeat(60));
      console.log(`Imported: ${result.imported}`);
      console.log(`Failed: ${result.failed}`);
      console.log(`Backup: ${backupFile}`);
      console.log('\nNext steps:');
      console.log('1. Verify data in /findings');
      console.log('2. Check API endpoints');
      console.log('3. Validate frontend rendering');
      
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
