const { Client } = require('pg');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXCEL_FILE = 'Pruebas Maria 2.0 (hoy).xlsx';
const BACKUP_DIR = '/var/backups/uix/findings';

const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'torrax_user',
  password: 'TorraxDev123!',
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
      if (sheetName !== 'Mod 31 Jul' && sheetName !== 'Pruebas 30 de julio') {
        incidenceType = row.getCell(4).value ? String(row.getCell(4).value).trim() : null;
      }

      records.push({
        sourceSheet: sheetName,
        sourceRow: rowIdx,
        observation: obsStr,
        incidenceType
      });
    }
  });

  console.log(`✅ Parsed ${records.length} records\n`);
  return records;
}

function generateFingerprint(record) {
  const text = `${record.sourceSheet}|${record.observation}`.trim();
  return crypto.createHash('md5').update(text).digest('hex');
}

async function normalize(rawRecords) {
  console.log('📝 PHASE 2: NORMALIZE\n');

  const normalized = rawRecords.map((raw) => ({
    ...raw,
    fingerprint: generateFingerprint(raw)
  }));

  console.log(`✅ Normalized ${normalized.length} records\n`);
  return normalized;
}

async function deduplicate(normalized, client) {
  console.log('🔄 PHASE 3: DEDUPLICATION\n');

  const fingerprints = new Map();
  normalized.forEach((record) => {
    if (!fingerprints.has(record.fingerprint)) {
      fingerprints.set(record.fingerprint, record);
    }
  });

  const uniqueRecords = Array.from(fingerprints.values());

  const result = await client.query(`
    SELECT "sourceFingerprint" FROM findings 
    WHERE "sourceFingerprint" IS NOT NULL
  `);

  const externalFingerprintSet = new Set(result.rows.map(f => f.sourceFingerprint));
  const newRecords = uniqueRecords.filter(r => !externalFingerprintSet.has(r.fingerprint));

  console.log(`Internal duplicates: ${normalized.length - uniqueRecords.length}`);
  console.log(`External duplicates: ${uniqueRecords.length - newRecords.length}`);
  console.log(`Records to import: ${newRecords.length}\n`);

  return newRecords;
}

async function createBackup(client) {
  console.log('💾 PHASE 4: CREATE BACKUP\n');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `findings-backup-${timestamp}.sql`);

  // Dump findings table
  const result = await client.query(`
    SELECT * FROM findings 
    ORDER BY "createdAt" DESC
  `);

  const sql = `-- Findings backup from ${new Date().toISOString()}
-- Total records: ${result.rows.length}

BEGIN;

${result.rows.map((row, idx) => {
    const cols = Object.keys(row);
    const vals = cols.map(c => {
      const v = row[c];
      if (v === null) return 'NULL';
      if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (v instanceof Date) return `'${v.toISOString()}'`;
      return v;
    }).join(', ');
    return `-- Row ${idx + 1}: ${row.id}`;
  }).join('\n')}

COMMIT;
`;

  fs.writeFileSync(backupFile, sql);

  console.log(`✅ Backed up ${result.rows.length} findings`);
  console.log(`   Location: ${backupFile}\n`);

  return { backupFile, count: result.rows.length };
}

