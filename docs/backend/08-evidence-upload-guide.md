# Evidence Upload Guide — FASE 4

**Quick Reference**: How to upload, manage, and retrieve evidence files via API

---

## Setup

### Environment

Create `.env.local` with R2 credentials:

```bash
S3_ENDPOINT="https://abc123.r2.cloudflarestorage.com"
S3_BUCKET="pruebas-maria-evidence"
S3_ACCESS_KEY_ID="your_token_access_key"
S3_SECRET_ACCESS_KEY="your_token_secret"
S3_SIGNED_URL_EXPIRY="86400"
```

### Dependencies

```bash
pnpm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner nanoid
```

---

## Usage Examples

### 1. Upload an Evidence File

**Scenario**: User takes a screenshot of a bug and uploads it to a finding.

```bash
# Variables
FINDING_ID="f1abc2def3ghi4jkl5m"
FILE_PATH="./screenshot.jpg"
CAPTION="Login button broken in dark mode"

# Upload
curl -X POST http://localhost:3000/api/evidence/upload \
  -F "file=@${FILE_PATH}" \
  -F "findingId=${FINDING_ID}" \
  -F "caption=${CAPTION}"
```

**Response** (201 Created):
```json
{
  "id": "e1evidence1idevi1d",
  "findingId": "f1abc2def3ghi4jkl5m",
  "originalFilename": "screenshot.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 245120,
  "storageKey": "findings/f1abc2def3ghi4jkl5m/e1evidence1idevi1d/screenshot.jpg",
  "url": "https://abc123.r2.cloudflarestorage.com/findings/f1abc2def3ghi4jkl5m/e1evidence1idevi1d/screenshot.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
  "urlExpiresAt": "2026-08-08T22:00:00Z",
  "caption": "Login button broken in dark mode",
  "uploadedAt": "2026-08-07T22:00:00Z",
  "uploadedBy": "system"
}
```

**Save the `id`** for future operations (delete, update, refresh-url).

---

### 2. Get Finding with Evidence URLs

**Scenario**: Display a finding with all its evidence photos.

```bash
FINDING_ID="f1abc2def3ghi4jkl5m"

curl -X GET http://localhost:3000/api/findings/${FINDING_ID}
```

**Response** (200 OK):
```json
{
  "id": "f1abc2def3ghi4jkl5m",
  "observation": "Login button is not clickable",
  "status": "OPEN",
  "priority": "HIGH",
  "evidence": [
    {
      "id": "e1evidence1idevi1d",
      "originalFilename": "screenshot.jpg",
      "mimeType": "image/jpeg",
      "fileSize": 245120,
      "url": "https://abc123.r2.cloudflarestorage.com/...",
      "urlExpiresAt": "2026-08-08T22:00:00Z",
      "caption": "Login button broken in dark mode",
      "uploadedAt": "2026-08-07T10:30:00Z"
    },
    {
      "id": "e2evidence2idevi2d",
      "originalFilename": "console_error.pdf",
      "mimeType": "application/pdf",
      "fileSize": 120000,
      "url": "https://abc123.r2.cloudflarestorage.com/...",
      "urlExpiresAt": "2026-08-08T22:00:00Z",
      "caption": "Console error log",
      "uploadedAt": "2026-08-07T11:00:00Z"
    }
  ]
}
```

**Use the `url` field** to display the image or download the file in your UI.

---

### 3. Update Evidence Caption

**Scenario**: User wants to add more context to an uploaded screenshot.

```bash
EVIDENCE_ID="e1evidence1idevi1d"
NEW_CAPTION="Login button unresponsive when clicking rapidly"

curl -X PATCH http://localhost:3000/api/evidence/${EVIDENCE_ID} \
  -H "Content-Type: application/json" \
  -d "{\"caption\": \"${NEW_CAPTION}\"}"
```

**Response** (200 OK):
```json
{
  "id": "e1evidence1idevi1d",
  "caption": "Login button unresponsive when clicking rapidly",
  "updatedAt": "2026-08-07T22:15:00Z"
}
```

---

### 4. Delete Evidence

**Scenario**: User accidentally uploads the wrong file, needs to delete it.

```bash
EVIDENCE_ID="e1evidence1idevi1d"

curl -X DELETE http://localhost:3000/api/evidence/${EVIDENCE_ID}
```

**Response** (204 No Content)

This:
1. Deletes the file from R2
2. Removes the Evidence record from the database

No future requests to this evidence ID will work.

---

### 5. Refresh Signed URL

**Scenario**: Evidence URL is about to expire (or already expired). Get a fresh one.

```bash
EVIDENCE_ID="e1evidence1idevi1d"

curl -X POST http://localhost:3000/api/evidence/${EVIDENCE_ID}/refresh-url
```

**Response** (200 OK):
```json
{
  "id": "e1evidence1idevi1d",
  "url": "https://abc123.r2.cloudflarestorage.com/findings/f1abc2def3ghi4jkl5m/e1evidence1idevi1d/screenshot.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=... (new signature)",
  "urlExpiresAt": "2026-08-08T23:00:00Z"
}
```

**Note**: This is called automatically when you `GET /api/findings/:id`, so most users don't need to call this manually.

---

## Error Handling

### File Too Large

```bash
curl -X POST http://localhost:3000/api/evidence/upload \
  -F "file=@huge_file_50mb.jpg" \
  -F "findingId=f1abc2def3ghi4jkl5m"
```

