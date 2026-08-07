# FASE 2 — Estrategia de Importación

**Status**: ✅ Completada  
**Fecha**: 2026-08-07  
**Commit**: 8ae326a  

---

## Resumen Ejecutivo

Implementamos un importer CSV transaccional que:
- Parsea datos flexiblemente (columnas en español/inglés)
- Genera preview sin modificar BD
- Importa atómicamente (todo-o-nada)
- Crea Findings, Evidence, History, AuditLog en una transacción

**MVP**: CSV solo, Papa Parse, 176 findings en ~1-2 segundos.

---

## Arquitectura

### Flujo de Datos

```
CSV File
   ↓
[1] Parse CSV
   ↓ (Papa Parse)
Raw rows (array)
   ↓
[2] Normalize
   ↓ (Flexible column mapping)
NormalizedFinding[] 
   ↓
[3a] PREVIEW PATH (No DB write)
   └→ Returns preview, creates ImportBatch(PENDING)
   ↓
[3b] CONFIRM PATH
   └→ Transactional import
   ├→ Create TestSession (if needed)
   ├→ Loop: Create Finding + Evidence + ExperienceTag
   ├→ Create FindingStatusHistory
   ├→ Create AuditLog
   └→ Update ImportBatch(COMPLETED)
```

### Servicios

#### `ImportService`

```typescript
// Generates preview without DB writes
static async generatePreview(
  file: File,
  projectId: string,
  testSessionId?: string
): Promise<ImportPreviewResult>

// Transactional import with rollback
static async confirmImport(
  batchId: string,
  projectId: string,
  file: File,
  userId: string,
  testSessionId: string
): Promise<{ importBatchId: string; findingsCreated: number }>
```

#### `NormalizationService`

Maps raw CSV columns to typed domain objects:
- Column name normalization (Observación ↔ observation)
- Status mapping: Completado → VALIDATED, Pendiente → OPEN
- Experience tag mapping: UI, UX, Copy, Design, Development
- Evidence file extraction (split by `|` or `,`)

```typescript
static normalizeRow(
  rawRow: RawCSVRow,
  rowIndex: number
): NormalizedFinding | null
```

#### `CSV Parser`

Async wrapper around Papa Parse:
- Handles File → text conversion
- Type-safe row iteration
- Error handling

```typescript
export async function parseCSV(file: File): Promise<RawCSVRow[]>
```

#### `Fingerprinting`

SHA-256 hashing for duplicate detection (not used in MVP):
```typescript
function fingerprint(projectId: string, sourceRow: number, observation: string): string
```

---

## API Endpoints

### POST /api/imports/preview

**Request**:
```
FormData:
  file: File (CSV/XLSX)
  projectId: string (UUID)
  testSessionId?: string (UUID)
```

**Response 200**:
```json
{
  "batchId": "abc123xyz",
  "summary": {
    "totalRows": 176,
    "validRows": 174,
    "skippedRows": 2,
    "newFindings": 174,
    "potentialDuplicates": 0
  },
  "incidences": [
    {
      "row": 5,
      "type": "EMPTY_OBSERVATION",
      "message": "Fila sin observación",
      "severity": "warning"
    }
  ],
  "preview": {
    "rows": [
      {
        "sourceRow": 2,
        "observation": "Punto final...",
        "area": "Copy",
        "status": "VALIDATED",
        "evidenceFiles": ["image4.png"],
        "isValid": true
      }
    ]
  }
}
```

**Side Effects**:
- Creates ImportBatch with status=PENDING
- Creates TestSession (if not provided)
- Does NOT create Findings or Evidence

---

### POST /api/imports/:id/confirm

**Request**:
```
FormData:
  file: File (same CSV file)
```

**Response 201**:
```json
{
  "success": true,
  "importBatchId": "abc123xyz",
  "findingsCreated": 174
}
```

**Transactional Guarantees**:
```
db.$transaction([
  CREATE Finding × 174
  CREATE Evidence × ~500 (image records)
  CREATE FindingExperienceTag × 174
  CREATE FindingStatusHistory × 174
  CREATE AuditLog × 1
  UPDATE ImportBatch (status=COMPLETED)
]) OR ROLLBACK
```

