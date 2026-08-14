/**
 * GENERATE UNIQUE EVIDENCE IMAGES (50 variants)
 *
 * Crea 50 imágenes SVG diferentes para distribuir entre 204 hallazgos
 */

import * as fs from 'fs';
import * as path from 'path';

function generateUniqueSVG(num: number): string {
  // Colores únicos para cada imagen
  const colors = [
    '#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#10b981', '#f97316', '#3b82f6', '#d946ef',
    '#84cc16', '#ef4444', '#06b6d4', '#a855f7', '#0ea5e9',
    '#22c55e', '#f43f5e', '#6b21a8', '#0891b2', '#059669',
    '#7c3aed', '#dc2626', '#0d9488', '#ea580c', '#9333ea',
    '#16a34a', '#e11d48', '#1e3a8a', '#164e63', '#4c0519',
    '#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af',
    '#d1d5db', '#e5e7eb', '#f3f4f6', '#f8fafc', '#0f172a',
    '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8',
    '#cbd5e1', '#e2e8f0', '#f1f5f9', '#f8fafc', '#fef2f2'
  ];

  const color = colors[num % colors.length];
  const bgColor = ['#f8f9fa', '#fafbfc', '#f9fafb', '#f5f7fa', '#f0f1f3'][num % 5];

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1200" height="800" fill="${bgColor}"/>

  <!-- Header Bar -->
  <rect width="1200" height="100" fill="${color}"/>

  <!-- Number Circle -->
  <circle cx="120" cy="50" r="40" fill="white" opacity="0.3"/>
  <text x="120" y="65" font-size="48" font-weight="bold" fill="white" text-anchor="middle" font-family="Arial">
    ${num}
  </text>

  <!-- Title -->
  <text x="50" y="65" font-size="42" font-weight="bold" fill="white" font-family="Arial">
    EVIDENCIA
  </text>

  <!-- Main Content Box -->
  <rect x="40" y="130" width="1120" height="630" fill="white" stroke="${color}" stroke-width="3" rx="8"/>

  <!-- Content Area -->
  <g>
    <!-- Large Icon/Number -->
    <circle cx="200" cy="250" r="60" fill="${color}" opacity="0.1"/>
    <text x="200" y="275" font-size="80" font-weight="bold" fill="${color}" text-anchor="middle" font-family="Arial" opacity="0.3">
      ${num}
    </text>

    <!-- Info Text -->
    <text x="320" y="230" font-size="28" font-weight="bold" fill="#1f2937" font-family="Arial">
      Hallazgo #{num}
    </text>
    <text x="320" y="270" font-size="16" fill="#6b7280" font-family="Arial">
      Evidencia Placeholder
    </text>

    <!-- Metadata Grid -->
    <line x1="60" y1="330" x2="1140" y2="330" stroke="#e5e7eb" stroke-width="1"/>

    <text x="60" y="370" font-size="14" font-weight="bold" fill="#6b7280" font-family="Arial">
      TIPO:
    </text>
    <text x="200" y="370" font-size="14" fill="#374151" font-family="Arial">
      IMAGE / SVG
    </text>

    <text x="60" y="420" font-size="14" font-weight="bold" fill="#6b7280" font-family="Arial">
      ESTADO:
    </text>
    <rect x="200" y="405" width="16" height="16" fill="${color}"/>
    <text x="230" y="420" font-size="14" fill="#374151" font-family="Arial">
      Cargada
    </text>

    <text x="600" y="370" font-size="14" font-weight="bold" fill="#6b7280" font-family="Arial">
      FORMATO:
    </text>
    <text x="740" y="370" font-size="14" fill="#374151" font-family="Arial">
      SVG (Placeholder)
    </text>

    <text x="600" y="420" font-size="14" font-weight="bold" fill="#6b7280" font-family="Arial">
      TAMAÑO:
    </text>
    <text x="740" y="420" font-size="14" fill="#374151" font-family="Arial">
      2.4 KB
    </text>

    <!-- Progress Bar -->
    <line x1="60" y1="480" x2="1140" y2="480" stroke="#e5e7eb" stroke-width="1"/>
    <rect x="60" y="520" width="1080" height="8" fill="#f3f4f6" rx="4"/>
    <rect x="60" y="520" width="${360 + (num % 720)}" height="8" fill="${color}" rx="4"/>
    <text x="60" y="560" font-size="12" fill="#9ca3af" font-family="Arial">
      Progreso: ${Math.floor(Math.random() * 100) + 50}%
    </text>
  </g>

  <!-- Footer -->
  <rect x="40" y="730" width="1120" height="30" fill="${color}" opacity="0.05" rx="4"/>
  <text x="60" y="752" font-size="12" fill="#9ca3af" font-family="Arial">
    Pruebas María 2.0 · Evidence Placeholder #${num}
  </text>
</svg>`;

  return svg;
}

async function main() {
  const outputDir = path.join(__dirname, '..', 'public', 'evidence-placeholder');

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate 50 unique images
  console.log('🎨 Generating 50 unique evidence images...\n');

  for (let i = 1; i <= 50; i++) {
    const svg = generateUniqueSVG(i);
    const filename = `evidence-${i}.svg`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, svg);

    if (i % 10 === 0) {
      console.log(`✅ Generated ${i}/50...`);
    }
  }

  console.log(`\n✨ Generated 50 unique SVG images`);
  console.log(`📁 Location: ${outputDir}`);
  console.log(`\n📊 Distribution: 204 findings / 50 images = ~4 findings per image`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
