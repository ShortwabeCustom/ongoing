# Storage Architecture — FASE 4

**Last Updated**: 2026-08-07  
**Status**: ✅ Implementation Complete

## Overview

FASE 4 adds persistent cloud storage for Finding evidence (images, documents) using Cloudflare R2 with secure, time-limited access via pre-signed URLs.

### Key Features

- ✅ Evidence file upload to R2 (S3-compatible)
- ✅ Automatic file type and size validation
- ✅ Pre-signed URL generation (24-hour default expiry)
- ✅ Evidence metadata management (PATCH caption)
- ✅ Secure file deletion from storage and database
- ✅ Manual URL refresh endpoint for expired URLs
- ✅ Integration with Finding GET (fresh URLs automatically)

---

## Architecture Decisions

### Storage Provider: Cloudflare R2

**Why R2 over S3?**
- **Cost**: 50% cheaper ($0.015/GB vs $0.023/GB)
- **Simplicity**: S3-compatible API, minimal setup
- **Performance**: DDoS protection, edge locations included
- **Trade-off**: Slightly less documentation than S3, but covers MVP needs

**Configuration**:
```env
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_BUCKET="pruebas-maria-evidence"
S3_ACCESS_KEY_ID="<R2 API token>"
S3_SECRET_ACCESS_KEY="<R2 API secret>"
S3_SIGNED_URL_EXPIRY="86400"  # 24 hours
```

### Pre-Signed URLs

**Why pre-signed URLs?**
- Client downloads directly from R2 (reduces API load)
- Time-limited access (secure)
- No need for proxy endpoint
- Works with CDN (R2 has built-in edge caching)

**Expiry Strategy**:
- Default: 24 hours (balance between security and convenience)
- Client can refresh before expiry via `POST /api/evidence/:id/refresh-url`
- Automatic refresh on Finding GET (URL always fresh)

### File Organization

**Storage Structure**:
```
findings/
├── {findingId}/
│   ├── {evidenceId}/
│   │   └── {originalFilename}
```

**Example**:
```
findings/f1abc2def3ghi4jkl5m/e1evidence1idevi1d/screenshot.jpg
```

**Benefits**:
- Hierarchical (easy to query by finding)
- Evidence ID as intermediate folder (supports future grouping)
- Original filename preserved (user-friendly downloads)
- Collision-proof (CUID + nanoid)

---

## Database Model

### Evidence Table

The `Evidence` model in Prisma already has all required fields:

```prisma
model Evidence {
  id                String    @id @default(cuid())
  findingId         String
  finding           Finding   @relation(fields: [findingId], references: [id], onDelete: Cascade)

  type              EvidenceType
  storageKey        String        // S3 path: findings/{findingId}/{evidenceId}/{filename}
  url               String?       // Pre-signed URL (updated on refresh)
  originalFilename  String        // User-provided filename
  mimeType          String        // e.g., "image/jpeg"
  fileSize          Int?          // Bytes
  caption           String?       // User description (max 500 chars)

  createdBy         String
  creator           User          @relation(fields: [createdBy], references: [id])
  createdAt         DateTime      @default(now())

  @@index([findingId])
  @@index([createdBy])
  @@map("evidence")
}

enum EvidenceType {
  IMAGE
  VIDEO
  DOCUMENT
  FIGMA_URL
  EXTERNAL_URL
}
```

---

## Implementation Details

### File Constraints

| Constraint | Value | Notes |
|-----------|-------|-------|
| Max file size | 10 MB | Configurable via env |
| Allowed types | JPEG, PNG, WebP, PDF | Extensible in `STORAGE_CONFIG` |
| Allowed extensions | .jpg, .jpeg, .png, .webp, .pdf | Validated against MIME type |

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `FILE_TOO_LARGE` | 413 | File exceeds 10 MB |
| `INVALID_FILE_TYPE` | 415 | MIME type not in allowed list |
| `NOT_FOUND` | 404 | Evidence or Finding not found |
| `MISSING_FILE` | 400 | No file in multipart request |
| `MISSING_FINDING_ID` | 400 | Finding ID not provided |

---

## API Endpoints

### 1. Upload Evidence

**POST** `/api/evidence/upload`

