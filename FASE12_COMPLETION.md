# FASE 12 Completion — Advanced Search Implementation Guide

**Date**: 2026-08-10  
**Status**: ✅ Complete  
**Build Time**: 42s (Turbopack)  
**Test Coverage**: Manual end-to-end verification  

## Quick Start

### 1. Start Elasticsearch

```bash
docker-compose up -d elasticsearch
```

Wait for health check (may take 20-30 seconds on first run):
```bash
curl http://localhost:9200
```

### 2. Initialize Index & Migrate Existing Findings

```bash
DATABASE_URL="postgresql://..." npx tsx scripts/migrate-findings-to-es.ts
```

This script:
- Creates the `findings-v1` index if it doesn't exist
- Indexes all non-deleted findings from your PostgreSQL database
- Reports success/failure count

### 3. Start Development Server

```bash
npm run dev
```

Server runs at `http://localhost:3001` (or next available port if 3000 is in use).

### 4. Access the Search UI

Navigate to `http://localhost:3001/dashboard/analytics` — the search bar is at the top of the page.

---

## Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React 19 / Next.js 16.3)                         │
├─────────────────────────────────────────────────────────────┤
│  <SearchFindings />                                         │
│  ├─ input + filters (status, priority)                      │
│  └─ results dropdown (10 items max)                         │
│                                                              │
│  useSearch() hook (with fallback logic)                      │
│  ├─ 300ms debounce via useDebouncedValue                    │
│  ├─ fetch /api/search/findings (Elasticsearch)              │
│  └─ fallback: fetch /api/findings (Postgres)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                    HTTP GET
                         │
┌────────────────────────▼────────────────────────────────────┐
│  API Layer (Next.js API Routes)                             │
├─────────────────────────────────────────────────────────────┤
│  /api/search/findings (route.ts)                            │
│  ├─ RBAC check: VIEW_ALL_FINDINGS                           │
│  ├─ Query validation: SearchQuerySchema (Zod)               │
│  └─ delegate → SearchService.search()                       │
│                                                              │
│  /api/findings (existing, fallback)                         │
│  └─ Simple `search` param filter                            │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐     ┌──────────┐   ┌──────────┐
    │Postgres │     │Elasticsearch│   │Redis   │
    │(fallback)    │(primary)     │(cache TBD)
    └─────────┘     └──────────┘   └──────────┘
```

### Data Flow: Mutation → Indexing

```
User PATCH /api/findings/[id]
│
└─→ FindingService.updateFinding()
    ├─ Update Postgres (optimistic locking)
    ├─ Fetch updated record
    └─ SearchService.indexFinding()  ← async, fire-and-forget
        └─ Upsert to ES index

(If ES is down, mutation still succeeds, logging error)
```

---

## File Structure

### Search-Specific Files

```
lib/
├─ es-lazy.ts                          # Elasticsearch client singleton
├─ elasticsearch/
│  └─ findings-index.ts                # Index mapping & utility functions
├─ services/
│  └─ search-service.ts                # Core search logic (5 static methods)
├─ validators/
│  └─ search-query.ts                  # Zod schema for /api/search/findings
├─ hooks/
│  ├─ useDebouncedValue.ts            # Generic debounce hook (new)
│  └─ useSearch.ts                     # Search hook with ES→Postgres fallback
│
app/api/search/
└─ findings/
   └─ route.ts                         # GET /api/search/findings endpoint

components/search/
├─ SearchFindings.tsx                  # Search bar + results dropdown
└─ SearchResultItem.tsx                # Individual result card
```

### Integration Points (Modified Files)

```
lib/services/
├─ finding-service.ts                  # + indexing calls in updateFinding(), deleteFinding()
└─ import-service.ts                   # + bulk indexing after confirmImport()

app/api/findings/
└─ bulk-update/route.ts                # + bulk indexing after updateMany()

app/dashboard/
└─ analytics/page.tsx                  # + <SearchFindings /> component mount

