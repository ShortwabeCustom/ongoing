# FASE 3 — API Reference

**Finding CRUD API with Filtering, Sorting, and Pagination**

## Base URL

```
http://localhost:3000/api/findings
```

## Endpoints

### 1. List Findings (with Filters & Pagination)

**GET** `/api/findings`

List all findings with advanced filtering, sorting, and pagination support.

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `status` | string (csv) | Comma-separated list of statuses | `OPEN,IN_PROGRESS` |
| `priority` | string (csv) | Comma-separated list of priorities | `HIGH,CRITICAL` |
| `severity` | string (csv) | Comma-separated list of severities | `MAJOR,BLOCKER` |
| `area` | string (csv) | Comma-separated list of areas (UI, UX, COPY) | `UI,UX` |
| `assigneeId` | string | Filter by assignee user ID | `userid123` |
| `createdAfter` | ISO8601 | Filter by creation date (gte) | `2026-08-01T00:00:00Z` |
| `createdBefore` | ISO8601 | Filter by creation date (lte) | `2026-08-31T23:59:59Z` |
| `updatedAfter` | ISO8601 | Filter by update date (gte) | `2026-08-01T00:00:00Z` |
| `updatedBefore` | ISO8601 | Filter by update date (lte) | `2026-08-31T23:59:59Z` |
| `search` | string | Full-text search in observation | `login+button` |
| `sort` | string | Sort field with optional `-` for descending | `createdAt`, `-priority` |
| `limit` | number | Results per page (1-100, default 20) | `50` |
| `offset` | number | Pagination offset (default 0) | `100` |

#### Valid Enum Values

**FindingStatus**: `OPEN`, `TRIAGED`, `IN_PROGRESS`, `READY_FOR_VALIDATION`, `VALIDATED`, `CLOSED`, `BLOCKED`, `REOPENED`

**FindingPriority**: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

**FindingSeverity**: `COSMETIC`, `MINOR`, `MAJOR`, `BLOCKER`

**ExperienceArea**: `UI`, `UX`, `COPY`

**Sort Fields**: `createdAt`, `updatedAt`, `priority`, `status`

#### Response 200

```json
{
  "items": [
    {
      "id": "f1abc2def3ghi4jkl5m",
      "observation": "Login button color too light in dark mode",
      "status": "OPEN",
      "priority": "HIGH",
      "severity": "MAJOR",
      "assigneeId": "u1user1id1user1id1",
      "assignee": {
        "id": "u1user1id1user1id1",
        "name": "Alice Designer",
        "email": "alice@example.com"
      },
      "version": 1,
      "createdAt": "2026-08-07T10:30:00Z",
      "updatedAt": "2026-08-07T10:30:00Z"
    }
  ],
  "total": 174,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

#### Response 400 (Validation Error)

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid query parameters",
  "fields": {
    "limit": ["Limit must be between 1 and 100"],
    "sort": ["Invalid sort field"]
  }
}
```

#### Example Requests

```bash
# Get first 20 findings
curl http://localhost:3000/api/findings

# Filter by status and priority
curl "http://localhost:3000/api/findings?status=OPEN,IN_PROGRESS&priority=HIGH"

# Sort by priority (descending) with pagination
curl "http://localhost:3000/api/findings?sort=-priority&limit=50&offset=0"

# Date range filter
curl "http://localhost:3000/api/findings?createdAfter=2026-08-01T00:00:00Z&createdBefore=2026-08-31T23:59:59Z"

# Text search
curl "http://localhost:3000/api/findings?search=button+color"

# Complex filter
curl "http://localhost:3000/api/findings?status=OPEN&area=UI,UX&priority=HIGH&sort=-createdAt&limit=20"
```

---

### 2. Get Single Finding

**GET** `/api/findings/:id`

Retrieve a single finding with all related data (evidence, resolution, validation, etc.).

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Finding CUID |

#### Response 200

