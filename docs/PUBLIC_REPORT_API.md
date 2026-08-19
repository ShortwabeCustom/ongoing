# Public Report API Reference

**Endpoint**: `GET https://uix.productdesign.mx/api/public/report`
**Authentication**: ✅ Not required (public)  
**Cache**: ISR 180s + `Cache-Control: public, max-age=180, stale-while-revalidate=60`  
**Rate Limit**: Not yet implemented (future: add if needed)  

---

## Quick Start

### Request

```bash
curl https://uix.productdesign.mx/api/public/report
```

### Response (200 OK)

```json
{
  "stats": {
    "observations": 195,
    "completed": 83,
    "pending": 112,
    "completedPercent": 43,
    "pendingPercent": 57,
    "evidenceCount": 198
  },
  "rounds": [
    {
      "id": "cmsoc6pbq0003h1ac6hgztsda",
      "label": "Import histórico PWA legacy",
      "count": 195
    }
  ],
  "findings": [
    {
      "number": "001",
      "title": "Punto final en el segundo slide",
      "status": "completado",
      "tags": ["Copy"],
      "roundId": "cmsoc6pbq0003h1ac6hgztsda",
      "metaLine": "Import histórico PWA legacy · Fila 2 · Copy",
      "evidence": [
        {
          "url": "/images/image4.jpg",
          "filename": "image4.png"
        }
      ]
    },
    {
      "number": "002",
      "title": "Degadadado de fondo: background: var(...)",
      "status": "completado",
      "tags": ["Diseño"],
      "roundId": "cmsoc6pbq0003h1ac6hgztsda",
      "metaLine": "Import histórico PWA legacy · Fila 3 · Diseño",
      "evidence": [
        {
          "url": "/images/image3.jpg",
          "filename": "image3.png"
        }
      ]
    },
    // ... (195 findings total)
  ]
}
```

---

## Schema

### Stats Object

| Field | Type | Description |
|-------|------|-------------|
| `observations` | number | Total findings count (not deleted) |
| `completed` | number | Findings with status VALIDATED or CLOSED |
| `pending` | number | Findings with status OPEN, TRIAGED, IN_PROGRESS, READY_FOR_VALIDATION, BLOCKED, or REOPENED |
| `completedPercent` | number | Percentage: `Math.round((completed / observations) * 100)` |
| `pendingPercent` | number | Percentage: `Math.round((pending / observations) * 100)` |
| `evidenceCount` | number | Total evidence files (not deleted) |

### Round Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | TestSession ID (UUID) |
| `label` | string | TestSession name (e.g., "Import histórico PWA legacy") |
| `count` | number | Count of findings in this session |

### Finding Object

| Field | Type | Description |
|-------|------|-------------|
| `number` | string | Zero-padded sequential number (001-195) |
| `title` | string | Finding observation/description |
| `status` | enum | `"completado"` or `"pendiente"` |
| `tags` | string[] | Incidence type labels: `["Diseño"]`, `["Copy"]`, `["Diseño", "Copy"]`, or `[]` |
| `roundId` | string | TestSession ID (for filter matching) |
| `metaLine` | string | Metadata line: `"{session name} · Fila {sourceRow} · {tags}"` |
| `evidence` | object[] | Array of evidence files |
| `evidence[].url` | string | File URL (legacy: `/images/image*.jpg`, future: S3 signed URL) |
| `evidence[].filename` | string | Original filename |

---

## Usage Examples

### JavaScript (Fetch)

```javascript
async function loadPublicReport() {
  try {
    const response = await fetch('/api/public/report');
    if (!response.ok) throw new Error(response.statusText);
    
    const data = await response.json();
    console.log(`${data.stats.observations} findings`);
    console.log(`${data.stats.completed} completed (${data.stats.completedPercent}%)`);
    
    // Render stats
    document.querySelector('.observations').textContent = data.stats.observations;
    document.querySelector('.completed').textContent = data.stats.completed;
    
    // Render findings list
    const list = document.querySelector('.findings-list');
    list.innerHTML = data.findings.map(f => `
      <details data-status="${f.status}" data-ronda="${f.roundId}">
        <summary>
          <b>${f.number}</b>
          <span>${f.title}</span>
          <span class="tags">
            ${f.tags.map(t => `<i class="tag">${t}</i>`).join('')}
            <i class="${f.status === 'completado' ? 'done' : 'pending'}">
              ${f.status === 'completado' ? 'Completado' : 'Pendiente'}
            </i>
          </span>
        </summary>
        <div class="detail">
          <small>${f.metaLine}</small>
          <h2>${f.title}</h2>
          ${f.evidence.map((ev, i) => `
            <img src="${ev.url}" alt="Evidencia ${i + 1}">
          `).join('')}
        </div>
      </details>
    `).join('');
    
    return data;
  } catch (error) {
    console.error('Failed to load report:', error);
    // Fallback to static data
  }
}

document.addEventListener('DOMContentLoaded', loadPublicReport);
```

### cURL

```bash
# Get all data
curl https://uix.productdesign.mx/api/public/report | jq .

# Get only stats
curl https://uix.productdesign.mx/api/public/report | jq '.stats'

# Get findings count
curl https://uix.productdesign.mx/api/public/report | jq '.findings | length'

# Get first finding details
curl https://uix.productdesign.mx/api/public/report | jq '.findings[0]'

# Filter findings by status
curl https://uix.productdesign.mx/api/public/report | jq '.findings[] | select(.status=="completado")'
```

### Python

