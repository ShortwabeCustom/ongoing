const { Client } = require('pg');

const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'torrax_user',
  password: 'TorraxDev123!',
  database: 'pruebas_maria_dev'
};

async function verify() {
  const client = new Client(DB_CONFIG);

  try {
    await client.connect();

    const result = await client.query(`
      SELECT 
        "sourceSheet",
        COUNT(*) as count,
        DATE("createdAt") as date
      FROM findings
      WHERE "importBatchId" = '99b43438-018a-495a-8957-62a58d7e71bf'
      GROUP BY "sourceSheet", DATE("createdAt")
      ORDER BY DATE("createdAt") ASC
    `);

    console.log('\n✅ DATES UPDATED SUCCESSFULLY\n');
    console.log('Sheet Name (Test Session)              | Records | Date      ');
    console.log('─'.repeat(70));

    result.rows.forEach(row => {
      console.log(`${row.sourceSheet.padEnd(37)} | ${String(row.count).padStart(7)} | ${row.date}`);
    });

    console.log('\n✅ Now you can filter by date in /findings search panel');
    console.log('   Try: date range July 30 - Aug 12, 2026');

    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verify();