```json
{
  "id": "f1abc2def3ghi4jkl5m",
  "observation": "Login button color too light in dark mode",
  "status": "OPEN",
  "priority": "HIGH",
  "severity": "MAJOR",
  "assigneeId": "u1user1id1user1id1",
  "assignee": {
    "id": "u1user1id1user1id1",
    "name": "Alice Designer",
    "email": "alice@example.com"
  },
  "creator": {
    "id": "u2user2id2user2id2",
    "name": "Bob QA",
    "email": "bob@example.com"
  },
  "updater": {
    "id": "u3user3id3user3id3",
    "name": "Charlie Designer",
    "email": "charlie@example.com"
  },
  "evidence": [
    {
      "id": "e1evidence1idevi1d",
      "originalFilename": "screenshot_dark_mode.jpg",
      "url": "https://s3.example.com/evidence/screenshot_dark_mode.jpg",
      "caption": "Login button barely visible in dark mode",
      "mimeType": "image/jpeg",
      "createdAt": "2026-08-07T10:30:00Z"
    }
  ],
  "resolution": {
    "id": "r1resolution1id1res1",
    "status": "DRAFT",
    "description": "Will increase contrast ratio to WCAG AA standard"
  },
  "validation": {
    "id": "v1validation1idval1",
    "result": "ACCEPTED",
    "feedback": "Looks good, ready for implementation"
  },
  "version": 3,
  "createdAt": "2026-08-07T10:30:00Z",
  "updatedAt": "2026-08-07T15:45:00Z"
}
```

#### Response 404

```json
{
  "code": "NOT_FOUND",
  "message": "Finding not found"
}
```

#### Response 410

```json
{
  "code": "RESOURCE_DELETED",
  "message": "This finding has been deleted"
}
```

---

### 3. Update Finding (with Optimistic Locking)

**PATCH** `/api/findings/:id`

Update finding properties with optimistic locking via `version` field.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Finding CUID |

#### Request Body

```json
{
  "status": "IN_PROGRESS",
  "priority": "MEDIUM",
  "severity": "MINOR",
  "assigneeId": "u2user2id2user2id2",
  "version": 1
}
```

**Required Fields**:
- `version` (number) — Current version for optimistic locking

**Optional Fields**:
- `status` (enum)
- `priority` (enum)
- `severity` (enum)
- `assigneeId` (string, null to unassign)
- `observation` (string, 5-2000 chars)
- `dueDate` (ISO8601, null to clear)
- `previousScreen`, `currentScreen`, `flowStep` (strings)

#### Response 200

```json
{
  "id": "f1abc2def3ghi4jkl5m",
  "status": "IN_PROGRESS",
  "priority": "MEDIUM",
  "severity": "MINOR",
  "assigneeId": "u2user2id2user2id2",
  "version": 2,
  "updatedAt": "2026-08-07T16:00:00Z"
}
```

#### Response 409 (Version Mismatch)

```json
{
  "code": "VERSION_MISMATCH",
  "message": "Finding was updated by another user. Please refresh and try again.",
  "currentVersion": 3
}
```

#### Response 400 (Validation Error)

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid update data",
  "fields": {
    "version": ["Must be a positive integer"],
    "priority": ["Invalid priority value"]
  }
}
```

#### Example Request

```bash
curl -X PATCH http://localhost:3000/api/findings/f1abc2def3ghi4jkl5m \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS",
    "assigneeId": "u2user2id2user2id2",
    "version": 1
  }'
```

---

### 4. Delete Finding (Soft Delete)

**DELETE** `/api/findings/:id`

Soft delete a finding (sets `deletedAt` timestamp). Finding remains in database but is excluded from queries.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Finding CUID |

#### Response 204

No content (successful deletion).

#### Response 404

```json
{
  "code": "NOT_FOUND",
  "message": "Finding not found"
}
```

#### Example Request

```bash
curl -X DELETE http://localhost:3000/api/findings/f1abc2def3ghi4jkl5m
```

---

### 5. Bulk Update Findings

**POST** `/api/findings/bulk-update`

Update multiple findings in a single request. Handles partial success (207 status).

#### Request Body

```json
{
  "ids": ["f1abc2def3ghi4jkl5m", "f2abcd2def3ghi4jkl5", "f3abcde2def3ghi4jkl"],
  "updates": {
    "status": "VALIDATED",
    "assigneeId": "u2user2id2user2id2"
  }
}
```

**Required Fields**:
- `ids` (array of strings, min 1)
- `updates` (object with at least one field)

**Updatable Fields**:
- `status` (enum)
- `priority` (enum)
- `severity` (enum)
- `assigneeId` (string or null)

#### Response 200 (All Successful)

```json
{
  "updated": 3,
  "failed": 0,
  "results": [
    {
      "id": "f1abc2def3ghi4jkl5m",
      "status": "VALIDATED",
      "priority": "HIGH",
      "severity": "MAJOR",
      "assigneeId": "u2user2id2user2id2",
      "version": 4,
      "updatedAt": "2026-08-07T16:05:00Z"
    }
  ]
}
```

#### Response 207 (Partial Success)

```json
{
  "updated": 2,
  "failed": 1,
  "results": [
    {
      "id": "f1abc2def3ghi4jkl5m",
      "status": "VALIDATED",
      "version": 4,
      "updatedAt": "2026-08-07T16:05:00Z"
    },
    {
      "id": "f2abcd2def3ghi4jkl5",
      "error": "NOT_FOUND"
    }
  ]
}
```

#### Example Request

```bash
curl -X POST http://localhost:3000/api/findings/bulk-update \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["f1abc2def3ghi4jkl5m", "f2abcd2def3ghi4jkl5"],
    "updates": {
      "status": "VALIDATED",
      "assigneeId": "u2user2id2user2id2"
    }
  }'
