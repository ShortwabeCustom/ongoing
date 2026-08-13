const { Client } = require('pg');

const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'torrax_user',
  password: 'TorraxDev123!',
  database: 'pruebas_maria_dev'
};

// Map sheet names to dates
const SHEET_DATES = {
  'Mod 31 Jul': '2026-07-31',
  'Pruebas 30 de julio': '2026-07-30',
  'Pruebas 3 agosto': '2026-08-03',
  'Pruebas 4 - 5 agosto': '2026-08-04',
  'Pruebas 6 - 7 de agosto': '2026-08-06',
  'Pruebas 10 de agosto': '2026-08-10',
  'Pruebas 11 de agosto': '2026-08-11',
  'Pruebas 12 de agosto': '2026-08-12'
};

async function updateDates() {
  const client = new Client(DB_CONFIG);

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    console.log('📅 UPDATING CREATEDAT BY SHEET DATE\n');

    let totalUpdated = 0;

    for (const [sheetName, dateStr] of Object.entries(SHEET_DATES)) {
      const result = await client.query(
        `UPDATE findings 
         SET "createdAt" = $1::timestamp
         WHERE "sourceSheet" = $2 
         AND "importBatchId" = '99b43438-018a-495a-8957-62a58d7e71bf'`,
        [`${dateStr}T12:00:00Z`, sheetName]
      );

      const count = result.rowCount;
      totalUpdated += count;
      console.log(`  ✓ ${sheetName.padEnd(30)} (${dateStr}) → ${count} records`);
    }

    console.log(`\n✅ Updated ${totalUpdated} findings with date-based createdAt\n`);

    // Verify
    const verify = await client.query(`
      SELECT 
        "sourceSheet",
        COUNT(*) as count,
        MIN("createdAt"::date) as min_date,
        MAX("createdAt"::date) as max_date
      FROM findings
      WHERE "importBatchId" = '99b43438-018a-495a-8957-62a58d7e71bf'
      GROUP BY "sourceSheet"
      ORDER BY "createdAt" ASC
    `);

    console.log('VERIFICATION:');
    verify.rows.forEach(row => {
      console.log(`  ${row.sourceSheet.padEnd(30)} | ${row.count} records | Date: ${row.min_date}`);
    });

    console.log('\n✅ Dates updated successfully.');
    console.log('   Now you can filter findings by date in the search panel!');

    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

updateDates();
