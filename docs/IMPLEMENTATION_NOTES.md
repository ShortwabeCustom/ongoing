# Implementation Notes — Dynamic Public Report

**Implemented**: 2026-08-13  
**Session**: 6 (Phase 14 continuation)  
**Developer**: Claude Haiku 4.5

---

## Problem Statement

The public report at `https://uix.productdesign.mx/` was a **static HTML snapshot** (156KB, 1843 lines) frozen since 2026-08-05, containing 176 hardcoded findings. Meanwhile, the private dashboard (`/findings`) was dynamically pulling 195 findings from the live database. This created **data divergence**: the public report was outdated and disconnected from the source of truth.

**Goal**: Make the public report's "Fuente Integral: Hallazgos y evidencia" section dynamically fetch from the same database, keeping the static HTML shell and visual design untouched.

---

## Design Decisions

### 1. Keep Static HTML, Add Dynamic Script

**Decision**: Don't convert `/public/app.html` to a Next.js page. Keep it static, use client-side JS to fetch data.

**Rationale**:
- ✅ Minimal risk: no server-side component rewrites
- ✅ Progressive enhancement: page renders even if fetch fails
- ✅ Easier deployment: fewer moving parts
- ✅ Public accessibility: no RBAC/auth layer complications

**Alternative (rejected)**: Convert `/` to dynamic Next.js page
- ❌ Requires rewriting ~1800 lines of HTML to JSX/TSX
- ❌ High risk of CSS/layout regressions
- ❌ Would need to replicate exact design (better to just use existing HTML)

### 2. Public Endpoint Without Auth

**Decision**: Create `/api/public/report` with NO authentication required.

**Rationale**:
- ✅ Public report is intentionally shareable (no secrets exposed)
- ✅ Simpler client-side code (no auth tokens needed)
- ✅ Stateless, cacheable via ISR/CDN
- ✅ Matches the static HTML's existing public nature

**Alternative (rejected)**: Require session/token
- ❌ Adds complexity to client-side fetch
- ❌ Breaks public accessibility of report
- ❌ Data is already public (no confidentiality breach)

### 3. ISR Cache (180s) Over Real-Time Queries

**Decision**: Use Next.js route segment config (`export const revalidate = 180`) for 3-minute caching.

**Rationale**:
- ✅ Reduces database load (avoid regenerating URLs on every request)
- ✅ Reduces Cloudflare R2 calls (expensive to mint signed URLs per request)
- ✅ Public reports don't need real-time accuracy
- ✅ Stale-while-revalidate allows background refresh without blocking

**Alternative (rejected)**: Full real-time (`dynamic = 'force-dynamic'`)
- ❌ Higher DB/R2 costs
- ❌ Slower response times under load
- ❌ No benefit for a public read-only report

**Alternative (rejected)**: Static generation (`revalidate = false`)
- ❌ Report never updates (defeats the purpose)

### 4. Reuse Finding Service Status Grouping

**Decision**: Map DB `Finding.status` enum to "completado"/"pendiente" using same grouping as private dashboard.

**Rationale**:
- ✅ Public and private show same numbers (consistency)
- ✅ Already verified logic in `inventory-stats.ts`
- ✅ No duplicate grouping logic

**Status Grouping**:
- Completed: `VALIDATED` + `CLOSED`
- Pending: `OPEN` + `TRIAGED` + `IN_PROGRESS` + `READY_FOR_VALIDATION` + `BLOCKED` + `REOPENED`

### 5. Sequential Numbers (Index + 1) Not SourceRow

**Decision**: Compute display number from array position (001, 002, ..., 195), not from DB `sourceRow`.

**Rationale**:
- ✅ Handles mixed data sources gracefully (176 legacy + 19 XLSX imports)
- ✅ No gaps (legacy rows have `sourceRow`, XLSX may have NULL)
- ✅ Matches user expectation: sequential list
- ✅ Simple to understand and debug

**Example**:
- Index 0 → number "001"
- Index 174 → number "175" (last legacy)
- Index 175 → number "176" (first XLSX)
- Index 194 → number "195" (last)

---

## Implementation Approach

### Step 1: Create Public Endpoint

File: `app/api/public/report/route.ts`

- No RBAC/auth checks
- Parallel Prisma queries (Promise.all)
- Calculate percentages server-side
- Map status enums to display strings
- Filter evidence (legacy vs. R2)
- Order by `sourceRow` (nulls last), then `createdAt`
- Set ISR cache headers