```

---

### 6. Get Findings Statistics

**GET** `/api/findings/stats`

Get aggregated statistics across all findings (counts by status, priority, area, etc.).

#### Response 200

```json
{
  "total": 174,
  "byStatus": {
    "OPEN": 45,
    "TRIAGED": 25,
    "IN_PROGRESS": 30,
    "READY_FOR_VALIDATION": 20,
    "VALIDATED": 45,
    "CLOSED": 8,
    "BLOCKED": 1,
    "REOPENED": 0
  },
  "byPriority": {
    "LOW": 49,
    "MEDIUM": 100,
    "HIGH": 24,
    "CRITICAL": 1
  },
  "bySeverity": {
    "COSMETIC": 80,
    "MINOR": 60,
    "MAJOR": 30,
    "BLOCKER": 4
  },
  "byArea": {
    "UI": 60,
    "UX": 50,
    "COPY": 64
  },
  "unassigned": 42
}
```

#### Example Request

```bash
curl http://localhost:3000/api/findings/stats
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "fields": {
    "fieldName": ["Error message 1", "Error message 2"]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid query parameters or request body |
| `INVALID_ID` | 400 | Malformed ID format |
| `NOT_FOUND` | 404 | Resource not found |
| `RESOURCE_DELETED` | 410 | Resource has been deleted |
| `VERSION_MISMATCH` | 409 | Optimistic locking conflict |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Authentication & Authorization

**Note**: Auth is mocked with `userId="system"` in FASE 3. Full authentication and role-based access control will be implemented in **FASE 7**.

---

## Rate Limiting

None currently implemented. To be added in FASE 9 (Hardening).

---

## Pagination Best Practices

### Offset/Limit (Current Implementation)

- **Pros**: Simple, cacheable, UI-friendly
- **Cons**: Slow for large offsets (e.g., page 10,000)

```bash
# Get page 2 (items 20-40)
curl "http://localhost:3000/api/findings?limit=20&offset=20"
```

### Future: Cursor-Based Pagination (FASE 9)

For better performance with large datasets:

```bash
# Get next 20 items after cursor
curl "http://localhost:3000/api/findings?cursor=ABC123&limit=20"
```

---

## Examples by Use Case

### Show Dashboard Summary

```bash
# Get top 10 open findings by priority
curl "http://localhost:3000/api/findings?status=OPEN&sort=-priority&limit=10"

# Get stats dashboard
curl "http://localhost:3000/api/findings/stats"
```

### List My Assignments

```bash
# Replace USER_ID with actual user ID
curl "http://localhost:3000/api/findings?assigneeId=USER_ID"
```

### Find Recent Changes

```bash
# Findings updated in last 7 days
curl "http://localhost:3000/api/findings?updatedAfter=2026-07-31T00:00:00Z&sort=-updatedAt"
```

### Bulk Triage

```bash
# Mark multiple findings as triaged
curl -X POST http://localhost:3000/api/findings/bulk-update \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["f1", "f2", "f3", "f4", "f5"],
    "updates": {
      "status": "TRIAGED"
    }
  }'
```

---

## Performance Considerations

- **Indexes**: Queries use indexes on `status`, `priority`, `assigneeId`, `createdAt`, `deletedAt`
- **N+1 Prevention**: Related data (creator, assignee, evidence) fetched in single query via `include`
- **Pagination Default**: 20 items per page to balance responsiveness vs. payload size
- **Soft Deletes**: Always filtered (`deletedAt: null`) to exclude deleted findings

---

## Related Documentation

- [Data Model](./02-data-model.md) — Prisma schema and relationships
- [State Machine](./03-state-machine.md) — Valid status transitions
- [Import Strategy](./04-import-strategy.md) — CSV import endpoint

---

**Last Updated**: 2026-08-07
**FASE**: 3 (API CRUD + Filtering)
**Status**: ✅ Implementation Complete (Database Setup Required)