```bash
curl -X POST http://localhost:3000/api/evidence/upload \
  -F "file=@screenshot.jpg" \
  -F "findingId=f1abc2def3ghi4jkl5m" \
  -F "caption=Login button in dark mode"
```

**Response** `201 Created`:
```json
{
  "id": "e1evidence1idevi1d",
  "findingId": "f1abc2def3ghi4jkl5m",
  "originalFilename": "screenshot.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 245120,
  "storageKey": "findings/f1abc2def3ghi4jkl5m/e1evidence1idevi1d/screenshot.jpg",
  "url": "https://r2-cdn.example.com/...?X-Amz-Signature=...",
  "urlExpiresAt": "2026-08-08T22:00:00Z",
  "caption": "Login button in dark mode",
  "uploadedAt": "2026-08-07T22:00:00Z",
  "uploadedBy": "system"
}
```

### 2. Get Finding with Fresh URLs

**GET** `/api/findings/:id`

Evidence objects now include fresh signed URLs:

```json
{
  "id": "f1abc2def3ghi4jkl5m",
  "evidence": [
    {
      "id": "e1evidence1idevi1d",
      "originalFilename": "screenshot.jpg",
      "mimeType": "image/jpeg",
      "fileSize": 245120,
      "url": "https://r2-cdn.example.com/...?X-Amz-Signature=...",
      "urlExpiresAt": "2026-08-08T22:00:00Z",
      "caption": "Login button in dark mode",
      "uploadedAt": "2026-08-07T10:30:00Z"
    }
  ]
}
```

### 3. Update Evidence Metadata

**PATCH** `/api/evidence/:id`

```bash
curl -X PATCH http://localhost:3000/api/evidence/e1evidence1idevi1d \
  -H "Content-Type: application/json" \
  -d '{"caption": "New caption text"}'
```

**Response** `200 OK`:
```json
{
  "id": "e1evidence1idevi1d",
  "caption": "New caption text",
  "updatedAt": "2026-08-07T22:15:00Z"
}
```

### 4. Delete Evidence

**DELETE** `/api/evidence/:id`

```bash
curl -X DELETE http://localhost:3000/api/evidence/e1evidence1idevi1d
```

**Response** `204 No Content`

Deletes both:
- File from R2 storage
- Evidence record from database

### 5. Refresh Signed URL

**POST** `/api/evidence/:id/refresh-url`

```bash
curl -X POST http://localhost:3000/api/evidence/e1evidence1idevi1d/refresh-url
```

**Response** `200 OK`:
```json
{
  "id": "e1evidence1idevi1d",
  "url": "https://r2-cdn.example.com/...?X-Amz-Signature=...",
  "urlExpiresAt": "2026-08-08T23:00:00Z"
}
```

---

## Code Structure

### R2 Client Layer

**`lib/storage/r2-client.ts`**
- Singleton S3 client initialization
- Low-level operations: `uploadFile()`, `deleteFile()`, `generateSignedUrl()`
- Handles AWS SDK v3 lifecycle

**`lib/storage/storage-config.ts`**
- Configuration constants (max size, allowed types, bucket name)
- Helper methods (`isAllowedType()`, `getStorageKey()`)

### Service Layer

**`lib/services/storage-service.ts`**
- High-level file operations
- Handles validation, error recovery, transaction safety
- Methods:
  - `uploadFile()` — Upload + DB record creation
  - `deleteEvidence()` — Delete from R2 and DB
  - `refreshSignedUrl()` — Generate fresh URL
  - `updateEvidence()` — Metadata-only updates
  - `getEvidenceWithUrl()` — Fetch with fresh URL

### API Layer

**`app/api/evidence/upload/route.ts`**
- Multipart form-data handling
- File type/size validation
- Error responses (413, 415, 400, 404)

**`app/api/evidence/[id]/route.ts`**
- PATCH: Update metadata
- DELETE: Remove evidence

**`app/api/evidence/[id]/refresh-url/route.ts`**
- Generate fresh signed URL

---

## Integration Points

### With Finding Service

**`FindingService.getFindingWithSignedUrls()`**
- Wrapper around `getFinding()` that regenerates URLs
- Called by `GET /api/findings/:id` endpoint
- Ensures URLs are always fresh when fetching findings

### With Importer (FASE 2)

Currently, Evidence records are created during import with `null` URLs.

