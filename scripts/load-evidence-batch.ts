/**
 * EVIDENCE BATCH LOADER
 *
 * Purpose: Load evidence (screenshots/images) for 6 findings
 * Source: Fingerprints + evidence descriptions from Excel
 * Destination: PostgreSQL + Cloudflare R2 (optional)
 *
 * Usage:
 *   npx ts-node scripts/load-evidence-batch.ts --dry-run
 *   npx ts-node scripts/load-evidence-batch.ts --mock (creates mock evidence)
 *   npx ts-node scripts/load-evidence-batch.ts --import (imports with real files)
 */

import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ============================================================================
// EVIDENCE DATA: FROM EXCEL IMPORT
// ============================================================================

interface EvidenceRecord {
  fingerprint: string;
  sourceRow: number;
  sourceSheet: string;
  caption: string;
  filepath?: string; // Optional local file path
}

const EVIDENCE_TO_LOAD: EvidenceRecord[] = [
  {
    fingerprint: '8abab28e80b9fbcf2d5b5585b8d159b8ed5f973aeb0891f90f0a0d1f09976d2e',
    sourceRow: 16,
    sourceSheet: 'Mod 31 Jul',
    caption: 'Pantalla: ¡Marta, tú tienes el control... (Botón Pago adaptado)',
    filepath: './evidence/evidence-1.jpg', // Optional
  },
  {
    fingerprint: '33e39cdbd19f6f3cf585d6e91171249edd103dc04ad206eaa1039216ab0c6702',
    sourceRow: 64,
    sourceSheet: 'Pruebas 30 julio',
    caption: 'Diálogo modal: CTA debe permanecer deshabilitado',
    filepath: './evidence/evidence-2.jpg',
  },
  {
    fingerprint: '5c4c348dde8e2aad134465afe69f4ec63f7379d4d84c27309ee2f462853ab7f0',
    sourceRow: 95,
    sourceSheet: 'Pruebas 30 julio',
    caption: 'Interfaz horarios: Chips adaptación proporcional (10:30, 02:00, etc.)',
    filepath: './evidence/evidence-3.jpg',
  },
  {
    fingerprint: '1fb5152c50d5c22d2fab5f7d21460b647d840fa0f305cc9346d554fdc70cfe5b',
    sourceRow: 35,
    sourceSheet: 'Pruebas 4-5 agosto',
    caption: 'Formulario: Input → textarea pregunta',
    filepath: './evidence/evidence-4.jpg',
  },
  {
    fingerprint: '60eb68e696f8cb9b74bf9f58c83f39465636ea92df09d479d5bd912db814875e',
    sourceRow: 44,
    sourceSheet: 'Pruebas 4-5 agosto',
    caption: 'Pantalla $13,200: Ajustres padding en slider',
    filepath: './evidence/evidence-5.jpg',
  },
  {
    fingerprint: '242148c78c71c6002564b776e2f86994af37b78b7ed9ecb9e7a62ee3066d6624',
    sourceRow: 8,
    sourceSheet: 'Pruebas 10 agosto',
    caption: 'Pantalla "Lo soñaste": Estilo dropdown ($13,200)',
    filepath: './evidence/evidence-6.jpg',
  },
];

// ============================================================================
// UTILITY: DRY-RUN + LOGGING
// ============================================================================

interface LoadResult {
  fingerprint: string;
  action: 'CREATED' | 'SKIPPED' | 'ERROR';
  reason?: string;
  evidenceId?: string;
  errors?: string[];
}

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const logError = (msg: string, err?: any) => {
  console.error(`[${new Date().toISOString()}] ❌ ${msg}`);
  if (err) console.error(err);
};

// ============================================================================
// MAIN: DRY-RUN
// ============================================================================

async function dryRun() {
  log('🔍 DRY-RUN: Scanning for findings...');

  const findings = await prisma.finding.findMany({
    where: {
      sourceFingerprint: {
        in: EVIDENCE_TO_LOAD.map((e) => e.fingerprint),
      },
    },
    select: {
      id: true,
      sourceFingerprint: true,
      observation: true,
      _count: {
        select: { evidence: true },
      },
    },
  });

  console.log(`\n📊 FINDINGS FOUND: ${findings.length} / ${EVIDENCE_TO_LOAD.length}\n`);

  findings.forEach((finding) => {
    const evidence = EVIDENCE_TO_LOAD.find(
      (e) => e.fingerprint === finding.sourceFingerprint,
    );
    if (!evidence) return;

    console.log(`✅ FOUND: ${finding.observation.substring(0, 60)}...`);
    console.log(`   ID: ${finding.id}`);
    console.log(`   Fingerprint: ${finding.sourceFingerprint.substring(0, 16)}...`);
    console.log(`   Current evidence: ${finding._count.evidence}`);
    console.log(`   → Will add: "${evidence.caption}"`);
    console.log('');
  });

  const notFound = EVIDENCE_TO_LOAD.filter(
    (e) => !findings.some((f) => f.sourceFingerprint === e.fingerprint),
  );

  if (notFound.length > 0) {
    console.log(`\n⚠️  NOT FOUND: ${notFound.length}`);
    notFound.forEach((e) => {
      console.log(`   - ${e.fingerprint.substring(0, 16)}... (${e.caption.substring(0, 40)})`);
    });
  }
}

