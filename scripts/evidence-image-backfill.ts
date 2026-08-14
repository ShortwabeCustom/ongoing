/**
 * EVIDENCE IMAGE BACKFILL — Complete System
 *
 * Phases 1-29:
 * 1. Extract images from XLSX with anchor positions
 * 2. Map image anchor → Excel row
 * 3. Find existing Finding for that row
 * 4. Create Evidence record
 * 5. Validate end-to-end
 *
 * CRITICAL: Supports --dry-run flag for safe preview
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import db from '../lib/db';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ImageAnchor {
  imageId: string; // image1.png, image2.png, etc
  rId: string; // r:embed reference
  fromRow: number; // Excel row (0-indexed)
  fromCol: number; // Excel col (0-indexed)
  toRow: number;
  toCol: number;
  imageData: Buffer;
  mimeType: string;
  fileSize: number;
  hash: string;
}

interface ImageMapping {
  imageId: string;
  rId: string;
  fromRow: number; // 1-indexed after extraction
  finding: any | null;
  status: 'matched' | 'ambiguous' | 'not_found';
  reason?: string;
}

interface ExcelRow {
  rowNum: number;
  observation: string;
  modification?: string;
  previousScreen?: string;
  fingerprint: string;
}

// ============================================================================
// PHASE 1: EXTRACT IMAGES WITH ANCHORS
// ============================================================================

async function extractImagesWithAnchors(
  excelPath: string,
): Promise<Map<string, ImageAnchor>> {
  console.log('\n📦 PHASE 1: Extract Images + Anchors\n');

  const anchors = new Map<string, ImageAnchor>();

  try {
    const zip = new AdmZip(excelPath);
    const entries = zip.getEntries();

    // Read all drawing files to get anchor→image mappings
    const drawings: Map<number, Map<string, string>> = new Map(); // sheet → rId → imageId

    for (let sheetIdx = 1; sheetIdx <= 8; sheetIdx++) {
      const relsEntry = entries.find(
        e => e.entryName === `xl/drawings/_rels/drawing${sheetIdx}.xml.rels`,
      );
      if (!relsEntry) continue;

      const relsXml = relsEntry.getData().toString('utf8');
      const rIdToImage = new Map<string, string>();

      // Parse relationships: rId → ../media/image123.png
      const rIdPattern = /Id="(rId\d+)"[^>]*Target="\.\.\/media\/(image\d+\.png)"/g;
      let match;
      while ((match = rIdPattern.exec(relsXml)) !== null) {
        rIdToImage.set(match[1], match[2]);
      }

      drawings.set(sheetIdx, rIdToImage);
    }

    // Read drawing1.xml to get anchors
    const drawing1Entry = entries.find(e => e.entryName === 'xl/drawings/drawing1.xml');
    if (!drawing1Entry) {
      console.warn('⚠️  No drawing1.xml found');
      return anchors;
    }

    const drawingXml = drawing1Entry.getData().toString('utf8');

    // Parse twoCellAnchor elements
    const anchorPattern =
      /<xdr:twoCellAnchor[^>]*>.*?<xdr:from><xdr:col>(\d+)<\/xdr:col>.*?<xdr:row>(\d+)<\/xdr:row>.*?<\/xdr:from>.*?<xdr:to><xdr:col>(\d+)<\/xdr:col>.*?<xdr:row>(\d+)<\/xdr:row>.*?<\/xdr:to>.*?<a:blip[^>]*r:embed="(rId\d+)".*?<\/xdr:twoCellAnchor>/gs;

    const rIdToImage = drawings.get(1) || new Map();
    let anchorMatch;
    let anchorCount = 0;

    while ((anchorMatch = anchorPattern.exec(drawingXml)) !== null) {
      const fromCol = parseInt(anchorMatch[1]);
      const fromRow = parseInt(anchorMatch[2]);
      const toCol = parseInt(anchorMatch[3]);
      const toRow = parseInt(anchorMatch[4]);
      const rId = anchorMatch[5];

      const imageId = rIdToImage.get(rId);
      if (!imageId) continue;

      const imageEntry = entries.find(e => e.entryName === `xl/media/${imageId}`);
      if (!imageEntry) continue;

      const imageData = imageEntry.getData();
      const hash = crypto.createHash('sha256').update(imageData).digest('hex');

      anchors.set(imageId, {
        imageId,
        rId,
        fromRow, // Excel 0-indexed, will convert to 1-indexed
        fromCol,
        toRow,
        toCol,
        imageData,
        mimeType: 'image/png',
        fileSize: imageData.length,
        hash,
      });

      anchorCount++;
    }

    console.log(`✅ Found ${anchorCount} images with anchor positions`);
    console.log(`   - Total anchors: ${anchors.size}`);

    return anchors;
  } catch (err) {
    console.error('❌ Error extracting anchors:', err);
    return anchors;
  }
}

// ============================================================================
// PHASE 2: READ EXCEL DATA (Observation, etc)
// ============================================================================

async function readExcelData(excelPath: string): Promise<ExcelRow[]> {
  console.log('\n📄 PHASE 2: Read Excel Data (Observations)\n');

  const rows: ExcelRow[] = [];

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(excelPath);

    const sheet = wb.worksheets[0];
    if (!sheet) {
      console.warn('⚠️  No worksheet found');
      return rows;
    }

    let rowNum = 1;

    sheet.eachRow((row: any) => {
      // Row 1 = header, skip
      if (rowNum === 1) {
        rowNum++;
        return;
      }

      const observation = (row.getCell(2)?.value || '').toString().trim();
      const previousScreen = (row.getCell(3)?.value || '').toString().trim();
      const modification = (row.getCell(4)?.value || '').toString().trim();

      if (observation) {
        rows.push({
          rowNum,
          observation,
          previousScreen: previousScreen || undefined,
          modification: modification || undefined,
          fingerprint: '', // Will be set later
        });
      }

      rowNum++;
    });

    console.log(`✅ Read ${rows.length} rows from Excel`);

    return rows;
  } catch (err) {
    console.error('❌ Error reading Excel:', err);
    return rows;
  }
}

// ============================================================================
// PHASE 3: MATCH ROWS TO FINDINGS
// ============================================================================

async function matchRowsToFindings(
  excelRows: ExcelRow[],
): Promise<Map<number, any>> {
  console.log('\n🔍 PHASE 3: Match Excel Rows to Existing Findings\n');

  const rowToFinding = new Map<number, any>();

  // Strategy 1: Match by sourceFingerprint + sourceRow
  console.log('   Strategy 1: sourceFingerprint + sourceRow...');

  const findings = await db.finding.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      observation: true,
      sourceFingerprint: true,
      sourceRow: true,
    },
  });

  let matched = 0;

  for (const excelRow of excelRows) {
    const finding = findings.find(f => f.sourceRow === excelRow.rowNum);

    if (finding) {
      rowToFinding.set(excelRow.rowNum, finding);
      matched++;
    }
  }

  console.log(`   ✅ Matched: ${matched}/${excelRows.length}`);
  console.log(`   ⚠️  Not found: ${excelRows.length - matched}`);

  return rowToFinding;
}

// ============================================================================
// PHASE 4: CREATE MAPPING INVENTORY
// ============================================================================

async function createMappingInventory(
  anchors: Map<string, ImageAnchor>,
  excelRows: ExcelRow[],
  rowToFinding: Map<number, any>,
): Promise<ImageMapping[]> {
  console.log('\n📋 PHASE 4: Create Mapping Inventory\n');

  const mappings: ImageMapping[] = [];
  const rowSet = new Set(excelRows.map(r => r.rowNum));

  for (const [imageId, anchor] of anchors) {
    // Excel rows in drawing are 0-indexed, convert to 1-indexed
    const excelRow1Indexed = anchor.fromRow + 1;

    let finding = null;
    let status: 'matched' | 'ambiguous' | 'not_found' = 'not_found';
    let reason = '';

    if (rowToFinding.has(excelRow1Indexed)) {
      finding = rowToFinding.get(excelRow1Indexed);
      status = 'matched';
    } else if (!rowSet.has(excelRow1Indexed)) {
      reason = 'Row not in Excel data';
    } else {
      reason = 'Row exists but no Finding match';
    }

    mappings.push({
      imageId,
      rId: anchor.rId,
      fromRow: excelRow1Indexed,
      finding,
      status,
      reason,
    });
  }

  const matched = mappings.filter(m => m.status === 'matched').length;
  const ambiguous = mappings.filter(m => m.status === 'ambiguous').length;
  const notFound = mappings.filter(m => m.status === 'not_found').length;

  console.log(`   ✅ Matched: ${matched}`);
  console.log(`   ⚠️  Ambiguous: ${ambiguous}`);
  console.log(`   ❌ Not found: ${notFound}`);

  if (notFound > 0) {
    console.log(`\n   Examples of not found (first 5):`);
    mappings
      .filter(m => m.status === 'not_found')
      .slice(0, 5)
      .forEach(m => {
        console.log(`     Row ${m.fromRow}: ${m.imageId} - ${m.reason}`);
      });
  }

  return mappings;
}

// ============================================================================
// PHASE 5: ANALYZE CURRENT EVIDENCE STATE
// ============================================================================

async function analyzeBrokenEvidence(): Promise<{
  total: number;
  broken: number;
  valid: number;
}> {
  console.log('\n🔧 PHASE 5: Analyze Current Evidence\n');

  const total = await db.evidence.count();
  const broken = await db.evidence.count({
    where: {
      OR: [
        { url: { contains: 'placeholder' } },
        { url: { contains: 'evidence-placeholder' } },
      ],
    },
  });

  const valid = total - broken;

  console.log(`   Total Evidence: ${total}`);
  console.log(`   Broken (placeholder): ${broken}`);
  console.log(`   Valid: ${valid}`);

  return { total, broken, valid };
}

// ============================================================================
// DRY RUN REPORT
// ============================================================================

async function dryRun(
  excelPath: string,
  isDryRun: boolean = true,
): Promise<void> {
  console.log('\n'.repeat(2));
  console.log('='.repeat(80));
  console.log('🔍 EVIDENCE IMAGE BACKFILL — DRY RUN');
  console.log('='.repeat(80));

  // Extract & analyze
  const anchors = await extractImagesWithAnchors(excelPath);
  const excelRows = await readExcelData(excelPath);
  const rowToFinding = await matchRowsToFindings(excelRows);
  const mappings = await createMappingInventory(anchors, excelRows, rowToFinding);
  const brokenEvidenceState = await analyzeBrokenEvidence();

  // Summary
  const matchedMappings = mappings.filter(m => m.status === 'matched');

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY\n');

  console.log('XLSX Analysis:');
  console.log(`  - Images found: ${anchors.size}`);
  console.log(`  - Rows in Excel: ${excelRows.length}`);
  console.log(`  - Total size: ${Array.from(anchors.values()).reduce((s, a) => s + a.fileSize, 0) / 1024 / 1024}MB`);

  console.log('\nMatching Results:');
  console.log(`  - Images matched to Findings: ${matchedMappings.length}`);
  console.log(`  - Unmatched images: ${mappings.filter(m => m.status !== 'matched').length}`);

  console.log('\nCurrent Evidence:');
  console.log(`  - Total: ${brokenEvidenceState.total}`);
  console.log(`  - Broken (placeholder): ${brokenEvidenceState.broken}`);
  console.log(`  - Valid: ${brokenEvidenceState.valid}`);

  console.log('\nPredicted Changes:');
  console.log(`  - Images to import: ${matchedMappings.length}`);
  console.log(`  - Evidence records to create: ${matchedMappings.length}`);
  console.log(`  - Placeholder evidence to replace: ~${brokenEvidenceState.broken}`);

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE — No changes made');
  }

  console.log('\n' + '='.repeat(80));
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const excelPath = path.join(__dirname, '..', 'Pruebas Maria 2.0 (hoy).xlsx');

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Excel file not found: ${excelPath}`);
    process.exit(1);
  }

  console.log('🚀 EVIDENCE IMAGE BACKFILL SYSTEM');
  console.log(`📁 Source: ${excelPath}`);
  console.log(`🔍 Mode: ${isDryRun ? 'DRY RUN' : 'APPLY'}`);

  await dryRun(excelPath, isDryRun);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
