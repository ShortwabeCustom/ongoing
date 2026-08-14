/**
 * BULK CREATE EVIDENCE FOR ALL FINDINGS
 *
 * Crea evidencias para TODOS los hallazgos (204 total)
 * - Una evidencia mock por hallazgo
 * - SVG placeholder único para cada uno
 */

import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const logError = (msg: string, err?: any) => {
  console.error(`[${new Date().toISOString()}] ❌ ${msg}`);
  if (err) console.error(err);
};

async function main() {
  log('🚀 BULK CREATE EVIDENCE FOR ALL FINDINGS\n');

  try {
    // Get first user
    const firstUser = await prisma.user.findFirst({
      select: { id: true, email: true },
    });

    if (!firstUser) {
      logError('No users found in database');
      return;
    }

    log(`Using user: ${firstUser.email}\n`);

    // Get ALL findings without evidence
    const findingsWithoutEvidence = await prisma.finding.findMany({
      where: {
        evidence: {
          none: {},
        },
      },
      select: {
        id: true,
        observation: true,
        sourceRow: true,
        sourceSheet: true,
      },
      take: 500, // Safety limit
    });

    log(`📊 Found ${findingsWithoutEvidence.length} findings without evidence\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const finding of findingsWithoutEvidence) {
      try {
        const evidenceNum = created + 1;
        const mockKey = `findings/${finding.id}/evidence-placeholder.svg`;
        const mockUrl = `/evidence-placeholder/evidence-${Math.abs(
          finding.id.charCodeAt(0) % 6,
        ) + 1}.svg`;

        const caption = `${finding.observation.substring(0, 80)}${
          finding.observation.length > 80 ? '...' : ''
        } (Fila ${finding.sourceRow}, ${finding.sourceSheet})`;

        await prisma.evidence.create({
          data: {
            findingId: finding.id,
            type: 'IMAGE',
            originalFilename: `evidence-${evidenceNum}.svg`,
            mimeType: 'image/svg+xml',
            fileSize: 2400,
            storageKey: mockKey,
            url: mockUrl,
            caption: caption,
            createdBy: firstUser.id,
          },
        });

        created++;

        if (created % 50 === 0) {
          log(`✅ Created ${created}...`);
        }
      } catch (err) {
        logError(`Failed to create evidence for ${finding.id}`, err);
        errors++;
      }
    }

    log(`\n\n📊 FINAL SUMMARY`);
    log(`✅ CREATED: ${created}`);
    log(`❌ ERRORS: ${errors}`);
    log(`⏭️  SKIPPED (already have evidence): ${skipped}`);
    log(`\n✨ All findings now have evidence records!`);

  } catch (err) {
    logError('Fatal error', err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  logError('Fatal error', err);
  process.exit(1);
});
