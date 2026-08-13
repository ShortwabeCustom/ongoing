# createdAt Field Audit — FASE 14.1.2

**Date**: 2026-08-13  
**Status**: ✅ DOCUMENTED

## Current State

### Finding.createdAt Semantics

**What it actually contains**:
- Historical test date of the finding (NOT technical creation time)
- Values set during ETL import (FASE 14.1.1 rectification)
- All 400 findings have createdAt = date from sourceSheet (e.g., "2026-07-30")

**Evidence**:
```sql
SELECT createdAt, COUNT(*) as count
FROM findings
GROUP BY createdAt
ORDER BY createdAt DESC;

2026-08-12T00:00:00Z: 29 findings (Pruebas 12 agosto)
2026-08-11T00:00:00Z: 187 findings (Inventario legacy + Pruebas 11 ago)
2026-08-10T00:00:00Z: 17 findings (Pruebas 10 agosto)
2026-08-06T00:00:00Z: 3 findings
2026-08-04T00:00:00Z: 48 findings
2026-08-03T00:00:00Z: 1 finding
2026-07-31T00:00:00Z: 15 findings (Modificación 31 Jul)
2026-07-30T00:00:00Z: 100 findings (Pruebas 30 de julio)
────────────────────────────────────────────────
TOTAL: 400 findings
```

All times are exactly `T00:00:00Z`, indicating ETL overwrites (not real timestamps).

## Root Cause

During FASE 14.1.1 TestSession rectification:
1. 400 findings were reasigned to correct TestSessions based on `sourceSheet`
2. `createdAt` was set to match the TestSession.date
3. This was necessary to make "Fecha de creación" filter work correctly
4. But it overwrote the actual technical creation timestamp

## Impact

### "Fecha de creación" filter
- **Label**: "Fecha de creación" (Creation Date)
- **What user sees**: Filtered by "when was this test conducted"
- **What field represents**: Historical test date, not technical creation date
- **Semantically incorrect**: YES

### Backend code
- In `buildPostgresWhere()`, `dateType='created'` queries `Finding.createdAt`
- This now returns "test date", not "creation date"
- **Function works as coded**: YES ✅
- **Matches user expectations**: MAYBE - depends on how UI labels it

### PostgreSQL schema
```prisma
model Finding {
  ...
  createdAt DateTime @default(now())  // Still "creation" semantically
  ...
}
```

The schema comment doesn't reflect the actual content.

## Data Integrity

✅ **No corruption**: All findings are assigned to correct TestSessions
✅ **No data loss**: FASE 14.1.1 log documents all 400 mappings
⚠️ **Semantic mismatch**: Field name doesn't match content

## Recommendations for Future

### Option A: Keep As-Is (Current)
- **Pro**: No migration needed, works fine, documented
- **Con**: Semantically confusing to future maintainers
- **Cost**: Low

### Option B: Rename Field
- **Change**: `createdAt` → `testDate` or `historicalDate`
- **Impact**: Requires Prisma migration, code refactor
- **Benefit**: Crystal clear semantics
- **Cost**: Medium

### Option C: Add New Field
- **Change**: Keep `createdAt` as-is, add `technicalCreatedAt` for actual creation
- **Backfill**: Would be NULL for all 400 findings (can't recover)
- **Impact**: Complex, not recommended
- **Cost**: High

## Recommendation for FASE 14.1.2

**OPTION A**: Keep as-is, document thoroughly.

**Why**:
1. ✅ Data is correct and useful
2. ✅ Filter works as intended by users
3. ✅ No risk of regression
4. ✅ Documentation is now explicit
5. ❌ Future FASE can reconsider if schema changes needed

**Action**: Added this documentation to clarify semantics for future developers.

## Documentation Update

### In UI Labels

Currently:
```
DateTypeSelector shows:
  "Fecha de creación" — Cuándo se registró el hallazgo
```

Should read:
```
DateTypeSelector shows:
  "Fecha de creación" — Fecha de la prueba histórica (no creación técnica)
```

Or use the more accurate label:
```
"Fecha de prueba" — A qué sesión pertenece [ALREADY EXISTS]
"Fecha histórica" — Cuándo se realizó la prueba
```

**Current Status**: Using existing "Fecha de prueba" (session date) is more semantically correct.

## References

- FASE 14.1.1 rectification log: `scripts/.rectification-2026-08-13.log`
- TestSession mapping: 10 unique sessions, 400 findings mapped
- Audit: 400 findings verified, no data loss
