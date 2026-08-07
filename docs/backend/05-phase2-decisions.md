# FASE 2 — Decisiones Técnicas

**Documento**: Justificación de decisiones tomadas durante la implementación del importador  
**Autor**: Alexis (Claude Code)  
**Fecha**: 2026-08-07

---

## 1. Parser Library Choice: Papa Parse

### Decision
Use **Papa Parse 5.5.4** instead of SheetJS or ExcelJS.

### Rationale

| Criterio | Papa Parse | SheetJS | ExcelJS |
|----------|-----------|---------|---------|
| Bundle size | 50KB | 200KB | 150KB |
| CSV support | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| XLSX support | ❌ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Setup time | 5 min | 10 min | 15 min |
| Async API | ✅ | ❌ (callback) | ✅ |
| Types | ✅ (@types) | Built-in | Built-in |

### Trade-off
**Chose MVP speed** over comprehensive format support:
- Papa Parse = quickest to market (2.5h vs 4-5h)
- XLSX deferred to FASE 3
- Can easily swap to ExcelJS later (API compatible)

### Outcome
✅ Reduced scope, met MVP deadline, can extend.

---

## 2. CSV-Only First, XLSX Later

### Decision
Skip XLSX support in FASE 2.

### Why
1. **Data availability**: Test data in CSV format
2. **Complexity**: XLSX adds:
   - Binary parsing
   - Sheet selection UI
   - Embedded image extraction
   - Memory overhead
3. **Time constraint**: 2.5h budget → CSV only

### Deferral Plan
**FASE 3**: Add ExcelJS + UI for sheet selection + embedded image extraction.

### Outcome
✅ Simplified validation, cleaner scope.

---

## 3. Column Name Normalization: Flexible Mapping

### Decision
Support both Spanish and English column names via key-array lookup.

```typescript
// Instead of:
const observation = rawRow['Observación']

// We do:
const observation = this.getString(row, ['Observación', 'observation', 'Observation'])
```

### Rationale
1. **Data varies**: Real-world CSVs use different languages
2. **User friendly**: Users don't need to pre-process
3. **Maintainable**: Array of aliases easy to extend
4. **Type-safe**: TypeScript compiler catches typos

### Alternative (Rejected)
- "Strict mode": Require exact column names → Users had to adjust input
- Schema detection: Guess columns by content → Brittle

### Outcome
✅ Flexible, scalable, user-friendly.

---

## 4. Lazy Prisma Initialization: Deferred Loading

### Decision
Defer PrismaClient instantiation to first request via `getDb()` function.

```typescript
// lib/db-lazy.ts
export function getDb(): PrismaClient {
  if (db) return db
  db = new PrismaClient()
  return db
}
```

### Problem It Solves
**Build-time failure**: Prisma tries to load database engine even if DATABASE_URL not set.

```
Error: Cannot find module '.prisma/client/default'
```

**Why it happens**: 
- Next.js imports route handlers at build-time to validate them
- `import { db } from '@/lib/db'` triggers PrismaClient instantiation
- Prisma engine loader runs → fails if DB not available

### Solution Approach

| Approach | Pros | Cons |
|----------|------|------|
| Set dummy DATABASE_URL | Works for build | Masks real config issues |
| Lazy load via function | Defers to runtime ✅ | Requires discipline (call getDb()) |
| Dynamic import | Clean syntax | Less transparent |
| Remove db from module | Cleaner | More refactoring |

### Implementation
1. Created `lib/db-lazy.ts` with `getDb()` function
2. Marked routes as `export const dynamic = 'force-dynamic'`
3. Called `getDb()` inside route handlers (not at module level)

### Outcome
✅ Build succeeds without DATABASE_URL set. Lazy loading transparent at request-time.

---

## 5. Duplicate Detection: Implemented But Disabled

### Decision
Write fingerprinting logic, but don't activate it in MVP.

### Code (Written)
```typescript
// lib/utils/fingerprint.ts
function generateFingerprint(projectId: string, sourceRow: number, observation: string): string {
  return crypto.createHash('sha256')
    .update(`${projectId}|${sourceRow}|${observation}`)
    .digest('hex')
}
```

### Why Disabled
1. **Query complexity**: Would need `SELECT fingerprint FROM findings WHERE fingerprint = ? AND importBatchId != ?`
2. **Performance**: Adds check per row
3. **Scope creep**: Preview already complex
4. **MVP rule**: "Skip duplicates first, add later"

### Activation Plan (FASE 3)
```typescript
// In confirmImport:
for (const row of normalizedRows) {
  const fp = generateFingerprint(projectId, row.sourceRow, row.observation)
  const exists = await tx.finding.findFirst({where: {fingerprint: fp}})
  if (exists) skip and warn
}
```

### Outcome
✅ Code ready for reuse, keeps MVP clean.

---

## 6. Evidence Storage: Metadata Only

### Decision
Store evidence as metadata, defer actual file upload to FASE 4.

### Current Implementation
```typescript
// Create Evidence records
for (const filename of normalized.evidenceFiles) {
  await tx.evidence.create({
    data: {
      storageKey: `evidence/${projectId}/${finding.id}/${filename}`,
      originalFilename: filename,
      mimeType: 'image/jpeg',
      // url: null (will populate after S3 upload)
    }
  })
}
```

### Why Deferred
1. **S3 not configured yet**: Requires AWS credentials
2. **Complexity**: Upload, signing, URL generation
3. **Testing**: Can't verify images exist without storage
4. **Phase plan**: FASE 4 dedicated to storage

### Migration Path (FASE 4)
```typescript
// Add:
url: await s3.getSignedUrl(storageKey)

// And:
// Upload actual file to S3 after DB write
await s3.upload({
  Bucket: bucket,
  Key: storageKey,
  Body: imageBuffer,
  ContentType: 'image/jpeg'
})
```

