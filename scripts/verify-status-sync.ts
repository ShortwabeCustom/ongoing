import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const statuses = await prisma.finding.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  console.log(`\n📊 FINDINGS BY STATUS\n`);
  statuses.forEach(s => {
    console.log(`  ${s.status.padEnd(20)} : ${s._count.id}`);
  });

  const total = statuses.reduce((sum, s) => sum + s._count.id, 0);
  const validated = statuses.find(s => s.status === 'VALIDATED')?._count.id || 0;

  console.log(`\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Total: ${total}`);
  console.log(`  ✅ Validated: ${validated} / ${total} (${Math.round((validated / total) * 100)}%)\n`);

  await prisma.$disconnect();
}
main();