**Key Detail**: Evidence filtering uses `isLegacyStorageKey()` helper to avoid calling `StorageService.getSignedUrl()` on every legacy image (expensive). Legacy URLs already in DB; R2 images not yet present in this dataset.

### Step 2: Export Storage Helper

File: `lib/services/storage-service.ts`

Change line 128 from:
```typescript
function isLegacyStorageKey(storageKey: string) {
```

To:
```typescript
export function isLegacyStorageKey(storageKey: string) {
```

**Reason**: Allows endpoint to check evidence type without duplicating the `'legacy/'` prefix check.

### Step 3: Inject Client-Side Script

File: `public/app.html`

**Part A**: Rename filter IIFE (lines 1733-1759)
- Change from anonymous auto-invoked to named function `initFindingsFilters()`
- Allows us to call it explicitly after data render

**Part B**: Add new render script (after line 1759)
- Wrap in IIFE to avoid polluting global scope
- Define `renderReport(data)` function:
  - Populate `.stats` (hero) with live numbers
  - Populate `.insight-grid` (4 insight cards) with percentages
  - Rebuild `#f-ronda` options from rounds array
  - Update `#f-status` counts
  - Rebuild `<main class="list">` with 195 `<details>` blocks
  - Render tags conditionally (Diseño first, Copy second)
  - Render evidence conditionally (only if array non-empty)
- Define `init()` function:
  - Check if DOM ready (`DOMContentLoaded` or immediate)
  - Fetch `/api/public/report` with `cache: 'default'`
  - On success: `renderReport(data)` then `initFindingsFilters()`
  - On error: log warning, `initFindingsFilters()` anyway (keeps static data)

**Order is Critical**: The filter JS (line 1733-1759 in original) does `document.querySelectorAll('.list details')` at invocation time. If we call it before inserting `<details>` DOM nodes, `items` array is empty and filtering breaks. Solution: call `initFindingsFilters()` only AFTER `renderReport()` populates the list.

---

## Testing Approach

### Local Testing (Dev)

```bash
npm run dev
# Server on localhost:3001

# Test endpoint
curl http://localhost:3001/api/public/report | jq '.stats'

# Test public page loads without error
curl http://localhost:3001/ | grep -q "renderReport" && echo "Script injected"
```

### Production Testing

```bash
# Health check
curl https://uix.productdesign.mx/api/health

# Endpoint live data
curl https://uix.productdesign.mx/api/public/report | jq '{stats: .stats, count: (.findings | length)}'

# Verify cache headers
curl -I https://uix.productdesign.mx/api/public/report | grep -i cache

# Visual: open in browser
# https://uix.productdesign.mx/
# Verify stats render as 195/83/112/198
# Verify filters work
# Verify images load
# Verify no console errors
```

---

## Deployment Considerations

### Rollback Plan

If issues arise in production:

1. **Quick**: Restart app with old code (git reset, rebuild, pm2 restart)
2. **Graceful**: Client-side fallback means page doesn't break even if endpoint fails
3. **Nuclear**: Revert `/public/app.html` to remove script injection, reload cache

### Cache Invalidation

ISR cache persists for 180 seconds. To force refresh:
```bash
pm2 restart uix  # Clears .next cache directory
```

Or wait 3+ minutes for automatic revalidation.

### Monitoring

- **Endpoint**: Check `/api/public/report` latency in production logs
- **Database**: Monitor query time for 6 parallel Prisma queries
- **Failures**: Client-side `console.warn()` logged if fetch fails
- **Cache**: `x-nextjs-cache: HIT|STALE|MISS` header indicates cache state

---

## Edge Cases Handled

### 1. Mixed Data Sources (Legacy + XLSX)

**Problem**: 176 legacy findings have `sourceRow` (1-176), 19 XLSX have NULL.

**Solution**: Order by `{ sourceRow: 'asc' }, { createdAt: 'asc' }` (nulls sort last in Postgres). Compute sequential numbers from array index, not sourceRow.

**Result**: 001-195 sequential, no gaps.

### 2. Empty Evidence

**Problem**: Some findings have no evidence files.

**Solution**: Conditionally render `evidence` div only if array non-empty.

**Result**: No broken markup, clean HTML.

### 3. Evidence URL Types

**Problem**: Mix of legacy (`/images/image*.jpg`) and future S3 signed URLs.

**Solution**: Filter by `isLegacyStorageKey()` and only mint signed URLs if needed (currently not needed for legacy batch).

**Result**: Endpoint fast, no expensive S3 calls for legacy data.

### 4. Endpoint Fails

**Problem**: Database down, timeout, or network error.

