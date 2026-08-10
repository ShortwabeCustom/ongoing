# FASE 8 ENTRY POINT — PWA + Offline Sync (After RBAC Setup)

**Status**: ✅ FASE 7 RBAC integrated | ⏳ FASE 8 ready to start

---

## What Was Done (This Session)

### RBAC Integration Complete
RBAC enforcement added to 5 critical endpoints:

| Endpoint | Method | Roles | User Tracking |
|----------|--------|-------|---|
| /api/findings/[id] | PATCH | OWNER, QA_LEAD | ✅ user.id |
| /api/findings/[id] | DELETE | OWNER, QA_LEAD | ✅ user.id |
| /api/evidence/upload | POST | CREATE_FINDING | ✅ user.id |
| /api/findings/[id]/resolutions | POST | CREATE_RESOLUTION | ✅ user.id |
| /api/findings/[id]/resolutions/[resId] | PATCH | CHANGE_RESOLUTION_STATE | ✅ user.id |

**Files modified:**
- `app/api/findings/[id]/route.ts` (PATCH + DELETE)
- `app/api/evidence/upload/route.ts` (POST)
- `app/api/findings/[id]/resolutions/route.ts` (POST)
- `app/api/findings/[id]/resolutions/[resId]/route.ts` (PATCH)

**Script added:**
- `scripts/seed-users.ts` — Creates 6 test users with different roles

---

## Prerequisites Before Testing

### 1. Install Auth Dependencies
```bash
npm install lucia @lucia-auth/adapter-prisma @node-rs/argon2 oslo cookie --legacy-peer-deps
```

### 2. Apply Database Migration
```bash
export DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
npx prisma migrate dev
npx prisma generate
```

### 3. Create Test Users
```bash
npx ts-node scripts/seed-users.ts
```

This creates 6 users with password `TestPassword123`:
- `owner@test.local` (OWNER)
- `qa-lead@test.local` (QA_LEAD)
- `designer@test.local` (DESIGNER)
- `developer@test.local` (DEVELOPER)
- `business@test.local` (BUSINESS_REVIEWER)
- `viewer@test.local` (VIEWER)

---

## Testing RBAC (After Setup)

### 1. Login as OWNER
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@test.local","password":"TestPassword123"}'
```

Response will include session cookie.

### 2. Test Protected Endpoints
```bash
# Should succeed (OWNER has EDIT_FINDING_ANY)
curl -X PATCH http://localhost:3000/api/findings/[finding-id] \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_session=..." \
  -d '{"status":"IN_PROGRESS","version":1}'

# Should fail with 403 (VIEWER cannot edit)
curl -X PATCH http://localhost:3000/api/findings/[finding-id] \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_session=..." \
  -d '{"status":"IN_PROGRESS","version":1}'
```

---

## FASE 8: PWA & Offline Sync

Ready to start when you need. Architecture:

### Service Worker (`public/sw.js`)
- Install event: cache critical assets
- Fetch event: network-first for API, cache-first for assets
- Sync event: process queued changes when online

### Offline Storage (IndexedDB)
- `findings_cache` — Cached findings list
- `sync_queue` — Pending API calls (updates, deletes, uploads)
- `metadata` — Last sync timestamp, connection status

### Frontend Changes
- `lib/hooks/useOfflineSync.ts` — Manages sync queue
- `components/ui/OfflineIndicator.tsx` — Shows connection status
- `lib/services/offline-sync-service.ts` — Handles queued operations

### API Changes (Idempotency)
- All mutations require `idempotencyKey` header
- Deduplicate concurrent requests with same key

---

## Current Architecture Summary

```
FASE 1-7: ✅ Complete
├─ Data Model (13 Prisma models)
├─ CSV Import (endpoints + UI)
├─ Finding CRUD (6 endpoints + filters)
├─ Evidence Storage (R2 + signed URLs)
├─ Evidence UI (7 React components)
├─ Workflows (8 endpoints, 5 components)
└─ Auth & RBAC (9 endpoints, 4 components) ← Just integrated

FASE 8: ⏳ Next (PWA + Offline)
├─ Service Worker
├─ IndexedDB cache
├─ Sync queue
└─ Offline indicators

FASE 9: 📋 After (Hardening)
├─ Test coverage
├─ Security audit
└─ Production docs
```

---

## Next Session Quick Start

1. **Setup** (5 min):
   ```bash
   npm install lucia @lucia-auth/adapter-prisma @node-rs/argon2 oslo cookie --legacy-peer-deps
   npx prisma migrate dev
   npx ts-node scripts/seed-users.ts
   npm run dev
   ```

2. **Test RBAC** (5 min):
   - Login with test users
   - Verify 403 errors for unauthorized roles
   - Check user.id in audit trail

3. **Start FASE 8** (2-3 hrs):
   - Build Service Worker
   - Implement IndexedDB sync
   - Add offline indicators
   - Test offline → online transitions

---

## Files Reference

**Auth System**: `docs/backend/09-fase7-auth-guide.md` (4000+ words)  
**RBAC Matrix**: `lib/middleware/rbac.ts` (permissions defined)  
**Completion**: `FASE7_COMPLETION.md` (previous summary)

---

**Status**: FASE 7 RBAC ✅ | Ready for FASE 8 dependencies ⏳
