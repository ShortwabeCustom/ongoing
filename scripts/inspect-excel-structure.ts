/**
 * INSPECT EXCEL STRUCTURE
 *
 * Examina el Excel para entender su estructura y encontrar dónde están los checkmarks
 */

import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function inspectExcel() {
  const excelPath = path.join(__dirname, '..', 'Pruebas Maria 2.0 (hoy).xlsx');

  console.log(`📂 Reading Excel: ${excelPath}\n`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  workbook.eachSheet((worksheet) => {
    console.log(`\n📋 Sheet: ${worksheet.name}`);
    console.log(`   Columns: ${worksheet.columnCount}`);
    console.log(`   Rows: ${worksheet.rowCount}\n`);

    // Show header row
    const headerRow = worksheet.getRow(1);
    console.log('   Header columns:');
    headerRow.eachCell((cell, colNumber) => {
      console.log(`      Col ${colNumber}: ${cell.value}`);
    });

    // Show first 5 data rows with all columns
    console.log('\n   First 5 rows (showing all cells):');
    for (let rowNum = 2; rowNum <= Math.min(6, worksheet.rowCount); rowNum++) {
      const row = worksheet.getRow(rowNum);
      console.log(`\n      Row ${rowNum}:`);

      row.eachCell((cell, colNumber) => {
        const value = cell.value;
        const type = typeof value;

        // Show cell info
        if (value) {
          const displayValue =
            typeof value === 'string'
              ? value.substring(0, 50)
              : JSON.stringify(value).substring(0, 50);

          console.log(`         Col ${colNumber} (${type}): ${displayValue}`);

          // Highlight potential checkmarks
          if (
            value &&
            (value.toString().includes('✓') ||
              value.toString().includes('✅') ||
              value.toString().includes('☑') ||
              value.toString().includes('☒'))
          ) {
            console.log(`         ⭐ CHECKMARK FOUND!`);
          }
        }
      });
    }
  });
}

inspectExcel().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
