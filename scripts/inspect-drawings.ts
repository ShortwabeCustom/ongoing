import AdmZip from 'adm-zip';
import * as path from 'path';
import { parseStringPromise } from 'xml2js';

async function inspectDrawings() {
  const excelPath = path.join(__dirname, '..', 'Pruebas Maria 2.0 (hoy).xlsx');
  
  try {
    const zip = new AdmZip(excelPath);
    const entries = zip.getEntries();
    
    // Get drawing1.xml
    const drawing1Entry = entries.find(e => e.entryName === 'xl/drawings/drawing1.xml');
    if (!drawing1Entry) {
      console.log('No drawing1.xml found');
      return;
    }
    
    const xmlContent = drawing1Entry.getData().toString('utf8');
    const parsed = await parseStringPromise(xmlContent);
    
    console.log('📋 Drawing1.xml Structure (first image):\n');
    console.log(JSON.stringify(parsed, null, 2).substring(0, 2000));
    
    // Look for twoCellAnchor or oneCellAnchor
    const wps = parsed['w:wps'] || parsed['wps:wps'] || parsed;
    console.log('\n🔍 Root keys:', Object.keys(parsed));
    
  } catch (err) {
    console.error('Error:', err);
  }
}

inspectDrawings();
