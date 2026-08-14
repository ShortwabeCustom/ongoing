import AdmZip from 'adm-zip';
import * as path from 'path';
import * as fs from 'fs';

async function extract() {
  const excelPath = path.join(__dirname, '..', 'Pruebas Maria 2.0 (hoy).xlsx');
  const outputDir = path.join(__dirname, '..', '.claude', 'temp-drawings');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    const zip = new AdmZip(excelPath);
    const entries = zip.getEntries();
    
    // Extract first 3 drawing files for inspection
    const drawings = ['drawing1.xml', 'drawing2.xml', 'drawing3.xml'];
    
    for (const drawingName of drawings) {
      const entry = entries.find(e => e.entryName === `xl/drawings/${drawingName}`);
      if (entry) {
        const content = entry.getData().toString('utf8');
        const outputFile = path.join(outputDir, drawingName);
        fs.writeFileSync(outputFile, content);
        console.log(`✅ Extracted ${drawingName} (${Math.round(content.length / 1024)}KB)`);
      }
    }
    
    console.log(`\n📁 Output: ${outputDir}`);
  } catch (err) {
    console.error('Error:', err);
  }
}

extract();
