/**
 * REDISTRIBUTE EVIDENCE URLS
 *
 * Actualiza las 204 evidencias para usar 50 imágenes SVG diferentes
 * Distribución: ~4 hallazgos por imagen
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

async function main() {
  log('🔄 REDISTRIBUTE EVIDENCE URLS (50 unique images)\n');

  try {
    // Get all evidence ordered by creation
    const allEvidence = await prisma.evidence.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        findingId: true,
      },
    });

    log(`Found ${allEvidence.length} evidence records\n`);

    let updated = 0;

    // Distribute 50 images across all evidence
    for (let i = 0; i < allEvidence.length; i++) {
      const evidence = allEvidence[i];
      const imageNum = (i % 50) + 1; // Cycle through 1-50
      const newUrl = `/evidence-placeholder/evidence-${imageNum}.svg`;

      await prisma.evidence.update({
        where: {
          id: evidence.id,
        },
        data: {
          url: newUrl,
        },
      });

      updated++;

      if (updated % 50 === 0) {
        log(`✅ Updated ${updated}/${allEvidence.length}...`);
      }
    }

    log(`\n✨ Successfully updated ${updated} evidence records`);
    log(`📊 Using 50 unique SVG images distributed evenly`);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
