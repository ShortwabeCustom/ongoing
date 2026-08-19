/**
 * UPDATE EVIDENCE URLS
 *
 * Actualiza los Evidence records con URLs públicas
 * (Usará URLs internas mientras se configuran credenciales R2)
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

// Evidence data with public URLs
const EVIDENCE_UPDATES = [
  {
    num: 1,
    findingId: '22ab16c0-75ee-4478-93fd-430603ff91b8',
    url: '/evidence-placeholder/evidence-1.svg',
    filename: 'evidence-1.svg',
    caption: 'Pantalla: ¡Marta, tú tienes el control... (Botón Pago adaptado)',
  },
  {
    num: 2,
    findingId: '05362ed9-a982-48b8-9cec-e7fdc4332762',
    url: '/evidence-placeholder/evidence-2.svg',
    filename: 'evidence-2.svg',
    caption: 'Diálogo modal: CTA debe permanecer deshabilitado',
  },
  {
    num: 3,
    findingId: '87308251-b868-47e1-9402-57984cd8fa4b',
    url: '/evidence-placeholder/evidence-3.svg',
    filename: 'evidence-3.svg',
    caption: 'Interfaz horarios: Chips adaptación proporcional (10:30, 02:00, etc.)',
  },
  {
    num: 4,
    findingId: 'a69e2a09-d51c-4092-840b-92010d6ebce7',
    url: '/evidence-placeholder/evidence-4.svg',
    filename: 'evidence-4.svg',
    caption: 'Formulario: Input → textarea pregunta',
  },
  {
    num: 5,
    findingId: '43f79c3f-9aa7-4b16-8267-9317cdf40b85',
    url: '/evidence-placeholder/evidence-5.svg',
    filename: 'evidence-5.svg',
    caption: 'Pantalla $13,200: Ajustres padding en slider',
  },
  {
    num: 6,
    findingId: '2b9477ca-c239-45e9-84a2-4105f55ed8df',
    url: '/evidence-placeholder/evidence-6.svg',
    filename: 'evidence-6.svg',
    caption: 'Pantalla "Lo soñaste": Estilo dropdown ($13,200)',
  },
];

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const logError = (msg: string, err?: any) => {
  console.error(`[${new Date().toISOString()}] ❌ ${msg}`);
  if (err) console.error(err);
};

async function main() {
  log('🔗 UPDATE EVIDENCE URLS\n');

  // First, fetch evidence IDs for each finding
  const evidence = await prisma.evidence.findMany({
    where: {
      findingId: {
        in: EVIDENCE_UPDATES.map((e) => e.findingId),
      },
    },
    select: {
      id: true,
      findingId: true,
    },
  });

  const evidenceMap = new Map(evidence.map((e) => [e.findingId, e.id]));

  const results: Array<{
    num: number;
    findingId: string;
    action: 'UPDATED' | 'ERROR';
    url?: string;
    reason?: string;
  }> = [];

  for (const update of EVIDENCE_UPDATES) {
    try {
      const evidenceId = evidenceMap.get(update.findingId);
      if (!evidenceId) {
        throw new Error(`No evidence found for finding ${update.findingId}`);
      }

      const updated = await prisma.evidence.update({
        where: {
          id: evidenceId,
        },
        data: {
          url: update.url,
          originalFilename: update.filename,
          caption: update.caption,
        },
      });

      log(`✅ EVIDENCE #${update.num} UPDATED`);
      log(`   Finding: ${update.findingId}`);
      log(`   URL: ${update.url}`);
      log(`   Caption: ${update.caption.substring(0, 50)}...\n`);

      results.push({
        num: update.num,
        findingId: update.findingId,
        action: 'UPDATED',
        url: update.url,
      });
    } catch (err) {
      logError(`Failed to update evidence #${update.num}`, err);
      results.push({
        num: update.num,
        findingId: update.findingId,
        action: 'ERROR',
        reason: String(err),
      });
    }
  }

  // Summary
  console.log('\n📊 SUMMARY');
  console.log(`✅ UPDATED: ${results.filter((r) => r.action === 'UPDATED').length} / ${EVIDENCE_UPDATES.length}`);
  console.log(`❌ ERROR: ${results.filter((r) => r.action === 'ERROR').length}`);

  if (results.filter((r) => r.action === 'UPDATED').length === EVIDENCE_UPDATES.length) {
    console.log('\n✨ All evidence URLs updated successfully!');
    console.log('🌐 You can now view evidence in the UI:\n   https://uix.productdesign.mx/findings\n');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  logError('Fatal error', err);
  process.exit(1);
});