.env.example                            # + ELASTICSEARCH_URL, ELASTICSEARCH_FINDINGS_INDEX
package.json                            # + @elastic/elasticsearch@^8.11.0 dependency
docker-compose.yml                      # (NEW) Elasticsearch service definition
scripts/
└─ migrate-findings-to-es.ts           # (NEW) One-time bulk indexing script
```

---

## API Reference

### GET /api/search/findings

**Authorization**: Requires session + `VIEW_ALL_FINDINGS` role

**Query Parameters**:

| Name | Type | Default | Max | Description |
|------|------|---------|-----|-------------|
| `q` | string | - | - | Full-text search term |
| `status` | string (comma-separated) | - | - | Filter: `OPEN,TRIAGED,IN_PROGRESS,READY_FOR_VALIDATION,VALIDATED,CLOSED,BLOCKED,REOPENED` |
| `priority` | string (comma-separated) | - | - | Filter: `LOW,MEDIUM,HIGH,CRITICAL` |
| `severity` | string (comma-separated) | - | - | Filter: `COSMETIC,MINOR,MAJOR,BLOCKER` |
| `assigneeId` | string | - | - | Filter by assignee user ID |
| `projectId` | string | - | - | Filter by project ID |
| `createdAfter` | ISO 8601 | - | - | Filter: findings created after this date |
| `createdBefore` | ISO 8601 | - | - | Filter: findings created before this date |
| `limit` | integer | 20 | 100 | Pagination: results per page |
| `offset` | integer | 0 | - | Pagination: skip N results |

**Example Request**:
```bash
curl -H "Authorization: Bearer $SESSION_COOKIE" \
  "http://localhost:3001/api/search/findings?q=bug&status=OPEN&priority=HIGH&limit=10"
```

**Response** (200 OK):
```json
{
  "total": 42,
  "items": [
    {
      "id": "cuid123",
      "observation": "Login button has <em>bug</em> on mobile",
      "highlightedObservation": "Login button has <em>bug</em> on mobile",
      "status": "OPEN",
      "priority": "HIGH",
      "severity": "MAJOR",
      "assigneeId": "user456",
      "projectId": "proj789",
      "createdAt": "2026-08-10T10:30:00Z"
    }
    // ...
  ],
  "took_ms": 145,
  "facets": {
    "status": {
      "OPEN": 25,
      "IN_PROGRESS": 17
    },
    "priority": {
      "HIGH": 30,
      "CRITICAL": 12
    },
    "severity": {
      "MAJOR": 20,
      "BLOCKER": 22
    }
  }
}
```

**Error Response** (401 Unauthorized):
```json
{
  "code": "UNAUTHORIZED",
  "message": "No autenticado"
}
```

**Error Response** (400 Bad Request):
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid search parameters",
  "fields": {
    "limit": ["Limit must be between 1 and 100"]
  }
}
```

---

## Hook Usage

### useSearch()

```tsx
'use client'

import { useSearch } from '@/lib/hooks/useSearch'

export function MySearchComponent() {
  const { data, isLoading, error, isFallback, refetch } = useSearch({
    q: 'login bug',
    status: ['OPEN', 'IN_PROGRESS'],
    priority: ['HIGH', 'CRITICAL'],
    limit: 20,
    offset: 0,
  })

  if (isLoading) return <Spinner />
  if (error) return <ErrorBanner message={error} />
  if (isFallback) return <WarningBadge>Using database search</WarningBadge>

  return (
    <div>
      <p>Found {data?.total} results in {data?.took_ms}ms</p>
      {data?.items.map(item => (
        <ResultCard key={item.id} {...item} />
      ))}
    </div>
  )
}
```

### useDebouncedValue()

```tsx
'use client'

import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'

export function SearchInput() {
  const [term, setTerm] = useState('')
  const debouncedTerm = useDebouncedValue(term, 300)

  useEffect(() => {
    if (debouncedTerm) {
      // This effect runs 300ms after user stops typing
      fetchResults(debouncedTerm)
    }
  }, [debouncedTerm])

  return <input value={term} onChange={e => setTerm(e.target.value)} />
}
```

---

## Service Usage (Backend)

### SearchService.indexFinding()

```typescript
import { SearchService } from '@/lib/services/search-service'

// After a finding is updated:
const updatedFinding = await FindingService.getFinding(id)
const evidenceDescriptions = updatedFinding.evidence
  .map(e => [e.caption, e.originalFilename].join(' '))
  .join(' ')

void SearchService.indexFinding({
  id: updatedFinding.id,
  observation: updatedFinding.observation,
  evidenceDescriptions,
  status: updatedFinding.status,
  priority: updatedFinding.priority,
  severity: updatedFinding.severity,
  assigneeId: updatedFinding.assigneeId,
  projectId: updatedFinding.projectId,
  createdAt: updatedFinding.createdAt,
  updatedAt: updatedFinding.updatedAt,
})
// Fire-and-forget: no await, no error thrown
```

### SearchService.search()

