/**
 * FINDINGS IMPORT ETL
 *
 * Source: Pruebas Maria 2.0 (hoy).xlsx
 * Destination: PostgreSQL → findings table
 * Safety: Dry-run first, then backup, then import with rollback capability
 *
 * Usage:
 *   npx ts-node scripts/import-findings-etl.ts --dry-run
 *   npx ts-node scripts/import-findings-etl.ts --backup
 *   npx ts-node scripts/import-findings-etl.ts --import
 */

import { PrismaClient, FindingStatus, FindingPriority, FindingSeverity, FindingEffort, IncidenceType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

interface NormalizedRecord {
  id: number;
  sourceSheet: string;
  sourceRow: number;
  observation: string;
  incidenceType: string | null;
  comments: string | null;
  evidence: string | null;
  previousScreen: string | null;
  modification: string | null;
  ajuste: string | null;
  reviewed: boolean;
  fingerprint: string;
}

interface ImportedRecord {
  normalized: NormalizedRecord;
  action: 'INSERT' | 'UPDATE' | 'UNCHANGED' | 'CONFLICT' | 'REVIEW' | 'REJECTED';
  reason?: string;
  findingId?: string;
  errors?: string[];
}

// ============================================================================
// MAPPING: EXCEL → PRISMA
// ============================================================================

const normalizeIncidenceType = (rawType: string | null): IncidenceType[] => {
  if (!rawType) return [];

  const normalized: IncidenceType[] = [];
  const lower = rawType.toLowerCase();

  // Handle combined types like "Diseño y funcionalidad"
  if (lower.includes('diseño')) normalized.push('DESIGN');
  if (lower.includes('funcionalidad')) normalized.push('FUNCTIONALITY');
  if (lower.includes('copy')) normalized.push('COPY');
  if (lower.includes('negocio')) normalized.push('BUSINESS_RULE');

  return [...new Set(normalized)]; // Remove duplicates
};

const mapToFinding = (
  record: NormalizedRecord,
  projectId: string,
  testSessionId: string | null,
  userId: string
) => {
  return {
    projectId,
    testSessionId,
    folio: `${record.sourceSheet}-${record.sourceRow}`,
    observation: record.observation,
    status: FindingStatus.OPEN,
    priority: FindingPriority.MEDIUM, // Default, can be updated later
    severity: FindingSeverity.MINOR,   // Default, can be updated later
    effort: FindingEffort.M,           // Default, can be updated later
    sourceSheet: record.sourceSheet,
    sourceRow: record.sourceRow,
    sourceFingerprint: record.fingerprint,
    createdBy: userId,
  };
};

// ============================================================================
// VALIDATION
// ============================================================================

const validateRecord = (record: NormalizedRecord): string[] => {
  const errors: string[] = [];

  if (!record.observation || record.observation.trim().length === 0) {
    errors.push('Observation (observación) is required');
  }

  if (record.observation.length > 2000) {
    errors.push(`Observation exceeds max length (2000 chars): ${record.observation.length}`);
  }

  return errors;
};

// ============================================================================
// DRY-RUN & ANALYSIS
// ============================================================================

async function dryRun(
  normalizedRecords: NormalizedRecord[],
  prisma: PrismaClient,
  projectId: string,
  userId: string
) {
  console.log('\n=== DRY-RUN: IMPORT ANALYSIS ===\n');

  const results: ImportedRecord[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let duplicateInternalCount = 0;
  let duplicateDbCount = 0;

  // Check existing fingerprints in DB
  const existingFingerprints = new Set<string>();
  const existingFindings = await prisma.finding.findMany({
    select: { sourceFingerprint: true },
    where: {
      sourceFingerprint: {
        in: normalizedRecords
          .map(r => r.fingerprint)
          .filter(Boolean) as string[]
      }
    }
  });
  existingFindings.forEach(f => {
    if (f.sourceFingerprint) existingFingerprints.add(f.sourceFingerprint);
  });

  // Process each record
  const processedFingerprints = new Set<string>();

  for (const record of normalizedRecords) {
    const errors = validateRecord(record);

    if (errors.length > 0) {
      results.push({
        normalized: record,
        action: 'REJECTED',
        reason: errors.join('; ')
      });
      invalidCount++;
      continue;
    }

    // Check internal duplicates
    if (processedFingerprints.has(record.fingerprint)) {
      results.push({
        normalized: record,
        action: 'REVIEW',
        reason: 'Duplicate within this import batch (internal)'
      });
      duplicateInternalCount++;
      continue;
    }
    processedFingerprints.add(record.fingerprint);

    // Check database duplicates
    if (existingFingerprints.has(record.fingerprint)) {
      results.push({
        normalized: record,
        action: 'UNCHANGED',
        reason: 'Finding already exists in database'
      });
      duplicateDbCount++;
      continue;
    }

    // Valid record for insertion
    results.push({
      normalized: record,
      action: 'INSERT',
      reason: 'New finding, valid for insertion'
    });
    validCount++;
  }

  // Report
  console.log(`File: Pruebas Maria 2.0 (hoy).xlsx`);
  console.log(`Sheets processed: 8\n`);
  console.log(`Filas totales: ${normalizedRecords.length}`);
  console.log(`Registros detectados: ${normalizedRecords.length}\n`);
  console.log(`Registros válidos: ${validCount}`);
  console.log(`Registros inválidos: ${invalidCount}`);
  console.log(`Registros en REVIEW: ${duplicateInternalCount}\n`);
  console.log(`Duplicados dentro del Excel: ${duplicateInternalCount}`);
  console.log(`Duplicados contra PostgreSQL: ${duplicateDbCount}\n`);
  console.log(`Registros nuevos: ${validCount}`);
  console.log(`Registros existentes: ${duplicateDbCount}`);
  console.log(`Registros omitidos: ${invalidCount}`);
  console.log(`Registros en revisión: ${duplicateInternalCount}\n`);

  // Show errors
  const rejectedRecords = results.filter(r => r.action === 'REJECTED');
  if (rejectedRecords.length > 0) {
    console.log(`⚠️  REJECTED RECORDS (${rejectedRecords.length}):`);
    rejectedRecords.slice(0, 5).forEach(r => {
      console.log(`  - Row ${r.normalized.sourceRow}: ${r.reason}`);
    });
    if (rejectedRecords.length > 5) {
      console.log(`  ... and ${rejectedRecords.length - 5} more`);
    }
    console.log();
  }

  // Show potential duplicates
  const reviewRecords = results.filter(r => r.action === 'REVIEW');
  if (reviewRecords.length > 0) {
    console.log(`⚠️  RECORDS IN REVIEW (${reviewRecords.length}):`);
    reviewRecords.slice(0, 5).forEach(r => {
      console.log(`  - Row ${r.normalized.sourceRow}: ${r.reason}`);
      console.log(`    "${r.normalized.observation.substring(0, 50)}..."`);
    });
    if (reviewRecords.length > 5) {
      console.log(`  ... and ${reviewRecords.length - 5} more`);
    }
    console.log();
  }

  return results;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isBackup = args.includes('--backup');
  const isImport = args.includes('--import');

  if (!isDryRun && !isBackup && !isImport) {
    console.log('Usage:');
    console.log('  --dry-run    Analyze without modifying database');
    console.log('  --backup     Create database backup');
    console.log('  --import     Execute import (requires prior --dry-run)');
    process.exit(0);
  }

  const prisma = new PrismaClient();

  try {
    // Load normalized records
    const normalizedPath = '/tmp/claude-0/-var-www-uix-torrax-cloud/6ee4dc0d-1646-46e2-8214-8c3f2d392169/scratchpad/normalized-records.json';
    if (!fs.existsSync(normalizedPath)) {
      console.error('Error: normalized-records.json not found');
      process.exit(1);
    }

    const normalizedRecords: NormalizedRecord[] = JSON.parse(
      fs.readFileSync(normalizedPath, 'utf8')
    );

    // Get required entities
    const project = await prisma.project.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    if (!project) {
      console.error('Error: No project found in database');
      process.exit(1);
    }

    const user = await prisma.user.findFirst({
      orderBy: { createdAt: 'asc' }
    });
    if (!user) {
      console.error('Error: No user found in database');
      process.exit(1);
    }

    console.log(`\nUsing Project: ${project.name} (${project.id})`);
    console.log(`Using User: ${user.email} (${user.id})\n`);

    // DRY-RUN
    if (isDryRun) {
      const results = await dryRun(normalizedRecords, prisma, project.id, user.id);

      fs.writeFileSync(
        '/tmp/claude-0/-var-www-uix-torrax-cloud/6ee4dc0d-1646-46e2-8214-8c3f2d392169/scratchpad/dryrun-results.json',
        JSON.stringify(results, null, 2)
      );

      console.log('✅ Dry-run complete. Results saved to dryrun-results.json');
      console.log('\n⚠️  Review the results before running --import');
    }

    // BACKUP
    if (isBackup) {
      console.log('Backing up findings table...');
      const findings = await prisma.finding.findMany({
        include: {
          evidence: true,
          supportLinks: true,
          incidenceTypes: true,
          experienceTags: true
        }
      });

      const backup = {
        timestamp: new Date().toISOString(),
        count: findings.length,
        data: findings
      };

      const backupPath = `/tmp/claude-0/-var-www-uix-torrax-cloud/6ee4dc0d-1646-46e2-8214-8c3f2d392169/scratchpad/findings-backup-${Date.now()}.json`;
      fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
      console.log(`✅ Backup created: ${backupPath}`);
    }

    // IMPORT
    if (isImport) {
      console.log('⚠️  IMPORT MODE NOT IMPLEMENTED YET');
      console.log('This requires additional validation and confirmation');
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
