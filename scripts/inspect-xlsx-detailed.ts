import AdmZip from 'adm-zip';
import * as path from 'path';
import * as fs from 'fs';

async function inspectXLSX() {
  const excelPath = path.join(__dirname, '..', 'Pruebas Maria 2.0 (hoy).xlsx');
  
  console.log('📋 INSPECTING XLSX STRUCTURE\n');
  console.log(`File: ${excelPath}`);
  console.log(`Exists: ${fs.existsSync(excelPath)}\n`);

  try {
    const zip = new AdmZip(excelPath);
    const entries = zip.getEntries();
    
    const mediaFiles: string[] = [];
    const drawings: string[] = [];
    const rels: string[] = [];
    
    for (const entry of entries) {
      if (entry.entryName.includes('xl/media/')) {
        mediaFiles.push(entry.entryName);
      }
      if (entry.entryName.includes('xl/drawings/')) {
        drawings.push(entry.entryName);
      }
      if (entry.entryName.includes('_rels/')) {
        rels.push(entry.entryName);
      }
    }
    
    console.log(`📁 Media Files (${mediaFiles.length}):`);
    mediaFiles.forEach(f => console.log(`   ${f}`));
    
    console.log(`\n🎨 Drawing Files (${drawings.length}):`);
    drawings.forEach(f => console.log(`   ${f}`));
    
    // Check drawing relationships
    const drawingRels = entries.find(e => e.entryName === 'xl/drawings/_rels/drawing1.xml.rels');
    if (drawingRels) {
      const content = drawingRels.getData().toString('utf8');
      console.log(`\n🔗 Drawing1.xml.rels relationships:`);
      console.log(content.substring(0, 800));
    }
    
    // Check worksheet to drawing relationship
    const worksheetRels = entries.find(e => e.entryName === 'xl/worksheets/_rels/sheet1.xml.rels');
    if (worksheetRels) {
      const content = worksheetRels.getData().toString('utf8');
      console.log(`\n📎 Sheet1.xml.rels relationships:`);
      console.log(content.substring(0, 800));
    }
    
  } catch (err) {
    console.error('Error:', err);
  }
}

inspectXLSX();