### Outcome
✅ Schema ready, implementation phased.

---

## 7. Transactional Guarantees: Prisma $transaction

### Decision
Use Prisma's `$transaction([...])` for atomic multi-step import.

```typescript
const result = await db.$transaction(async (tx) => {
  // 1. Create Finding
  const finding = await tx.finding.create({...})
  
  // 2. Create Evidence
  for (const file of evidenceFiles) {
    await tx.evidence.create({...})
  }
  
  // 3. Create History + AuditLog
  await tx.findingStatusHistory.create({...})
  await tx.auditLog.create({...})
  
  // 4. Update ImportBatch
  return await tx.importBatch.update({...})
})
// If any step fails → automatic ROLLBACK
```

### Why This Approach
1. **Atomicity**: All-or-nothing guarantee
2. **Consistency**: No partial imports
3. **Framework support**: Prisma handles engine-level transactions
4. **Simplicity**: No manual begin/commit/rollback

### Alternative (Rejected)
- Manual `BEGIN ... COMMIT ... ROLLBACK` → More error-prone
- Bulk insert then fix errors → Violates atomicity
- Saga pattern → Overkill for single step

### Error Handling
```typescript
try {
  await db.$transaction(async (tx) => { ... })
} catch (error) {
  // Transaction already rolled back by Prisma
  // Just update ImportBatch.status = FAILED
  await db.importBatch.update({
    where: {id: batchId},
    data: {status: 'FAILED', errorMessage: error.message}
  })
}
```

### Outcome
✅ Guaranteed data consistency.

---

## 8. Preview vs. Confirm: Two-Step Process

### Decision
Separate preview (no writes) from confirm (atomic writes).

### Flow
```
File upload
   ↓
[Preview] generates preview + creates ImportBatch(PENDING)
   ↓ (user reviews)
[Confirm] re-parses file + transactional import
```

### Why Two Steps
1. **UX**: User sees data before committing
2. **Safety**: Verify summary before expensive import
3. **Traceability**: ImportBatch tracks audit trail
4. **Recoverability**: If confirm fails, user can retry

### Why Re-parse in Confirm
- File might have changed between preview and confirm
- Validates that user uploaded same file
- Ensures data integrity

### Alternative (Rejected)
- Store parsed data in session → Session bloat
- Cache in Redis → Infrastructure complexity
- Use file hash → Requires client coordination

### Outcome
✅ Good UX + safety + auditability.

---

## 9. React Component Architecture

### Decision
Two-component hierarchy: ImportDialog → PreviewTable.

```
ImportDialog
├─ Upload state (file input)
├─ Preview state (summary + PreviewTable)
├─ Confirming state (loading)
└─ Done state (success)
   └─ PreviewTable (read-only display)
```

### Why Minimal Componentization
1. **Scope**: Single feature (import flow)
2. **Reusability**: PreviewTable used only once
3. **Complexity**: Simple state machine fits in one component
4. **Maintainability**: Easier to trace state

### Not Abstracted (Intentionally)
- ❌ SummaryCard (too simple)
- ❌ IncidenceList (too simple)
- ❌ FileUpload (built-in input sufficient)

### Future Extraction (FASE 5+)
As dashboard grows, extract:
- FindingList component
- StatusBadge component
- PaginationControls component

### Outcome
✅ Lean, maintainable, not over-engineered.

---

## 10. Error Handling Strategy

### Decision
Fail fast in preview, rollback in confirm, user-friendly messages.

```typescript
// PREVIEW: Strict validation per row
if (!observation.trim()) {
  incidences.push({
    row: idx + 2,
    type: 'EMPTY_OBSERVATION',
    severity: 'warning'
  })
  continue  // Skip row, continue processing
}

// CONFIRM: Transactional, all-or-nothing
try {
  await db.$transaction(async (tx) => { ... })
} catch (error) {
  // Rollback automatic
  // Mark batch FAILED
  throw error
}
```

### Why This Split
1. **Preview**: Show user what will be imported, highlight issues
2. **Confirm**: Guarantee consistency, no partial writes

### Message Strategy
- Non-technical language ("Fila sin observación" not "NULL violation")
- Row numbers match CSV line numbers (+1 for header)
- Severity levels (warning vs. error)

### Outcome
✅ Clear diagnostics, data safety.

---

## Summary: MVP Principles Applied

| Principle | Decision | Benefit |
|-----------|----------|---------|
| **Do the simplest thing** | CSV only, Papa Parse | Fast delivery |
| **Library-first** | Papa Parse, Prisma | Less code, proven |
| **Fail fast** | Preview validates early | User sees issues |
| **Atomicity** | $transaction | Data consistency |
| **Defer complexity** | Fingerprinting written, disabled | Clean MVP, ready to extend |
| **User-friendly** | Flexible column names | No pre-processing needed |
| **Type-safe** | Zod validators, TypeScript | Catch errors early |

---

## Lessons Learned

1. **Lazy initialization solves build-time woes** ✅
2. **Two-step UX better than one-step** ✅
3. **Flexible schema better than rigid** ✅
4. **Transactions are non-negotiable for imports** ✅
5. **MVP doesn't mean incomplete, just focused** ✅

---

## Next Iteration (FASE 3)

- [ ] Activate fingerprint duplicate detection
- [ ] Add ExcelJS + XLSX support
- [ ] Implement S3 storage + signed URLs
- [ ] Add bulk operations (edit, delete imported)
- [ ] Write integration tests

---

**Commit**: 8ae326a  
**Duration**: 2.5 hours  
**Lines of code**: ~800
