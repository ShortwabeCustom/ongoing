---
title: Dynamic Report Changelog
purpose: Changes from Session 5: static app.html → live database queries
---

# Changelog — Dynamic Public Report (Session 6)

**Date**: 2026-08-13  
**Version**: FASE 14 + Dynamic Public Report  
**Status**: ✅ Production Live

---

## Summary

Converted static public report from hardcoded snapshot (176 findings, Aug 5) to dynamic, real-time view of findings database. Now reflects 195 findings (176 legacy + 19 XLSX imports) with live stats updated every 3 minutes via ISR caching.

---

## Files Changed

### New Files

- **`app/api/public/report/route.ts`** (120 lines)
  - New public GET endpoint (no auth required)
  - Returns JSON: stats, rounds, 195 findings with metadata
  - Revalidate: 180s ISR + Cache-Control headers
  - Response time: ~100-200ms (cache miss), ~10ms (cache hit)

### Modified Files

- **`lib/services/storage-service.ts`** (1 line)
  - Export `isLegacyStorageKey()` helper (was private)
  - Allows public report endpoint to distinguish legacy evidence URLs

- **`public/app.html`** (1843 lines → 1843 lines, 1 change set)
  - Rename filter IIFE to named function `initFindingsFilters()`
  - Add new render script with `renderReport()` and async fetch logic
  - On load: fetch `/api/public/report` and populate dynamic data
  - On failure: keep static 176 findings as fallback
  - Call `initFindingsFilters()` after render (solves event ordering)

---

## Data Changes

### Before (Static HTML, Aug 5)

```
observations: 176
completed: 82
pending: 94
evidence: 173
rounds: 4 (hardcoded: 30-jul, 31-jul, 03-ago, 04-05-ago)
```

### After (Dynamic from DB, Aug 13)

```
observations: 195       (+19 XLSX imports)
completed: 83          (+1)
pending: 112           (+18)
evidence: 198          (+25)
rounds: 1              (real TestSession: "Import histórico PWA legacy")
cache: 180s ISR        (auto-revalidate every 3 minutes)
```

---

## Architecture

```
GET https://uix.productdesign.mx/
  ├─ Nginx → localhost:3000
  ├─ Next.js rewrite: / → /app.html (unchanged)
  ├─ Load 159KB HTML + CSS + JS (static, 1843 lines)
  ├─ Run client-side script:
  │  ├─ Detect DOMContentLoaded
  │  ├─ Fetch /api/public/report (async, no block)
  │  ├─ On success: renderReport(data)
  │  │  ├─ Update .stats (hero 4 tiles)
  │  │  ├─ Update .insight-grid (insight cards)
  │  │  ├─ Update #f-ronda options (from rounds array)
  │  │  ├─ Update #f-status counts
  │  │  └─ Rebuild <main class="list"> with 195 <details> blocks
  │  ├─ Call initFindingsFilters() (initialize filter listeners)
  │  └─ On error: log warning, keep static data, still init filters
  │
  └─ GET /api/public/report (route: app/api/public/report/route.ts)
     ├─ No auth (public endpoint)
     ├─ Parallel Prisma queries:
     │  ├─ COUNT findings (total, completed, pending)
     │  ├─ COUNT evidence
     │  ├─ FIND testSessions with counts
     │  └─ FIND findings (195) with incidenceTypes + evidence
     ├─ Calculate percentages
     ├─ Build response JSON
     └─ Return with Cache-Control: max-age=180, stale-while-revalidate=60
```

---

## Performance

| Metric | Value |
|--------|-------|
| Build Time | 23.6s |
| Endpoint (cache hit) | ~10ms |
| Endpoint (cache miss) | ~150ms |
| Page Load Time | ~1.5s |
| Memory Usage | 174.6mb |
| Uptime (post-deploy) | 4+ minutes stable |

---

## Testing

✅ **Manual verification** (2026-08-13 00:54:00 UTC):
- Health endpoint: `healthy` (49ms latency)
- Public report endpoint: 195 findings returned
- Stats: 195 obs, 83 completed, 112 pending, 198 evidence
- Cache headers: `public, max-age=180, stale-while-revalidate=60`
- Evidence images: 200 OK (`/images/image*.jpg`)
- PM2 app: online, PID 29734
- Page load: no console errors

---

## Deployment

**Script used**: `bash scripts/deploy-pm2.sh`

**Steps**:
1. ✅ Stop app
2. ✅ Install dependencies
3. ✅ Generate Prisma client
4. ✅ Build Next.js (23.6s)
5. ✅ Apply migrations (0 pending)
6. ✅ Restart app
7. ✅ Save PM2 list

**Result**: ✅ Online (PID 29734) since 00:47:00 UTC

---

## Commit

**Hash**: `a7f0e9b`  
**Message**: `feat(report): Make public findings section dynamic from live database`

```
Replace static 176 hardcoded findings with live data fetched from PostgreSQL:
- New GET /api/public/report endpoint (180s cache, no auth required)
- Fetches stats (195 observations, 83 completed, 112 pending, 198 evidence)
- Dynamically populates 4 stat tiles, findings list, Ronda filter, and evidence links
- Preserves exact HTML/CSS structure of public/app.html for visual parity
- Falls back gracefully to static data if endpoint unavailable
- Renders 195 findings (176 legacy + 19 new XLSX imports) in correct order

Numbers change from hardcoded (176/82/94/173) to real DB state (195/83/112/198),
matching the private /findings dashboard. Ronda filter now shows real TestSessions
(currently 1: "Import histórico PWA legacy") instead of frozen 4-round snapshot.
```

---

## Related Issues / Links

- **PHASE 14**: `/docs/PHASES/FASE_14.md` (context)
- **Full Documentation**: `/docs/DYNAMIC_PUBLIC_REPORT.md`
- **Deployment Guide**: `/docs/final_deployment_guide.md`
- **GitHub Repo**: https://github.com/ShortwabeCustom/ongoing

---

## Breaking Changes

❌ **None**. This is additive:
- ✅ Public page (`/`) still renders identically (same HTML, CSS, structure)
- ✅ Static 176 findings still embedded as fallback
- ✅ Private app (`/findings`, `/dashboard`) completely untouched
- ✅ RBAC, auth, permissions unchanged
- ✅ Database schema unchanged

---

## Migration Notes

**For Future Developers**:

1. **Endpoint is read-only**: GET only, no mutations. Safe to call from client.
2. **Cache behavior**: Changes visible 3+ minutes later (ISR window). If urgent, restart PM2.
3. **Evidence URLs**: Mixed format (legacy `/images/*.jpg` and future S3 signed URLs).
4. **Rounds filter**: Now dynamic from `TestSession` rows. Hardcoded 4-round taxonomy removed.
5. **No auth required**: Endpoint is intentionally public. Do not add auth without discussion.

---

## Next Steps (Future)

- [ ] Add `/api/public/report` to OpenAPI/Swagger docs
- [ ] Implement rate limiting if traffic spikes
- [ ] Add monitoring/metrics to endpoint
- [ ] Write integration tests
- [ ] Consider CDN edge caching

---

**Status**: ✅ Production Ready  
**Last Updated**: 2026-08-13 00:54:00 UTC  
**Deployed By**: Claude Haiku 4.5