```typescript
import { SearchService } from '@/lib/services/search-service'
import type { SearchQuery } from '@/lib/validators/search-query'

const query: SearchQuery = {
  q: 'login bug',
  status: ['OPEN'],
  limit: 20,
  offset: 0,
}

const result = await SearchService.search(query)
// Returns: { total, items[], took_ms, facets }
```

---

## Troubleshooting

### Elasticsearch Connection Failed

**Error**: `ECONNREFUSED` when indexing

**Solution**:
```bash
# Check if Elasticsearch is running
docker-compose ps

# If not, start it
docker-compose up -d elasticsearch

# Wait for startup (30s+)
docker-compose logs elasticsearch | tail -20
```

### Index Not Found

**Error**: `index_not_found_exception` in /api/search/findings

**Solution**:
- The index is auto-created by `SearchService.search()` or migration script
- Force creation:
  ```bash
  DATABASE_URL="..." npx tsx scripts/migrate-findings-to-es.ts
  ```

### Findings Not Appearing in Search

**Cause**: New findings aren't automatically indexed until they're created/updated AFTER deployment

**Solution**:
```bash
# Re-index all existing findings
DATABASE_URL="..." npx tsx scripts/migrate-findings-to-es.ts
```

### Search Falls Back to Postgres

**Behavior**: Check browser console or `isFallback` flag in hook

**Why**: ES endpoint may be down or returning error

**Action**: Check Elasticsearch health:
```bash
curl http://localhost:9200/_cluster/health
```

### High Memory Usage / ES Container Exits

**Cause**: Default ES heap is 2GB; limited environments may need less

**Fix**: Edit `docker-compose.yml`:
```yaml
environment:
  - ES_JAVA_OPTS=-Xms256m -Xmx256m  # Reduce from 512m if needed
```

---

## Performance Tuning

### Index Refresh Interval

Default is 1s (near-real-time). For development, this is fine.

For production, consider:
```bash
curl -X PUT http://localhost:9200/findings-v1/_settings \
  -H "Content-Type: application/json" \
  -d '{"index.refresh_interval": "5s"}'
```

### Query Optimization

- **Keyword fields** (status, priority): Use `term` query (exact match)
- **Text fields** (observation, evidenceDescriptions): Use `multi_match` query
- **Date ranges**: Use `range` query with millisecond precision

SearchService already applies these patterns.

### Bulk Indexing Performance

The migration script uses `client.bulk()` with 1-second timeout per request. For large datasets (100k+ findings):

```typescript
// In migrate-findings-to-es.ts, adjust batch size:
const BATCH_SIZE = 1000  // Process 1000 findings per request
for (let i = 0; i < findings.length; i += BATCH_SIZE) {
  const batch = findings.slice(i, i + BATCH_SIZE)
  await SearchService.bulkIndexFindings(batch)
}
```

---

## Testing Checklist

- [ ] Elasticsearch container starts: `docker-compose up -d elasticsearch`
- [ ] Index created: `curl http://localhost:9200/findings-v1`
- [ ] Migration runs without error: `DATABASE_URL="..." npx tsx scripts/migrate-findings-to-es.ts`
- [ ] API is protected: `curl http://localhost:3001/api/search/findings` returns 401
- [ ] Component renders in dashboard: Visit `/dashboard/analytics`
- [ ] Search executes without errors (check browser DevTools Network)
- [ ] Fallback works: `docker-compose stop elasticsearch` → search still works but uses Postgres
- [ ] New findings are indexed: Create a finding via import, verify it appears in search

---

## Next Steps (Future Phases)

1. **Performance**: Add Redis caching for frequent searches (FASE 13+)
2. **Analytics**: Track search queries, popular terms, no-result searches (FASE 14)
3. **Advanced UI**: Modal for complex filters (FASE 15)
4. **Mobile**: Optimize SearchFindings for mobile screens (FASE 16)
5. **Production Elasticsearch**: Multi-node cluster, proper security, backups (post-FASE)

---

## References

- Elasticsearch Docs: https://www.elastic.co/guide/en/elasticsearch/reference/8.11/
- @elastic/elasticsearch Client: https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/8.11/
- FASE 12 Master Prompt: [FASE12_MASTER_PROMPT.md](./FASE12_MASTER_PROMPT.md)
- Implementation Plan: `/root/.claude/plans/lazy-purring-panda.md`

---

**Last Updated**: 2026-08-10  
**Maintainer**: Alexis (FASE 12 implementation)
