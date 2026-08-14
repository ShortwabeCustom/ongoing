const XLSX = require('xlsx');
const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function restoreData() {
  console.log('📊 Reading Excel file...');
  const workbook = XLSX.readFile('/var/www/uix.torrax.cloud/Pruebas Maria 2.0 (hoy).xlsx');

  // Get or create default project
  let project = await prisma.project.findFirst();
  if (!project) {
    const owner = await prisma.user.findFirst();
    if (!owner) {
      console.error('❌ No user exists. Need at least one user to restore data.');
      process.exit(1);
    }
    project = await prisma.project.create({
      data: {
        name: 'Pruebas María 2.0',
        ownerId: owner.id,
      },
    });
    console.log(`✓ Created project: ${project.name}`);
  }

  const creator = await prisma.user.findFirst();
  let totalCreated = 0;
  let version = await prisma.productVersion.findFirst();
  if (!version) {
    version = await prisma.productVersion.create({
      data: { projectId: project.id, version: '1.0' },
    });
  }

  console.log('\n📝 Processing sheets:');
  // Process each sheet as a test session
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws);

    // Create test session
    const session = await prisma.testSession.create({
      data: {
        name: sheetName,
        date: new Date(),
        projectId: project.id,
        versionId: version.id,
        createdBy: creator.id,
      },
    });

    let sessionCount = 0;
    for (const row of rows) {
      const obs = row['Observación']?.toString().trim();
      if (!obs || obs.length < 5) continue;

      await prisma.finding.create({
        data: {
          projectId: project.id,
          testSessionId: session.id,
          observation: obs,
          status: 'OPEN',
          priority: 'MEDIUM',
          severity: 'MINOR',
          createdBy: creator.id,
          incidenceTypes: { create: [{ incidenceType: 'DESIGN' }] },
        },
      });
      totalCreated++;
      sessionCount++;
    }
    console.log(`  ✓ ${sheetName}: ${sessionCount} findings`);
  }

  console.log(`\n✅ Restored ${totalCreated} findings from Excel backup`);
  await prisma.$disconnect();
}

restoreData().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
