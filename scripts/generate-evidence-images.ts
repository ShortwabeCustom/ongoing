/**
 * GENERATE EVIDENCE IMAGES
 *
 * Crea 6 imágenes PNG placeholder con información de cada hallazgo
 * para subir a Cloudflare R2
 */

import * as fs from 'fs';
import * as path from 'path';

// Evidence metadata para generar imágenes
const EVIDENCE_DATA = [
  {
    num: 1,
    fingerprint: '8abab28e80b9fbcf2d5b5585b8d159b8ed5f973aeb0891f90f0a0d1f09976d2e',
    title: 'Botón Pago Adaptado',
    sheet: 'Mod 31 Jul',
    row: 16,
    description: 'Pantalla: ¡Marta, tú tienes el control...',
    color: '#6366f1',
  },
  {
    num: 2,
    fingerprint: '33e39cdbd19f6f3cf585d6e91171249edd103dc04ad206eaa1039216ab0c6702',
    title: 'CTA Deshabilitado',
    sheet: 'Pruebas 30 julio',
    row: 64,
    description: 'Diálogo modal: CTA debe permanecer deshabilitado',
    color: '#ec4899',
  },
  {
    num: 3,
    fingerprint: '5c4c348dde8e2aad134465afe69f4ec63f7379d4d84c27309ee2f462853ab7f0',
    title: 'Chips Proporcional',
    sheet: 'Pruebas 30 julio',
    row: 95,
    description: 'Interfaz horarios: Chips adaptación (10:30, 02:00, etc.)',
    color: '#14b8a6',
  },
  {
    num: 4,
    fingerprint: '1fb5152c50d5c22d2fab5f7d21460b647d840fa0f305cc9346d554fdc70cfe5b',
    title: 'Input → Textarea',
    sheet: 'Pruebas 4-5 agosto',
    row: 35,
    description: 'Formulario: Input → textarea pregunta',
    color: '#f59e0b',
  },
  {
    num: 5,
    fingerprint: '60eb68e696f8cb9b74bf9f58c83f39465636ea92df09d479d5bd912db814875e',
    title: 'Padding Slider',
    sheet: 'Pruebas 4-5 agosto',
    row: 44,
    description: 'Pantalla $13,200: Ajustres padding en slider',
    color: '#8b5cf6',
  },
  {
    num: 6,
    fingerprint: '242148c78c71c6002564b776e2f86994af37b78b7ed9ecb9e7a62ee3066d6624',
    title: 'Dropdown Style',
    sheet: 'Pruebas 10 agosto',
    row: 8,
    description: 'Pantalla "Lo soñaste": Estilo dropdown ($13,200)',
    color: '#06b6d4',
  },
];

// Simple SVG-to-PNG generator (using canvas would need installation)
function generateSVG(data: typeof EVIDENCE_DATA[0]): string {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1200" height="800" fill="#f8f9fa"/>

  <!-- Header Bar -->
  <rect width="1200" height="100" fill="${data.color}"/>

  <!-- Title -->
  <text x="50" y="65" font-size="48" font-weight="bold" fill="white" font-family="Arial">
    Evidencia #${data.num}
  </text>

  <!-- Main Content -->
  <rect x="40" y="130" width="1120" height="630" fill="white" stroke="#e5e7eb" stroke-width="2" rx="8"/>

  <!-- Title -->
  <text x="60" y="200" font-size="36" font-weight="bold" fill="#1f2937" font-family="Arial">
    ${data.title}
  </text>

  <!-- Description -->
  <text x="60" y="260" font-size="24" fill="#4b5563" font-family="Arial">
    ${data.description}
  </text>

  <!-- Metadata Grid -->
  <g>
    <!-- Row 1: Sheet -->
    <text x="60" y="350" font-size="14" font-weight="bold" fill="#6b7280" font-family="Arial">
      HOJA:
    </text>
    <text x="200" y="350" font-size="14" fill="#374151" font-family="Arial">
      ${data.sheet}
    </text>

    <!-- Row 2: Row Number -->
    <text x="60" y="400" font-size="14" font-weight="bold" fill="#6b7280" font-family="Arial">
      FILA:
    </text>
    <text x="200" y="400" font-size="14" fill="#374151" font-family="Arial">
      ${data.row}
    </text>

    <!-- Row 3: Fingerprint -->
    <text x="60" y="450" font-size="14" font-weight="bold" fill="#6b7280" font-family="Arial">
      FINGERPRINT:
    </text>
    <text x="200" y="450" font-size="12" fill="#6b7280" font-family="monospace">
      ${data.fingerprint.substring(0, 32)}...
    </text>

    <!-- Row 4: Type -->
    <text x="60" y="500" font-size="14" font-weight="bold" fill="#6b7280" font-family="Arial">
      TIPO:
    </text>
    <text x="200" y="500" font-size="14" fill="#374151" font-family="Arial">
      Evidence Mock / Placeholder Image
    </text>

    <!-- Row 5: Date -->
    <text x="60" y="550" font-size="14" font-weight="bold" fill="#6b7280" font-family="Arial">
      FECHA:
    </text>
    <text x="200" y="550" font-size="14" fill="#374151" font-family="Arial">
      ${new Date().toLocaleDateString('es-ES')}
    </text>
  </g>

  <!-- Footer -->
  <rect x="40" y="730" width="1120" height="30" fill="#f3f4f6" rx="4"/>
  <text x="60" y="752" font-size="12" fill="#9ca3af" font-family="Arial">
    Pruebas María 2.0 - Placeholder Evidence Image
  </text>
</svg>`;

  return svg;
}

async function main() {
  const outputDir = path.join(__dirname, '..', 'public', 'evidence-placeholder');

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`✅ Created directory: ${outputDir}`);
  }

  // Generate SVG files
  for (const data of EVIDENCE_DATA) {
    const svg = generateSVG(data);
    const filename = `evidence-${data.num}.svg`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, svg);
    console.log(`✅ Generated: ${filename}`);
  }

  console.log(`\n📊 SUMMARY`);
  console.log(`✅ Generated ${EVIDENCE_DATA.length} SVG placeholder images`);
  console.log(`📁 Location: ${outputDir}`);
  console.log(`\n💡 Next: Convert SVG → PNG and upload to R2`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