**Future Enhancement**:
- During import confirmation, upload files to R2
- Populate `storageKey` and `url` fields
- Avoid manual upload step for imported evidence

---

## Security Considerations

### What's Protected

✅ **Authentication** — Currently mocked as "system" (FASE 7 auth will restrict access)
✅ **Authorization** — Evidence tied to Finding (same access rules)
✅ **Data** — Files signed with R2 API credentials (time-limited)
✅ **Transport** — HTTPS/TLS (R2 enforces)

### What's Not (Yet)

❌ **Virus scanning** — No antivirus integration
❌ **Image optimization** — No resizing/compression
❌ **DLP** — No data loss prevention policies
❌ **Audit logging** — No file download tracking (FASE 9+)

### Recommended Future Hardening

1. **Add antivirus scanning** (ClamAV or third-party API)
2. **Image optimization** (resize large images to prevent abuse)
3. **Audit logging** (track who downloads what, when)
4. **Rate limiting** (prevent enumeration attacks)
5. **CORS hardening** (restrict domains for signed URLs)

---

## Testing Checklist

- [x] Upload valid file (JPEG, PNG, WebP, PDF)
- [x] Reject oversized file (>10 MB)
- [x] Reject invalid MIME type (.exe, .zip, etc)
- [x] Update caption on existing evidence
- [x] Delete evidence (remove from R2 and DB)
- [x] Refresh signed URL
- [x] GET Finding includes fresh URLs
- [x] Build succeeds with strict TypeScript

---

## Known Limitations

1. **No auto-delete**: R2 doesn't auto-delete when Evidence record is deleted (requires cleanup job)
2. **No versioning**: Overwriting same filename doesn't preserve history
3. **No compression**: Large PDFs not optimized before upload
4. **No previews**: Images not pre-generated for thumbnails

**Mitigation**: These are FASE 5+ enhancements, not MVP blockers.

---

## Migration Path from FASE 3 → FASE 4

**No breaking changes**:
- Finding GET still returns `evidence` array
- New fields: `fileSize`, `urlExpiresAt`, `uploadedAt`
- Old Evidence records (created in FASE 2 import) have `url: null` (safe)
- New uploads populate `url` immediately

**Gradual adoption**:
1. Existing findings work as-is (no URLs)
2. New uploads get URLs automatically
3. Refresh endpoint available for manual updates
4. No forced migration of old evidence

---

## Environment Setup

### R2 Account Requirements

1. Create Cloudflare R2 account: https://dash.cloudflare.com/
2. Create new bucket: `pruebas-maria-evidence`
3. Generate API token:
   - Account → R2 → Create Token
   - Permissions: Read + Write (object:list, object:read, object:write)
   - TTL: No expiration (or long-lived for API use)
4. Copy endpoint, access key, secret to `.env.local`

### .env Configuration

```bash
# Copy these from R2 console
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_BUCKET="pruebas-maria-evidence"
S3_ACCESS_KEY_ID="<token-access-key>"
S3_SECRET_ACCESS_KEY="<token-secret>"
S3_SIGNED_URL_EXPIRY="86400"  # 24 hours
```

### Verify Connection

```bash
# Test R2 credentials in route handler
curl http://localhost:3000/api/evidence/upload \
  -F "file=@test.jpg" \
  -F "findingId=test" \
  # Should return 404 (finding not found) not 401 (auth failure)
```

---

## Performance Notes

### Latency

- Upload: ~200ms (network) + ~100ms (DB write) = ~300ms
- GET Finding: +~300ms (parallel URL generation for each evidence)
- Delete: ~200ms (parallel R2 + DB delete)

### Optimization Opportunities

1. **Batch uploads**: Implement bulk evidence upload endpoint
2. **CDN caching**: Cache signed URLs for common findings
3. **Lazy URL generation**: Only generate on-demand (trades freshness for speed)
4. **Thumbnail generation**: Pre-generate image previews

---

## Roadmap

**FASE 5** — Frontend (display evidence in Finding UI)
**FASE 6** — Image optimization (resize, compress)
**FASE 7** — Auth (enforce user permissions on evidence)
**FASE 8** — Cleanup jobs (orphaned R2 files)
**FASE 9** — Audit logging (track downloads, antivirus scanning)

---

**Next**: FASE 5 — Frontend components for evidence display and upload UI
