#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function audit() {
  console.log('\n' + '='.repeat(80));
  console.log('AUDITORÍA FASE 14.1.1 — Date Semantics & TestSession Analysis');
  console.log('='.repeat(80) + '\n');

  try {
    // A. Total Findings
    console.log('1️⃣  TOTAL FINDINGS');
    const totalFindings = await prisma.finding.count();
    console.log(`   Total: ${totalFindings}\n`);

    // B. TestSession Count
    console.log('2️⃣  TOTAL TEST SESSIONS');
    const totalSessions = await prisma.testSession.count();
    console.log(`   Total: ${totalSessions}\n`);

    // C. Findings per TestSession
    console.log('3️⃣  FINDINGS PER TEST SESSION');
    const sessionCounts = await prisma.testSession.findMany({
      select: {
        id: true,
        name: true,
        date: true,
        _count: { select: { findings: true } },
      },
      orderBy: { date: 'asc' },
    });

    sessionCounts.forEach(s => {
      const dateStr = s.date.toISOString().split('T')[0];
      console.log(`   ${s.name} (${dateStr}): ${s._count.findings} hallazgos`);
    });
    console.log();

    // D. ImportBatch Count
    console.log('4️⃣  TOTAL IMPORT BATCHES');
    const totalBatches = await prisma.importBatch.count();
    console.log(`   Total: ${totalBatches}\n`);

    // E. Findings per ImportBatch
    console.log('5️⃣  FINDINGS PER IMPORT BATCH');
    const batchCounts = await prisma.importBatch.findMany({
      select: {
        id: true,
        originalFilename: true,
        importedAt: true,
        testSessionId: true,
        _count: { select: { findings: true } },
      },
      orderBy: { importedAt: 'asc' },
    });

    batchCounts.forEach(b => {
      const dateStr = b.importedAt.toISOString().split('T')[0];
      console.log(`   Batch ${b.id.slice(0, 8)}... (${dateStr}): ${b._count.findings} hallazgos | TestSession: ${b.testSessionId.slice(0, 8)}...`);
    });
    console.log();

    // F. Distribution by createdAt (Finding)
    console.log('6️⃣  FINDINGS DISTRIBUTION BY createdAt');
    const createdDistribution = await prisma.finding.groupBy({
      by: ['createdAt'],
      _count: true,
      orderBy: { createdAt: 'asc' },
    });

    createdDistribution.forEach(row => {
      const dateStr = row.createdAt.toISOString().split('T')[0];
      console.log(`   ${dateStr}: ${row._count}`);
    });
    console.log();

    // G. Distribution by updatedAt (Finding)
    console.log('7️⃣  FINDINGS DISTRIBUTION BY updatedAt');
    const updatedDistribution = await prisma.finding.groupBy({
      by: ['updatedAt'],
      _count: true,
      orderBy: { updatedAt: 'asc' },
    });

    updatedDistribution.forEach(row => {
      const dateStr = row.updatedAt.toISOString().split('T')[0];
      console.log(`   ${dateStr}: ${row._count}`);
    });
    console.log();

    // H. Distribution by ImportBatch.importedAt
    console.log('8️⃣  IMPORT BATCHES DISTRIBUTION BY importedAt');
    const importedDistribution = await prisma.importBatch.groupBy({
      by: ['importedAt'],
      _count: true,
      orderBy: { importedAt: 'asc' },
    });

    importedDistribution.forEach(row => {
      const dateStr = row.importedAt.toISOString().split('T')[0];
      console.log(`   ${dateStr}: ${row._count} batches`);
    });
    console.log();

    // I. Distribution by sourceSheet
    console.log('9️⃣  FINDINGS DISTRIBUTION BY sourceSheet');
    const sheetDistribution = await prisma.finding.groupBy({
      by: ['sourceSheet'],
      _count: true,
      orderBy: { _count: { _all: 'desc' } },
    });

    sheetDistribution.forEach(row => {
      if (row.sourceSheet) {
        console.log(`   "${row.sourceSheet}": ${row._count}`);
      } else {
        console.log(`   [No sourceSheet]: ${row._count}`);
      }
    });
    console.log();

    // J. Sample findings with sourceSheet + importBatchId
    console.log('🔟 SAMPLE FINDINGS (WITH sourceSheet & RELATIONSHIPS)');
    const samples = await prisma.finding.findMany({
      select: {
        id: true,
        folio: true,
        observation: true,
        sourceSheet: true,
        sourceRow: true,
        createdAt: true,
        importBatchId: true,
        testSessionId: true,
        importBatch: { select: { originalFilename: true, importedAt: true } },
        testSession: { select: { name: true, date: true } },
      },
      take: 5,
      orderBy: { createdAt: 'asc' },
    });

    samples.forEach((f, i) => {
      const createdDate = f.createdAt.toISOString().split('T')[0];
      const importedDate = f.importBatch?.importedAt.toISOString().split('T')[0] || 'N/A';
      const sessionDate = f.testSession?.date.toISOString().split('T')[0] || 'N/A';

      console.log(`\n   [${i + 1}] ID: ${f.id.slice(0, 8)}...`);
      console.log(`       Folio: ${f.folio || 'N/A'} | sourceSheet: "${f.sourceSheet}" | sourceRow: ${f.sourceRow}`);
      console.log(`       createdAt: ${createdDate}`);
      console.log(`       importedAt: ${importedDate} | TestSession: ${f.testSession?.name} (${sessionDate})`);
    });
    console.log();

    // K. Relationship check: Findings with NULL testSessionId
    console.log('1️⃣1️⃣ FINDINGS WITH NULL testSessionId');
    const nullSession = await prisma.finding.count({
      where: { testSessionId: null },
    });
    console.log(`   Count: ${nullSession}\n`);

    // L. Findings with NULL importBatchId
    console.log('1️⃣2️⃣ FINDINGS WITH NULL importBatchId');
    const nullBatch = await prisma.finding.count({
      where: { importBatchId: null },
    });
    console.log(`   Count: ${nullBatch}\n`);

    // M. CreatedAt vs TestSession.date discrepancy check
    console.log('1️⃣3️⃣ CREATED AT vs TEST SESSION DATE MAPPING');
    console.log('   Sample: Finding.createdAt should hypothetically map to TestSession.date\n');

    const createdDates = await prisma.finding.groupBy({
      by: ['createdAt'],
      _count: true,
      orderBy: { createdAt: 'asc' },
    });

    const sessionDates = await prisma.testSession.findMany({
      select: { date: true, _count: { select: { findings: true } } },
      orderBy: { date: 'asc' },
    });

    console.log('   createdAt dates and counts:');
    createdDates.forEach(row => {
      const dateStr = row.createdAt.toISOString().split('T')[0];
      console.log(`     ${dateStr}: ${row._count}`);
    });

    console.log('\n   testSession.date and finding counts:');
    sessionDates.forEach(row => {
      const dateStr = row.date.toISOString().split('T')[0];
      console.log(`     ${dateStr}: ${row._count.findings}`);
    });
    console.log();

    console.log('='.repeat(80));
    console.log('✅ AUDITORÍA COMPLETADA');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error durante auditoría:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

audit();