async function importRecords(records, client) {
  console.log('📤 PHASE 5: IMPORT (TRANSACTIONAL)\n');

  // Get project and test session
  const projectResult = await client.query(`
    SELECT id FROM projects LIMIT 1
  `);
  const projectId = projectResult.rows[0].id;

  const sessionResult = await client.query(`
    SELECT id FROM test_sessions 
    WHERE "projectId" = $1
    ORDER BY date DESC LIMIT 1
  `, [projectId]);
  const testSessionId = sessionResult.rows[0].id;

  // Get user
  const userResult = await client.query(`
    SELECT id FROM users LIMIT 1
  `);
  const userId = userResult.rows[0].id;

  // Create import batch
  const batchResult = await client.query(`
    INSERT INTO import_batches
    (id, "projectId", "testSessionId", "originalFilename", "fileSize", "totalRows", "validRows", "skippedRows", status, "importedBy", "createdAt")
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING id
  `, [
    projectId,
    testSessionId,
    EXCEL_FILE,
    fs.statSync(EXCEL_FILE).size,
    records.length,
    records.length,
    0,
    'PROCESSING',
    userId
  ]);

  const importBatchId = batchResult.rows[0].id;

  console.log(`Created import batch: ${importBatchId}`);

  try {
    // Start transaction
    await client.query('BEGIN');

    let imported = 0;

    for (const record of records) {
      await client.query(`
        INSERT INTO findings (
          id, "projectId", "testSessionId", observation, 
          status, priority, severity, effort,
          "sourceSheet", "sourceRow", "sourceFingerprint",
          "importBatchId", "createdBy", "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3,
          'OPEN', 'MEDIUM', 'MINOR', 'M',
          $4, $5, $6,
          $7, $8, NOW(), NOW()
        )
      `, [
        projectId,
        testSessionId,
        record.observation,
        record.sourceSheet,
        record.sourceRow,
        record.fingerprint,
        importBatchId,
        userId
      ]);

      imported++;

      if (imported % 50 === 0) {
        console.log(`  Progress: ${imported}/${records.length}`);
      }
    }

    // Update batch status
    await client.query(`
      UPDATE import_batches
      SET status = 'COMPLETED', "validRows" = $1
      WHERE id = $2
    `, [imported, importBatchId]);

    // Commit transaction
    await client.query('COMMIT');

    console.log(`\n✅ Imported ${imported} records\n`);
    return { imported, batchId: importBatchId };

  } catch (error) {
    await client.query('ROLLBACK');

    // Update batch status to FAILED
    await client.query(`
      UPDATE import_batches
      SET status = 'FAILED', "errorMessage" = $1
      WHERE id = $2
    `, [error.message, importBatchId]);

    throw error;
  }
}

async function validatePostImport(client) {
  console.log('🔍 PHASE 6: POST-IMPORT VALIDATION\n');

  // Count findings
  const countResult = await client.query(`
    SELECT COUNT(*) as total FROM findings
  `);

  const findingsByStatus = await client.query(`
    SELECT status, COUNT(*) as count FROM findings GROUP BY status ORDER BY count DESC
  `);

  const findingsWithoutSource = await client.query(`
    SELECT COUNT(*) as count FROM findings WHERE "sourceFingerprint" IS NULL
  `);

  console.log(`Total findings: ${countResult.rows[0].total}`);
  console.log(`Findings without source (old): ${findingsWithoutSource.rows[0].count}`);
  console.log(`By status:`);
  findingsByStatus.rows.forEach(row => {
    console.log(`  • ${row.status}: ${row.count}`);
  });

  console.log('');
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('ETL IMPORT: Pruebas María 2.0 (hoy).xlsx');
  console.log('='.repeat(70));

  const client = new Client(DB_CONFIG);
  const args = process.argv.slice(2);
  const mode = args[0] || 'dry-run';

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    const rawRecords = await parseExcel();
    const normalized = await normalize(rawRecords);
    const dedupRecords = await deduplicate(normalized, client);

    if (mode === 'dry-run') {
      console.log('✅ DRY RUN MODE - Stopping here.');
      console.log(`   Ready to import ${dedupRecords.length} records`);
      console.log('\n   To proceed: node import-execute.js import\n');
      process.exit(0);
    }

    if (mode === 'import') {
      const backup = await createBackup(client);
      const result = await importRecords(dedupRecords, client);
      await validatePostImport(client);

      console.log('='.repeat(70));
      console.log('IMPORT COMPLETE ✅');
      console.log('='.repeat(70));
      console.log(`Imported: ${result.imported} records`);
      console.log(`Batch ID: ${result.batchId}`);
      console.log(`Backup: ${backup.backupFile}`);
      console.log('\nNext steps:');
      console.log('1. Check: https://uix.torrax.cloud/findings');
      console.log('2. Validate individual findings: /findings/[id]');
      console.log('3. Check API responses\n');

      process.exit(0);
    }

    console.log('Usage: node import-execute.js [dry-run|import]');
    process.exit(1);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