```python
import requests
import json

url = "https://uix.productdesign.mx/api/public/report"
response = requests.get(url)
data = response.json()

print(f"Total observations: {data['stats']['observations']}")
print(f"Completed: {data['stats']['completed']} ({data['stats']['completedPercent']}%)")
print(f"Pending: {data['stats']['pending']} ({data['stats']['pendingPercent']}%)")

# List all findings
for finding in data['findings']:
    print(f"{finding['number']}. {finding['title']} - {finding['status']}")
```

---

## Response Headers

```
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=180, stale-while-revalidate=60
X-NextJS-Cache: HIT|STALE|MISS
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=63072000
```

### Cache Header Meanings

| Header | Value | Meaning |
|--------|-------|---------|
| `X-NextJS-Cache` | HIT | Served from ISR cache (< 180s old) |
| `X-NextJS-Cache` | STALE | Revalidating in background (180s < age < 240s) |
| `X-NextJS-Cache` | MISS | Cache expired, rebuilt from DB (age > 240s) |
| `Cache-Control` | max-age=180 | Browser/CDN should cache for 180 seconds |
| `Cache-Control` | stale-while-revalidate=60 | Serve stale while revalidating in background |

---

## Data Freshness

- **Cache Hit** (< 180s): Returns pre-rendered JSON, ~10ms
- **Cache Miss** (> 180s): Queries database, ~150ms
- **Stale Window** (180-240s): Serves stale + revalidates async
- **Max Age** (> 240s): New request after stale window expires

**Best Practice**: Expect data to be 0-180 seconds old. If you need real-time data, poll with a shorter interval and handle the stale window.

---

## Status Mappings

### Finding Status

| DB Value | Display | Color (CSS) |
|----------|---------|------------|
| VALIDATED | Completado | done (green) |
| CLOSED | Completado | done (green) |
| OPEN | Pendiente | pending (orange) |
| TRIAGED | Pendiente | pending (orange) |
| IN_PROGRESS | Pendiente | pending (orange) |
| READY_FOR_VALIDATION | Pendiente | pending (orange) |
| BLOCKED | Pendiente | pending (orange) |
| REOPENED | Pendiente | pending (orange) |

### Tag Mappings

| DB Incidence Type | Display | CSS Class |
|-------------------|---------|-----------|
| DESIGN | Diseño | tag-d (dark green) |
| COPY | Copy | tag-c (green outline) |
| FUNCTIONALITY | *(not shown)* | - |
| BUSINESS_RULE | *(not shown)* | - |

---

## Error Handling

### Endpoint Errors

The endpoint should not return errors in normal operation. If it fails:

```json
{
  "code": "INTERNAL_ERROR",
  "message": "Report temporarily unavailable"
}
```

**Causes**:
- Database connection failed
- Prisma query timed out
- Server crash/restart

**Recovery**:
1. Retry after 30 seconds (ISR cache may be stale)
2. Check `https://uix.productdesign.mx/api/health` for server status
3. If repeated, contact support

### Client-Side Fallback

The public page (`/app.html`) includes fallback logic:
- Render 176 static findings if fetch fails
- Still initialize filters (no UI breakage)
- Log warning to console

---

## Implementation Details

### Source Code

- **Route Handler**: `app/api/public/report/route.ts` (120 lines)
- **Query Logic**: Uses `getDb()` → `db.finding.findMany()` with Prisma
- **Cache Config**: `export const revalidate = 180`
- **Response Headers**: Manually set in `NextResponse.json(..., { headers: {...} })`

### Database Queries

The endpoint makes 6 Prisma queries in parallel:

1. `db.finding.count({ where: { deletedAt: null } })` — total
2. `db.finding.count({ where: { deletedAt: null, status: { in: ['VALIDATED', 'CLOSED'] } } })` — completed
3. `db.finding.count({ where: { deletedAt: null, status: { in: ['OPEN', ...] } } })` — pending
4. `db.evidence.count({ where: { deletedAt: null } })` — evidence total
5. `db.testSession.findMany(...)` — rounds/sessions
6. `db.finding.findMany(...)` — all findings with relations

**Total Query Time**: ~100-200ms (cache miss)

### Security

✅ **Public endpoint** — intentionally no auth  
✅ **No secrets** — no API keys, credentials, or private data exposed  
✅ **Read-only** — GET only, no mutations  
✅ **Rate limits** — not yet implemented (add if needed)  
✅ **CORS** — follows Nginx default policy (same-origin)

---

## Troubleshooting

### "Endpoint times out"

**Cause**: Database slow or overloaded  
**Fix**:
- Check `db.finding.count(...)` query time via Prisma logs
- Check database CPU/memory via hosting provider
- Restart PM2: `pm2 restart uix`

### "Stats show old numbers"

**Cause**: Cache not expired yet (ISR revalidate = 180s)  
**Fix**:
- Wait 3+ minutes for automatic revalidation
- Or restart app to clear cache: `pm2 restart uix`

### "Evidence images 404"

**Cause**: Legacy images path wrong or S3 signed URL expired  
**Fix**:
- Legacy images: verify files in `/public/images/`
- S3 images: endpoint should mint fresh signed URLs (check code)
- Browser cache: hard-refresh Ctrl+Shift+R

---

## Future Enhancements

- [ ] Add query parameters: `/api/public/report?page=1&limit=50` (pagination)
- [ ] Add filtering: `/api/public/report?status=pendiente&round=<id>` (server-side filtering)
- [ ] Add metadata: `/api/public/report/meta` (cache freshness, timestamp)
- [ ] Add webhooks for real-time updates (instead of ISR polling)
- [ ] Add JSONP callback for CORS (if needed)

---

**Last Updated**: 2026-08-13  
**API Version**: 1.0  
**Status**: ✅ Production Live
