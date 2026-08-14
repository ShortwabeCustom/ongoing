import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const totalFindings = await prisma.finding.count();
  const findingsWithEvidence = await prisma.finding.count({
    where: {
      evidence: {
        some: {},
      },
    },
  });
  const totalEvidence = await prisma.evidence.count();

  console.log(`
📊 EVIDENCE COVERAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Total Findings: ${totalFindings}
✅ Findings with Evidence: ${findingsWithEvidence}
✅ Total Evidence Records: ${totalEvidence}
✅ Coverage: ${Math.round((findingsWithEvidence / totalFindings) * 100)}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  await prisma.$disconnect();
}
main();
