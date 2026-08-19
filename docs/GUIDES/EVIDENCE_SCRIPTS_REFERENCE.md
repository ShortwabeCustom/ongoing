# Evidence Scripts Reference

**Guía técnica de scripts de evidencias y sincronización**

---

## 📚 Índice de Scripts

### Fase 1: Creación Inicial
- [load-evidence-batch.ts](#load-evidence-batchtst)
- [bulk-create-evidence.ts](#bulk-create-evidencetst)
- [generate-evidence-images.ts](#generate-evidence-imagestst)
- [generate-unique-evidence-images.ts](#generate-unique-evidence-imagestst)

### Fase 2: Actualización de URLs
- [update-evidence-urls.ts](#update-evidence-urlstst)
- [redistribute-evidence-urls.ts](#redistribute-evidence-urlstst)
- [update-to-real-evidence.ts](#update-to-real-evidencetst)

### Fase 3: Extracción del Excel
- [extract-images-from-excel.ts](#extract-images-from-exceltst)
- [inspect-excel-structure.ts](#inspect-excel-structuretst)

### Fase 4: Sincronización
- [sync-evidence-status-from-excel.ts](#sync-evidence-status-from-exceltst)

### Verificación
- [verify-all-evidence.ts](#verify-all-evidencetst)
- [verify-status-sync.ts](#verify-status-synctst)

### Plantilla (R2)
- [upload-evidence-to-r2.ts](#upload-evidence-to-r2ts)

---

## load-evidence-batch.ts

**Propósito**: Crear y verificar 6 registros de evidence iniciales

**Ubicación**: `scripts/load-evidence-batch.ts`

**Modos de uso**:
```bash
# Modo dry-run: Verifica que los 6 hallazgos existen
npx tsx scripts/load-evidence-batch.ts --dry-run

# Modo mock: Crea 6 registros de Evidence
npx tsx scripts/load-evidence-batch.ts --mock

# Modo verify: Muestra evidence en BD
npx tsx scripts/load-evidence-batch.ts --verify
```

**Parámetros creados**:
```typescript
{
  type: 'IMAGE',
  storageKey: 'findings/{findingId}/mock-evidence.jpg',
  url: null,  // Sin URL en modo mock
  caption: 'descripción',
  createdBy: 'system-user-id'
}
```

**Salida**:
```
✅ Found: 6/6 findings
✅ Created: 6 evidence records
📄 Report: evidence-load-*.json
```

---

## bulk-create-evidence.ts

**Propósito**: Crear evidencias para ALL hallazgos sin evidence (198 adicionales)

**Ubicación**: `scripts/bulk-create-evidence.ts`

**Uso**:
```bash
export $(grep -v '^#' .env.local | xargs)
npx tsx scripts/bulk-create-evidence.ts
```

**Lógica**:
```
1. Query: Hallazgos SIN evidence (evidence: { none: {} })
2. Para cada hallazgo:
   - Genera mock URL: /evidence-placeholder/evidence-[n].svg
   - Crea Evidence record
   - Vincula a Finding via findingId
3. Batch size: Procesa 500+ hallazgos
```

**Resultado**:
```
Found 198 findings without evidence
Created 198 evidence records
Errors: 0
```

---

## generate-evidence-images.ts

**Propósito**: Generar 6 imágenes SVG placeholder iniciales

**Ubicación**: `scripts/generate-evidence-images.ts`

**Uso**:
```bash
npx tsx scripts/generate-evidence-images.ts
```

**Salida**:
```
/public/evidence-placeholder/
├── evidence-1.svg (2.4 KB)
├── evidence-2.svg (2.4 KB)
├── ...
└── evidence-6.svg (2.4 KB)
```

**Contenido SVG**:
- Header con color único por imagen
- Número de evidencia
- Metadata: hoja, fila, tipo
- Barra de progreso

---

## generate-unique-evidence-images.ts

**Propósito**: Generar 50 imágenes SVG con variantes únicas

**Ubicación**: `scripts/generate-unique-evidence-images.ts`

**Uso**:
```bash
npx tsx scripts/generate-unique-evidence-images.ts
```

**Parámetros**:
- Genera: 50 imágenes
- Distribución: 204 hallazgos / 50 imágenes = ~4 hallazgos por imagen
- Colores: 50 variantes únicas

**Salida**:
```
Generated 50/50 images
Location: /public/evidence-placeholder/
Distribution: 204 findings / 50 images
```

---

## update-evidence-urls.ts

**Propósito**: Actualizar URLs de Evidence de mock a URLs específicas

**Ubicación**: `scripts/update-evidence-urls.ts`

**Uso**:
```bash
export $(grep -v '^#' .env.local | xargs)
npx tsx scripts/update-evidence-urls.ts
```

**Cambios**:
```
Para cada Evidence:
  - Obtiene: URL antigua
  - Actualiza: URL nueva (/evidence-placeholder/evidence-[n].svg)
  - Vincula: Automáticamente a Finding
```

**Parámetros actualizados**:
- `url`: Nueva URL pública
- `originalFilename`: Nombre del archivo
- `caption`: Descripción

---

## redistribute-evidence-urls.ts

**Propósito**: Redistribuir URLs entre N imágenes diferentes

**Ubicación**: `scripts/redistribute-evidence-urls.ts`

**Uso**:
```bash
export $(grep -v '^#' .env.local | xargs)
npx tsx scripts/redistribute-evidence-urls.ts
```

**Algoritmo**:
```typescript
for (let i = 0; i < allEvidence.length; i++) {
  const imageNum = (i % 50) + 1;  // Cicla entre 1-50
  const newUrl = `/evidence-placeholder/evidence-${imageNum}.svg`;
  // Update...
}
```

---

## extract-images-from-excel.ts

**Propósito**: Extraer 206 imágenes PNG reales del archivo Excel

**Ubicación**: `scripts/extract-images-from-excel.ts`

**Requisitos**:
```bash
npm install adm-zip --legacy-peer-deps
```

**Uso**:
```bash
npx tsx scripts/extract-images-from-excel.ts
```

**Proceso**:
```
1. Lee: Pruebas Maria 2.0 (hoy).xlsx
2. Descomprime: ZIP (Excel es formato comprimido)
3. Busca: xl/media/ directory
4. Filtra: Archivos PNG/JPG/GIF
5. Extrae: /public/evidence-from-excel/
```

**Resultado**:
```
📂 Reading Excel: .../Pruebas Maria 2.0 (hoy).xlsx
✅ Extracted: image-1.png (470 KB)
✅ Extracted: image-2.png (478 KB)
...
✅ Total: 206 images extracted
```

**Tipos soportados**:
- .png, .jpg, .jpeg, .gif, .bmp, .webp

---

## inspect-excel-structure.ts

**Propósito**: Analizar estructura del Excel (debug)

**Ubicación**: `scripts/inspect-excel-structure.ts`

**Uso**:
```bash
npx tsx scripts/inspect-excel-structure.ts
```

**Salida**:
```
📋 Sheet: Pruebas 30 de julio
   Columns: 5
   Rows: 115

   Header columns:
      Col 2: Observación
      Col 3: Evidencia
      Col 4: Ajuste
      Col 5: Comentarios

   Row 2:
      Col 1 (boolean): true  ← CHECKMARK
      Col 2 (string): "Punto final en el segundo slide"
```

**Detecta**: Estructura, tipos de datos, checkmarks

---

## update-to-real-evidence.ts

**Propósito**: Actualizar 204 Evidence a imágenes reales del Excel

**Ubicación**: `scripts/update-to-real-evidence.ts`

**Uso**:
```bash
export $(grep -v '^#' .env.local | xargs)
npx tsx scripts/update-to-real-evidence.ts
```

**Cambios**:
```
Antes:  /evidence-placeholder/evidence-[1-50].svg (mock)
Después: /evidence-from-excel/image-[1-206].png (real)
```

**Distribución**:
- 206 imágenes
- 204 hallazgos
- Cicla: (i % 206) + 1

**Parámetros actualizados**:
```typescript
{
  url: '/evidence-from-excel/image-N.png',
  originalFilename: 'image-N.png',
  mimeType: 'image/png'
}
```

---

## sync-evidence-status-from-excel.ts

**Propósito**: Leer checkmarks del Excel y actualizar status de hallazgos

**Ubicación**: `scripts/sync-evidence-status-from-excel.ts`

**Uso**:
```bash
export $(grep -v '^#' .env.local | xargs)
npx tsx scripts/sync-evidence-status-from-excel.ts
```

**Lógica**:
```
1. Lee: Pruebas Maria 2.0 (hoy).xlsx
2. Escanea: Col 1 = boolean true (checkmark)
3. Busca: Hallazgo por (sourceSheet, sourceRow)
4. Valida: Status = OPEN
5. Actualiza: Status → VALIDATED
6. Registra: Encontrados, actualizados, no encontrados
```

**Resultado**:
```
📊 Found 88 rows with checkmarks
✅ Status updated: 83
⚠️  Not found in DB: 5
❌ Errors: 0
✨ Findings updated to: VALIDATED
```

**Estados FindingStatus**:
```
OPEN                 (inicial)
TRIAGED              (triado)
IN_PROGRESS          (en progreso)
READY_FOR_VALIDATION (listo para validar)
VALIDATED            (← USADO) ✓
CLOSED               (cerrado)
BLOCKED              (bloqueado)
REOPENED             (reabierto)
```

---

## verify-all-evidence.ts

**Propósito**: Verificar cobertura de evidence en todos los hallazgos

**Ubicación**: `scripts/verify-all-evidence.ts`

**Uso**:
```bash
export $(grep -v '^#' .env.local | xargs)
npx tsx scripts/verify-all-evidence.ts
```

**Salida**:
```
📊 EVIDENCE COVERAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Total Findings: 204
✅ Findings with Evidence: 204
✅ Total Evidence Records: 204
✅ Coverage: 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## verify-status-sync.ts

**Propósito**: Verificar sincronización de estados

**Ubicación**: `scripts/verify-status-sync.ts`

**Uso**:
```bash
export $(grep -v '^#' .env.local | xargs)
npx tsx scripts/verify-status-sync.ts
```

**Salida**:
```
📊 FINDINGS BY STATUS

  VALIDATED            : 83
  OPEN                 : 121
  
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total: 204
  ✅ Validated: 83 / 204 (41%)
```

---

## upload-evidence-to-r2.ts

**Propósito**: Plantilla para subir evidencias a Cloudflare R2

**Ubicación**: `scripts/upload-evidence-to-r2.ts`

**Status**: Template (en espera de credenciales R2)

**Requisitos**:
```
S3_ENDPOINT="https://*.r2.cloudflarestorage.com"
S3_BUCKET="pruebas-maria-evidence"
S3_ACCESS_KEY_ID="***"
S3_SECRET_ACCESS_KEY="***"
```

**Uso (cuando esté configurado)**:
```bash
export $(grep -v '^#' .env.local | xargs)
npx tsx scripts/upload-evidence-to-r2.ts
```

**Proceso**:
```
1. Inicializa: S3Client con Cloudflare endpoint
2. Sube: Archivos a R2
3. Genera: Signed URLs (24h expiry)
4. Actualiza: Evidence records en BD
5. Verifica: HTTP 200 en objetos
```

---

## 🔄 Flujo de Ejecución Recomendado

### Primer setup (Imágenes del Excel)
```bash
# 1. Extraer imágenes
npx tsx scripts/extract-images-from-excel.ts

# 2. Crear evidence records
npx tsx scripts/bulk-create-evidence.ts

# 3. Actualizar URLs
npx tsx scripts/update-to-real-evidence.ts

# 4. Sincronizar estados
npx tsx scripts/sync-evidence-status-from-excel.ts

# 5. Verificar todo
npx tsx scripts/verify-all-evidence.ts
npx tsx scripts/verify-status-sync.ts
```

### Post-deployment
```bash
# 1. Rebuild y restart
npm run build
pm2 restart uix

# 2. Verificar imágenes sirviendo
curl -s http://localhost:3000/evidence-from-excel/image-1.png | head -c 100

# 3. Auditoría
npx tsx scripts/verify-all-evidence.ts
npx tsx scripts/verify-status-sync.ts
```

---

## 📊 Estadísticas de Datos

### Imágenes Extraídas
```
Total: 206 PNG files
Tamaño: ~25 MB total
Rango: 7 KB - 1.5 MB por imagen
Ubicación: /public/evidence-from-excel/
```

### Evidence Records
```
Total: 204
Con URL: 204 (100%)
MIME type: image/png
Storage: Public /public/ directory
```

### Sincronización de Estado
```
Checkmarks encontrados: 88
Hallazgos validados: 83 (94.3%)
No encontrados: 5 (5.7%)
Tasa de completación: 41%
```

---

## 🐛 Troubleshooting

### Error: adm-zip not found
```bash
npm install adm-zip --legacy-peer-deps
```

### Error: DATABASE_URL not set
```bash
export $(grep -v '^#' .env.local | xargs)
npx tsx scripts/nombre.ts
```

### Error: Invalid FindingStatus
Valores válidos:
```
OPEN, TRIAGED, IN_PROGRESS, READY_FOR_VALIDATION, 
VALIDATED, CLOSED, BLOCKED, REOPENED
```

### Imágenes no se sirven (HTTP 404)
```bash
# Rebuildar y reiniciar
npm run build
pm2 restart uix

# Verificar files existen
ls -la /public/evidence-from-excel/
```

---

## 📚 Referencias

- [SESSION_2_EVIDENCE_LOADING.md](../SESSIONS/SESSION_2_EVIDENCE_LOADING.md) - Resumen de sesión
- [08-evidence-upload-guide.md](../backend/08-evidence-upload-guide.md) - Evidence API
- [ecosystem.config.js](../../ecosystem.config.js) - PM2 config
- `.env.local` - Environment variables

---

**Última actualización**: 2026-08-14  
**Scripts totales**: 12  
**Coverage**: 100% de hallazgos ✅