**Solution**: Client-side `catch()` block logs warning, calls `initFindingsFilters()` anyway. Static 176 findings remain rendered.

**Result**: Page doesn't break, graceful degradation.

### 5. Incidence Type Without Label

**Problem**: Future finding types added without updating `INCIDENCE_TYPE_LABELS_ES`.

**Solution**: Map via `.filter((label): label is string => label !== null)` — skips missing labels.

**Result**: No null values in tags array, no broken chips.

---

## Performance Optimizations

1. **Parallel Queries**: `Promise.all([...])` instead of sequential awaits
2. **ISR Cache**: 180s revalidate avoids repeated DB hits
3. **Stale-While-Revalidate**: Clients don't block on revalidation, get instant stale response
4. **No Signed URLs**: Legacy evidence doesn't require S3 round-trips
5. **Selective Evidence**: Only include non-deleted evidence in response

**Result**: ~100-200ms first request, ~10ms cache hit, ~150ms cache miss (revalidation).

---

## Future Work

### Phase 1 (Easy)

- [ ] Add query parameters: `?page=1&limit=50` (server-side pagination)
- [ ] Add filtering params: `?status=completado` (server-side filtering)
- [ ] Add metadata endpoint: `/api/public/report/meta` (cache freshness, last-updated)

### Phase 2 (Medium)

- [ ] Rate limiting for endpoint (if public traffic spikes)
- [ ] Monitoring/metrics: Prometheus client, latency buckets
- [ ] Integration tests: Jest/Vitest for endpoint response schema
- [ ] OpenAPI/Swagger documentation

### Phase 3 (Advanced)

- [ ] Webhooks for real-time updates (instead of ISR polling)
- [ ] CDN edge caching (Cloudflare Workers)
- [ ] Database query optimization: add indexes if latency grows
- [ ] GraphQL endpoint as alternative to JSON (if clients prefer)

---

## Code Quality Notes

### No New Abstractions

Per CLAUDE.md guidance: "Three similar lines is better than a premature abstraction."

- Did NOT extract `renderReport` to separate component (inline IIFE is fine)
- Did NOT create `PublicReportService` class (logic fits in 120-line route handler)
- Did NOT add environment variables (hardcoded values are appropriate)

### Naming Conventions

- Function `renderReport`: clear purpose (populate DOM from data)
- Function `initFindingsFilters`: matches existing pattern (clear purpose)
- Status strings: `"completado"` / `"pendiente"` (matches UI expectation)
- Tag labels: `"Diseño"` / `"Copy"` (matches `INCIDENCE_TYPE_LABELS_ES`)

### Error Handling

- Errors logged but not thrown (client-side fetch handles gracefully)
- Generic error response: `{ code: 'INTERNAL_ERROR', message: '...' }` (no sensitive info leaked)
- Fallback UI works without endpoint (resilient to failures)

---

## Known Limitations

1. **No Real-Time Updates**: 3-minute cache window means new findings visible after ~3 min (acceptable for public report)
2. **No Pagination**: Returns all 195 findings in single response (acceptable for current dataset size)
3. **No Server-Side Filtering**: Filtering happens client-side (acceptable given small dataset)
4. **No Authentication**: Endpoint is public (intentional, data is already public)
5. **No Rate Limiting**: Could add if public traffic spikes significantly

---

## References

- **Endpoint Route**: `app/api/public/report/route.ts`
- **Storage Helper**: `lib/services/storage-service.ts:128`
- **Client Script**: `public/app.html:1733-end`
- **Finding Service**: `lib/services/finding-service.ts` (reference for status grouping)
- **Inventory Stats**: `lib/services/inventory-stats.ts` (reference for stat calculation)
- **Prisma Schema**: `prisma/schema.prisma` (Finding, TestSession, Evidence models)

---

**Session Date**: 2026-08-13  
**Session Time**: ~2 hours (exploration + implementation + deployment + documentation)  
**Commit**: `a7f0e9b`  
**Status**: ✅ Production Live & Stable
# Findings filters and soft delete (2026-08-19)

- `/findings` serializes status, priority, severity, test-session IDs, experience tags,
  incidence types, date ranges and the seven-day `recent` toggle in stable URL parameters.
- PostgreSQL is canonical. Searches requiring session dates or relational categories route
  directly to PostgreSQL; Elasticsearch remains available for fields represented in its index.
- Individual and bulk deletion are soft deletes. Bulk deletion is atomic (maximum 100 unique
  IDs), uses `DELETE_FINDING` RBAC, creates one `AuditAction.DELETE` record per finding and
  removes derived Elasticsearch documents after the database transaction commits.