// ============================================================================
// MAIN: MOCK EVIDENCE (No files needed)
// ============================================================================

async function mockImport() {
  log('📝 MOCK IMPORT: Creating evidence records (no files)...\n');

  // Get first user from database
  const firstUser = await prisma.user.findFirst({
    select: { id: true, email: true },
  });

  if (!firstUser) {
    logError('No users found in database. Please create a user first.');
    return;
  }

  log(`Using user: ${firstUser.email} (${firstUser.id})\n`);

  const findings = await prisma.finding.findMany({
    where: {
      sourceFingerprint: {
        in: EVIDENCE_TO_LOAD.map((e) => e.fingerprint),
      },
    },
    select: {
      id: true,
      sourceFingerprint: true,
      observation: true,
    },
  });

  const results: LoadResult[] = [];

  for (const evidence of EVIDENCE_TO_LOAD) {
    const finding = findings.find((f) => f.sourceFingerprint === evidence.fingerprint);

    if (!finding) {
      results.push({
        fingerprint: evidence.fingerprint,
        action: 'SKIPPED',
        reason: `Finding not found: ${evidence.caption}`,
      });
      continue;
    }

    try {
      // Create mock evidence (no file upload)
      const mockKey = `findings/${finding.id}/mock-evidence.jpg`;

      const createdEvidence = await prisma.evidence.create({
        data: {
          findingId: finding.id,
          type: 'IMAGE', // Mock evidence is an image
          originalFilename: `evidence-${evidence.sourceRow}.jpg`,
          mimeType: 'image/jpeg',
          fileSize: 0, // Mock file size
          storageKey: mockKey,
          url: null, // No URL for mock evidence
          caption: evidence.caption,
          createdBy: firstUser.id,
        },
      });

      log(`✅ CREATED: ${finding.observation.substring(0, 50)}...`);
      log(`   Evidence ID: ${createdEvidence.id}`);
      log(`   Caption: ${evidence.caption}\n`);

      results.push({
        fingerprint: evidence.fingerprint,
        action: 'CREATED',
        evidenceId: createdEvidence.id,
      });
    } catch (err) {
      logError(`Failed to create evidence for ${finding.id}`, err);
      results.push({
        fingerprint: evidence.fingerprint,
        action: 'ERROR',
        errors: [String(err)],
      });
    }
  }

  // Summary
  console.log('\n📊 SUMMARY');
  console.log(`✅ CREATED: ${results.filter((r) => r.action === 'CREATED').length}`);
  console.log(`⚠️  SKIPPED: ${results.filter((r) => r.action === 'SKIPPED').length}`);
  console.log(`❌ ERROR: ${results.filter((r) => r.action === 'ERROR').length}`);

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    mode: 'mock',
    summary: {
      created: results.filter((r) => r.action === 'CREATED').length,
      skipped: results.filter((r) => r.action === 'SKIPPED').length,
      errors: results.filter((r) => r.action === 'ERROR').length,
    },
    results,
  };

  fs.writeFileSync(
    path.join(__dirname, `evidence-load-${Date.now()}.json`),
    JSON.stringify(report, null, 2),
  );

  log(`\n📄 Report saved: evidence-load-${Date.now()}.json`);
}

// ============================================================================
// MAIN: VERIFY IN UI
// ============================================================================

async function verify() {
  log('🔍 VERIFICATION: Checking evidence in database...\n');

  const findings = await prisma.finding.findMany({
    where: {
      sourceFingerprint: {
        in: EVIDENCE_TO_LOAD.map((e) => e.fingerprint),
      },
    },
    include: {
      evidence: {
        select: {
          id: true,
          originalFilename: true,
          caption: true,
          url: true,
          createdAt: true,
        },
      },
    },
  });

  findings.forEach((finding) => {
    console.log(`📄 ${finding.observation.substring(0, 50)}...`);
    console.log(`   ID: ${finding.id}`);
    if (finding.evidence.length > 0) {
      console.log(`   ✅ Evidence: ${finding.evidence.length}`);
      finding.evidence.forEach((e) => {
        console.log(`      - ${e.originalFilename}: "${e.caption}"`);
        console.log(`        URL: ${e.url?.substring(0, 60)}...`);
      });
    } else {
      console.log(`   ⚠️  No evidence yet`);
    }
    console.log('');
  });
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--dry-run')) {
    await dryRun();
  } else if (args.includes('--mock')) {
    await mockImport();
  } else if (args.includes('--verify')) {
    await verify();
  } else {
    console.log(`
📖 USAGE:

  npx ts-node scripts/load-evidence-batch.ts --dry-run
    → Check which findings exist (no changes)

  npx ts-node scripts/load-evidence-batch.ts --mock
    → Create evidence records (no file upload needed)

  npx ts-node scripts/load-evidence-batch.ts --verify
    → Show current evidence in database
    `);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  logError('Fatal error', err);
  process.exit(1);
});