**Response** (413 Payload Too Large):
```json
{
  "code": "FILE_TOO_LARGE",
  "message": "File exceeds maximum size of 10MB"
}
```

---

### Invalid File Type

```bash
curl -X POST http://localhost:3000/api/evidence/upload \
  -F "file=@virus.exe" \
  -F "findingId=f1abc2def3ghi4jkl5m"
```

**Response** (415 Unsupported Media Type):
```json
{
  "code": "INVALID_FILE_TYPE",
  "message": "File type application/octet-stream not supported. Supported: image/jpeg, image/png, image/webp, application/pdf"
}
```

---

### Finding Not Found

```bash
curl -X POST http://localhost:3000/api/evidence/upload \
  -F "file=@screenshot.jpg" \
  -F "findingId=nonexistent"
```

**Response** (404 Not Found):
```json
{
  "code": "NOT_FOUND",
  "message": "Finding not found"
}
```

---

### Evidence Not Found

```bash
curl -X DELETE http://localhost:3000/api/evidence/nonexistent
```

**Response** (404 Not Found):
```json
{
  "code": "NOT_FOUND",
  "message": "Evidence not found"
}
```

---

## Frontend Integration (Upcoming)

When FASE 5 is implemented, you'll have React components like:

```jsx
<UploadButton findingId={findingId} onSuccess={refreshEvidence} />
<EvidenceGallery evidence={finding.evidence} />
<EvidenceCard evidence={evidence} onDelete={deleteEvidence} />
```

For now, these examples work against the REST API directly.

---

## Client Library Example (JavaScript/TypeScript)

```typescript
// lib/api/evidence-client.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export class EvidenceClient {
  static async upload(
    file: File,
    findingId: string,
    caption?: string,
  ) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('findingId', findingId)
    if (caption) formData.append('caption', caption)

    const res = await fetch(`${API_URL}/api/evidence/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return res.json()
  }

  static async updateCaption(evidenceId: string, caption: string) {
    const res = await fetch(`${API_URL}/api/evidence/${evidenceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    })

    if (!res.ok) throw new Error(`Update failed: ${res.status}`)
    return res.json()
  }

  static async delete(evidenceId: string) {
    const res = await fetch(`${API_URL}/api/evidence/${evidenceId}`, {
      method: 'DELETE',
    })

    if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
    return null
  }

  static async refreshUrl(evidenceId: string) {
    const res = await fetch(`${API_URL}/api/evidence/${evidenceId}/refresh-url`, {
      method: 'POST',
    })

    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`)
    return res.json()
  }
}
```

**Usage**:
```typescript
const evidence = await EvidenceClient.upload(file, findingId, 'Screenshot')
await EvidenceClient.updateCaption(evidence.id, 'New caption')
await EvidenceClient.delete(evidence.id)
const refreshed = await EvidenceClient.refreshUrl(evidence.id)
```

---

## Performance Tips

### Handling Large Uploads

For files approaching 10 MB, consider:

1. **Compress before upload**:
   ```typescript
   // Use sharp or similar
   const compressed = await sharp(file).resize(1920, 1080).toBuffer()
   ```

2. **Monitor upload progress**:
   ```typescript
   const xhr = new XMLHttpRequest()
   xhr.upload.addEventListener('progress', (e) => {
     console.log(`Uploaded ${e.loaded}/${e.total} bytes`)
   })
   ```

### URL Expiry Management

- Default expiry: 24 hours
- Check `urlExpiresAt` before using URL
- Call `/refresh-url` if within 1 hour of expiry
- Automatic refresh on `GET /findings/:id`

---

## Limits & Constraints

| Constraint | Value | Notes |
|-----------|-------|-------|
| Max file size | 10 MB | Change in `.env` or `storage-config.ts` |
| Allowed types | JPEG, PNG, WebP, PDF | Add more MIME types in `STORAGE_CONFIG.ALLOWED_TYPES` |
| Max evidence per finding | Unlimited | R2 bucket size is limit |
| URL expiry | 24 hours | Configure via `S3_SIGNED_URL_EXPIRY` |
| Concurrent uploads | Limited by server | Rate limiting (FASE 9) |

---

## Troubleshooting

### "R2 credentials not configured"

**Error**: `Error: R2 credentials not configured in environment`

**Fix**: Add to `.env.local`:
```bash
S3_ENDPOINT="https://your-account.r2.cloudflarestorage.com"
S3_ACCESS_KEY_ID="your_token_key"
S3_SECRET_ACCESS_KEY="your_token_secret"
```

### "File exceeds maximum size"

**Error**: `FILE_TOO_LARGE`

**Fix**:
- Compress image before upload (use `sharp`)
- Or increase limit in `.env`: `S3_MAX_FILE_SIZE_MB=25`
- Or request IT to increase storage tier

### "URL returns 403 Forbidden"

**Cause**: Pre-signed URL expired (default 24h)

**Fix**: Call `POST /api/evidence/:id/refresh-url` to get fresh URL

### "File appears but no URL"

**Cause**: File uploaded during FASE 2 import (before FASE 4)

**Fix**: Call `POST /api/evidence/:id/refresh-url` once to generate initial URL

---

## Next Steps (FASE 5)

- Upload UI component (React)
- Image gallery component
- Drag-and-drop upload
- Progress bar
- Thumbnail generation
- Bulk delete
- Evidence tagging

---

**More Info**: See [Storage Architecture](./07-storage-architecture.md)
