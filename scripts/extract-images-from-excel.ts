/**
 * EXTRACT IMAGES FROM EXCEL
 *
 * Lee el archivo "Pruebas Maria 2.0 (hoy).xlsx" y extrae todas las imágenes
 */

import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

async function extractImagesFromExcel() {
  const excelPath = path.join(__dirname, '..', 'Pruebas Maria 2.0 (hoy).xlsx');
  const outputDir = path.join(__dirname, '..', 'public', 'evidence-from-excel');

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`📂 Reading Excel file: ${excelPath}`);
  console.log(`💾 Output directory: ${outputDir}\n`);

  try {
    // Excel files are ZIP archives
    const zip = new AdmZip(excelPath);
    const zipEntries = zip.getEntries();

    console.log(`🔍 Scanning for images in Excel...\n`);

    let imageCount = 0;

    // Look for media files (images are usually in xl/media/)
    for (const entry of zipEntries) {
      const entryPath = entry.entryName;

      // Check if it's a media file (images)
      if (entryPath.includes('xl/media/') || entryPath.includes('media/')) {
        const ext = path.extname(entryPath).toLowerCase();

        // Extract common image formats
        if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
          const fileName = `image-${imageCount + 1}${ext}`;
          const outputPath = path.join(outputDir, fileName);

          // Extract image
          const imageData = entry.getData();
          fs.writeFileSync(outputPath, imageData);

          imageCount++;
          console.log(`✅ Extracted: ${fileName} (${Math.round(imageData.length / 1024)}KB)`);
        }
      }
    }

    console.log(`\n📊 Summary`);
    console.log(`✅ Total images extracted: ${imageCount}`);
    console.log(`📁 Location: ${outputDir}`);

    if (imageCount > 0) {
      console.log(`\n✨ Next steps:`);
      console.log(`1. Verify images in ${outputDir}`);
      console.log(`2. Update evidence URLs in BD`);
      console.log(`3. Rebuild and deploy`);
    } else {
      console.log(`\n⚠️  No images found in Excel file`);
    }

    return imageCount;
  } catch (err) {
    console.error('❌ Error extracting images:', err);
    return 0;
  }
}

extractImagesFromExcel().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
