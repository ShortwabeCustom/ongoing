const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

(async () => {
  const prisma = new PrismaClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupDir = `/tmp/claude-0/-var-www-uix-torrax-cloud/6ee4dc0d-1646-46e2-8214-8c3f2d392169/scratchpad/backups`;

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log('\n=== BACKING UP FINDINGS TABLE ===\n');
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Destination: ${backupDir}\n`);

  try {
    console.log('Exporting findings...');
    const findings = await prisma.finding.findMany({
      include: {
        incidenceTypes: true,
        evidenceCount: { select: { _count: true } }
      }
    });

    const backup = {
      timestamp: new Date().toISOString(),
      table: 'findings',
      recordCount: findings.length,
      data: findings
    };

    const backupPath = path.join(backupDir, `findings-backup-${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`✅ Backed up ${findings.length} findings\n`);

    const incidenceTypes = await prisma.findingIncidenceType.findMany();
    const incidenceBackup = {
      timestamp: new Date().toISOString(),
      table: 'finding_incidence_types',
      recordCount: incidenceTypes.length,
      data: incidenceTypes
    };

    const incidenceBackupPath = path.join(backupDir, `finding_incidence_types-backup-${timestamp}.json`);
    fs.writeFileSync(incidenceBackupPath, JSON.stringify(incidenceBackup, null, 2));
    console.log(`✅ Backed up ${incidenceTypes.length} incidence types\n`);

    console.log('=== BACKUP SUMMARY ===');
    console.log(`✅ findings: ${findings.length} records`);
    console.log(`✅ finding_incidence_types: ${incidenceTypes.length} records`);
    console.log(`📁 Location: ${backupDir}\n`);
    console.log(`✅ READY FOR IMPORT`);

  } finally {
    await prisma.$disconnect();
  }
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
