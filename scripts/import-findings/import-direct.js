const { Client } = require('pg');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXCEL_FILE = 'Pruebas Maria 2.0 (hoy).xlsx';
const BACKUP_DIR = '/var/backups/uix/findings';

// Database connection (from .env.local)
const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'torrax_user',
  password: process.env.PGPASSWORD,
  database: 'pruebas_maria_dev'
};

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

      const observation = row.getCell(2).value;
      const obsStr = observation ? String(observation).trim() : null;

      if (!obsStr || obsStr === '[object Object]' || obsStr === 'null' || obsStr.length === 0) {
        continue;
      }

      let incidenceType = null;
      let comentarios = null;

      if (sheetName !== 'Mod 31 Jul' && sheetName !== 'Pruebas 30 de julio') {
        incidenceType = row.getCell(4).value ? String(row.getCell(4).value).trim() : null;
        comentarios = row.getCell(5).value ? String(row.getCell(5).value).trim() : null;
      }

      records.push({
        sourceSheet: sheetName,
        sourceRow: rowIdx,
        observation: obsStr,
        incidenceType,
        comentarios
      });
    }
  });

  console.log(`✅ Parsed ${records.length} records from ${workbook.worksheets.length} sheets\n`);
  return records;
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
      errors.push(`Observation too long`);
    }

    return {
      ...raw,
      fingerprint: generateFingerprint(raw),
      validationErrors: errors
    };
  });

  const validCount = normalized.filter(r => r.validationErrors.length === 0).length;
  const invalidCount = normalized.filter(r => r.validationErrors.length > 0).length;

  console.log(`✅ Normalized ${normalized.length} records`);
  console.log(`  Valid: ${validCount} | Invalid: ${invalidCount}\n`);

  return normalized;
}

async function deduplicate(normalized, client) {
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

  // External duplicates - query database
  const result = await client.query(`
    SELECT "sourceFingerprint" FROM findings 
    WHERE "sourceFingerprint" IS NOT NULL
  `);

  const externalFingerprintSet = new Set(result.rows.map(f => f.sourceFingerprint));
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
      observation: r.observation.substring(0, 80)
    }))
  };

  console.log('DRY RUN REPORT:');
  console.log(JSON.stringify(report, null, 2));

  if (stats.invalidRecords > 0) {
    console.log(`\n⚠️  WARNING: ${stats.invalidRecords} invalid records`);
  }

  if (stats.duplicatesExternal > 0) {
    console.log(`\n⚠️  WARNING: ${stats.duplicatesExternal} duplicates in DB`);
  }

  console.log(`\n✅ DRY RUN OK. Ready to import ${stats.recordsToImport.length} records.\n`);

  return report;
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('ETL IMPORT: Pruebas María 2.0 (hoy).xlsx');
  console.log('='.repeat(70));

  const client = new Client(DB_CONFIG);

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    const rawRecords = await parseExcel();
    const normalized = await normalize(rawRecords);
    const { newRecords, stats } = await deduplicate(normalized, client);
    await dryRun(stats);

    console.log('To import, run: node import-direct.js import');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