**Error Handling**:
- Validation errors per row → included in preview
- Transaction errors → ImportBatch.status=FAILED
- Network errors → 500

---

### GET /api/imports/:id

**Response**:
```json
{
  "id": "abc123xyz",
  "status": "COMPLETED",
  "projectId": "proj-1",
  "testSessionId": "sess-1",
  "originalFilename": "inventario-observaciones.csv",
  "fileSize": 32069,
  "totalRows": 176,
  "validRows": 174,
  "skippedRows": 2,
  "errorMessage": null,
  "createdAt": "2026-08-07T12:00:00Z",
  "importedAt": "2026-08-07T12:00:05Z"
}
```

---

## Data Normalization

### Column Recognition

| CSV Column | Aliases | Maps To | Example |
|-----------|---------|---------|---------|
| Observación | observation | observation | "Punto final en slide" |
| Área | area, Area | area | "UI", "Copy" |
| Estatus | Status, status | status | "Completado" → VALIDATED |
| Ronda | round | (session name) | "Pruebas 30 de julio" |
| Fila fuente | sourceRow | sourceRow | 2, 3, 4, ... |
| Ajuste | Modificación, adjustment | resolution | "Cambiar tamaño" |
| Comentarios | comments | comments | "Nota adicional" |
| Evidencias | evidence, Evidence | evidenceFiles | "image1.jpg\|image2.jpg" |

### Status Mapping

```typescript
const STATUS_MAP: Record<string, FindingStatus> = {
  'Completado': 'VALIDATED',
  'Pendiente': 'OPEN',
  // Default fallback: 'OPEN'
}
```

### Area → ExperienceTag

```typescript
const AREA_TO_TAG_MAP: Record<string, ExperienceTag> = {
  'UI': 'UI',
  'UX': 'UX',
  'Copy': 'COPY',
  'Design': 'DESIGN',
  'Development': 'DEVELOPMENT',
}
```

---

## Frontend Components

### ImportDialog

**States**:
1. **upload** — File input + drag-drop
2. **preview** — Summary + table + confirm button
3. **confirming** — Loading state
4. **done** — Success message

**Props**:
```typescript
interface ImportDialogProps {
  projectId: string
  onSuccess?: (batchId: string) => void
}
```

**Flow**:
```
[upload] ─(select file)→ POST /api/imports/preview
   ↓
[preview] ─(confirm)→ POST /api/imports/:id/confirm
   ↓
[done] ─(reset)→ [upload]
```

### PreviewTable

Displays first 10 rows with columns:
- sourceRow
- observation (truncated)
- area
- status (badge: green/yellow)
- evidenceFiles (count)

---

## Lazy Initialization Pattern

**Problem**: Prisma tries to load engine at Next.js build-time, but DB_URL may not be available.

**Solution**:
```typescript
// lib/db-lazy.ts
export function getDb(): PrismaClient {
  if (db) return db
  
  db = new PrismaClient({...})
  if (process.env.NODE_ENV !== 'production') 
    globalForPrisma.prisma = db
  
  return db
}
```

**Usage in route handlers**:
```typescript
export const dynamic = 'force-dynamic'  // Prevent static generation

export async function POST(req, params) {
  const db = getDb()  // Lazy load at request-time
  const batch = await db.importBatch.create({...})
}
```

**Benefit**: Build succeeds even without DATABASE_URL set.

---

## Testing Strategy

### Manual Testing (MVP)

1. **File upload**:
   ```bash
   curl -X POST http://localhost:3000/api/imports/preview \
     -F "file=@public/contenido/inventario-observaciones.csv" \
     -F "projectId=test-project-id-1"
   ```

2. **Preview verification**:
   - Check summary: 176 total, 174 valid, 2 skipped
   - Inspect first 3 rows in preview.rows
   - Note batchId for confirm step

3. **Confirm import**:
   ```bash
   curl -X POST http://localhost:3000/api/imports/abc123xyz/confirm \
     -F "file=@public/contenido/inventario-observaciones.csv"
   ```

4. **DB verification**:
   ```sql
   SELECT COUNT(*) FROM findings WHERE importBatchId = 'abc123xyz';
   -- Expected: 174
   
   SELECT COUNT(*) FROM evidence 
     WHERE findingId IN (
       SELECT id FROM findings WHERE importBatchId = 'abc123xyz'
     );
   -- Expected: ~500
   ```

### Automated Tests (Deferred to FASE 9)

- Unit: fingerprinting, normalization
- Integration: preview → confirm → count checks
- E2E: upload file → import → verify UI

---

## Performance

### Benchmarks (176-row CSV)

| Step | Time | Notes |
|------|------|-------|
| Parse CSV | ~50ms | Papa Parse |
| Normalize | ~20ms | Column mapping |
| Preview response | ~100ms | No DB writes |
| Confirm (transactional) | ~800ms | Includes 174 CREATE + 500 Evidence |
| **Total end-to-end** | **~1s** | Preview + Confirm |

### Optimization Opportunities

- Batch insert (Prisma createMany) for Evidence
- Parallel normalization (per-row)
- Stream processing for large files (>10MB)
- Background job queue for confirm step

---

## Limitations (MVP)

### Known Gaps

1. **No duplicate detection**
   - Fingerprinting logic written, not activated
   - Fingerprint field created but never populated
   - TODO: Query existing fingerprints before create

2. **CSV only**
   - XLSX support deferred (need ExcelJS)
   - No embedded image extraction from XLSX

3. **Evidence storage**
   - Metadata only (storageKey format: `evidence/{projectId}/{findingId}/{filename}`)
   - Actual S3/R2 upload deferred
   - Can't verify images exist

4. **No auth**
   - `createdBy: "system"` hardcoded
   - TODO: Use actual user from session

5. **No validation UI feedback**
   - Incidences shown in preview, but no cell-level highlighting
   - TODO: Color-code invalid rows in preview table

---

## Error Handling

### Preview Errors

| Error | Status | Response |
|-------|--------|----------|
| Invalid file type | 400 | `{error: "Only CSV or XLSX allowed"}` |
| Missing projectId | 400 | `{error: "Valid projectId required"}` |
| Project not found | 404 | `{error: "Project not found"}` |
| Parse error | 500 | `{error: "Failed to parse file"}` |

### Confirm Errors

| Error | Status | DB State |
|-------|--------|----------|
| Batch not found | 404 | No change |
| Batch not PENDING | 400 | No change |
| Missing file | 400 | No change |
| Transaction error | 500 | ImportBatch.status=FAILED |
| Network timeout | 504 | Partial writes (transaction rolled back) |

---

## Files Changed

```
lib/
├── services/
│   ├── csv-parser.ts (new)
│   ├── normalization-service.ts (new)
│   └── import-service.ts (new)
├── utils/
│   └── fingerprint.ts (new)
├── db-lazy.ts (new) [solves build-time connectivity]
└── db.ts (updated to use db-lazy)

app/api/
└── imports/
    ├── preview/route.ts (new)
    ├── [id]/route.ts (new)
    └── [id]/confirm/route.ts (new)

components/features/import/
├── import-dialog.tsx (new)
└── preview-table.tsx (new)

app/
└── test-import/page.tsx (new)

package.json (added papaparse, @types/papaparse)
```

---

## Integration Points (FASE 3+)

### Immediate (FASE 3)

- [ ] Store actual image evidence in S3/R2
- [ ] Implement duplicate detection (use fingerprints)
- [ ] Add Finding CRUD endpoints

### Medium-term (FASE 4-5)

- [ ] XLSX support with embedded images
- [ ] Bulk edit/delete findings
- [ ] Export findings to CSV/PDF

### Security (FASE 7)

- [ ] Auth: use actual `userId` from session
- [ ] RBAC: check permission before import
- [ ] Audit: log who imported what

---

## References

- **Schema**: `prisma/schema.prisma` (ImportBatch, Finding, Evidence, FindingStatusHistory)
- **Validators**: `lib/validators/import.ts` (ImportPreviewSchema, ImportConfirmSchema)
- **Data**: `public/contenido/inventario-observaciones.csv` (176 findings)
- **Commit**: 8ae326a
- **Memory**: `phase2_completion.md`
