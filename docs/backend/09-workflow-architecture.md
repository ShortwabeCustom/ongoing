# FASE 6 — Workflow Architecture

**Status**: ✅ Complete | **Date**: 2026-08-08 | **Build**: 5.9s

## Overview

Complete workflow system for Finding lifecycle management with:
- **8-state Resolution workflow** (OPEN → TRIAGED → INVESTIGATING → PROPOSED → APPROVED → IMPLEMENTED → VERIFIED → CLOSED)
- **Hybrid Validation system** (automated checks + manual approval)
- **Delta-based Audit Trail** (efficient change tracking with CSV export)
- **Evidence attachment** to workflow states
- **State machine enforcement** at service layer

---

## 1. State Machine Design

### Resolution States

```
┌─────────────────────────────────────────────────────────────────┐
│                    Resolution Workflow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  OPEN ──→ TRIAGED ──→ INVESTIGATING ──→ PROPOSED ──→ APPROVED  │
│   ↑         ↑              ↑              ↑           ↑         │
│   │         │              │              │           │         │
│   └─────────┴──────────────┴──────────────┴───────────┘         │
│   (Any state can reopen)                                        │
│                                                                 │
│  APPROVED ──→ IMPLEMENTED ──→ VERIFIED ──→ CLOSED              │
│    ↑              ↑               ↑          ↑                  │
│    └──────────────┴───────────────┴──────────┘                  │
│    (All previous states can reopen)                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Allowed Transitions**:
```typescript
const STATE_TRANSITIONS = {
  OPEN: ['TRIAGED', 'OPEN'],
  TRIAGED: ['INVESTIGATING', 'OPEN'],
  INVESTIGATING: ['PROPOSED', 'OPEN'],
  PROPOSED: ['APPROVED', 'OPEN'],
  APPROVED: ['IMPLEMENTED', 'OPEN'],
  IMPLEMENTED: ['VERIFIED', 'OPEN'],
  VERIFIED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
}
```

**Implementation**:
- Validation at service layer (ResolutionService.updateResolutionState)
- Type-safe via Zod schema
- Error thrown if invalid transition attempted
- Logged to audit trail on success

---

## 2. Database Models

### Resolution

```prisma
model Resolution {
  id            String   @id @default(cuid())
  findingId     String
  finding       Finding  @relation(fields: [findingId], references: [id], onDelete: Cascade)
  
  state         ResolutionState @default(OPEN)
  description   String
  notes         String?
  assignedTo    String?
  
  evidence      Evidence[]
  
  createdBy     String
  creator       User   @relation("ResolutionCreator", fields: [createdBy], references: [id])
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([findingId])
  @@index([state])
  @@index([assignedTo])
  @@index([createdBy])
}

enum ResolutionState {
  OPEN
  TRIAGED
  INVESTIGATING
  PROPOSED
  APPROVED
  IMPLEMENTED
  VERIFIED
  CLOSED
}
```

**Key Features**:
- One-to-many with Finding (multiple resolutions possible)
- State enforced via enum
- Evidence attachment via foreign key in Evidence model
- Timestamps for audit trail
- Indexes for fast queries (state, assignee, creator)

### Validation

```prisma
model Validation {
  id            String   @id @default(cuid())
  findingId     String
  finding       Finding  @relation(fields: [findingId], references: [id], onDelete: Cascade)
  
  result        ValidationResult @default(PENDING)
  criteria      Json?  // Array of { id, name, passed, notes }
  notes         String?
  
  evidence      Evidence[]
  
  validatedBy   String?
  validator     User?   @relation("ValidationValidator", fields: [validatedBy], references: [id], onDelete: SetNull)
  validatedAt   DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([findingId])
  @@index([result])
  @@index([validatedBy])
}

enum ValidationResult {
  PENDING
  PASS
  FAIL
}
```

**Hybrid Validation**:
- Criteria array: `[{ id, name, passed, notes }]`
- System auto-evaluates all passed/failed
- Result calculation: all true → PASS, any false → FAIL, else PENDING
- Manual approval recorded in `validatedBy` + `validatedAt`

### AuditLog (Enhanced)

```prisma
model AuditLog {
  id            String   @id @default(cuid())
  
  findingId     String
  finding       Finding  @relation(fields: [findingId], references: [id], onDelete: Cascade)
  
  action        AuditAction
  changes       Json?   // { before: {...}, after: {...} }
  details       String?
  
  actorId       String
  actor         User   @relation("AuditActor", fields: [actorId], references: [id], onDelete: SetNull)
  ipAddress     String?
  
  createdAt     DateTime @default(now())
  
  @@index([findingId])
  @@index([action])
  @@index([actorId])
  @@index([createdAt])
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  STATUS_CHANGE
  STATE_CHANGED
  EVIDENCE_ATTACHED
  VALIDATED
  REOPENED
  ASSIGN
}
```

**Delta Tracking**:
- Changes stored as deltas: `{ before: {...}, after: {...} }`
- Only changed fields included
- Efficient storage (not full snapshots)
- Reconstructible audit trail

### Evidence (Enhanced)

```prisma
model Evidence {
  // ... existing fields ...
  
  resolutionId  String?
  resolution    Resolution? @relation(fields: [resolutionId], references: [id], onDelete: SetNull)
  
  validationId  String?
  validation    Validation? @relation(fields: [validationId], references: [id], onDelete: SetNull)
  
  @@index([resolutionId])
  @@index([validationId])
}
```

**Dual Attachment**:
- Evidence always belongs to Finding (primary)
- Can also attach to Resolution (investigation evidence)
- Can also attach to Validation (validation evidence)
- Query pattern: `prisma.evidence.findMany({ where: { findingId, resolutionId } })`

---

## 3. Service Layer Architecture

### ResolutionService

**Responsibilities**:
- CRUD operations on Resolution
- State transition validation
- Evidence attachment
- Audit logging

**Key Methods**:

```typescript
class ResolutionService {
  // Create new resolution (state: OPEN)
  static async createResolution(
    findingId: string,
    input: CreateResolutionInput,
    userId: string
  ): Promise<Resolution>
  
  // Get paginated list
  static async getResolutions(
    findingId: string,
    limit?: number,
    offset?: number
  ): Promise<{ items: Resolution[], total: number }>
  
  // Get single detail
  static async getResolution(
    findingId: string,
    resolutionId: string
  ): Promise<Resolution | null>
  
  // Update state with validation + audit
  static async updateResolutionState(
    findingId: string,
    resolutionId: string,
    input: UpdateResolutionStateInput,
    userId: string
  ): Promise<Resolution>
  
  // Batch operations
  static async bulkUpdateState(
    findingId: string,
    updates: Array<{ resolutionId: string; state: ResolutionState }>,
    userId: string
  ): Promise<Array<{ id, success, result?, error? }>>
  
  // Internal: audit logging
  static async logAudit(
    findingId: string,
    action: AuditAction,
    userId: string,
    before: Record<string, any> | null,
    after: Record<string, any> | null
  ): Promise<AuditLog>
}
```

### ValidationService

**Responsibilities**:
- Validation checkpoint management
- Hybrid validation execution
- Criteria tracking
- History queries

**Key Methods**:

```typescript
class ValidationService {
  // Create validation with criteria
  static async createValidation(
    findingId: string,
    input: CreateValidationInput,
    userId: string
  ): Promise<Validation>
  
  // Run validation (hybrid)
  static async checkValidation(
    findingId: string,
    validationId: string,
    input: CheckValidationInput,
    userId: string
  ): Promise<Validation>
  
  // Query helpers
  static async getLatestValidation(findingId: string): Promise<Validation | null>
  static async getValidationHistory(findingId: string): Promise<Validation[]>
  static async isValidationRequired(findingId: string): Promise<boolean>
}
```

### AuditService

**Responsibilities**:
- Audit log querying and filtering
- CSV export
- Analytics (stats, field history)

**Key Methods**:

```typescript
class AuditService {
  // Query with filters
  static async getAuditLog(
    findingId: string,
    filter: AuditLogFilter
  ): Promise<{ items: AuditLog[], total: number }>
  
  // Export as CSV
  static async exportAuditLog(findingId: string): Promise<string>
  
  // Analytics
  static async getAuditStats(findingId: string)
  static async getFieldHistory(findingId: string, fieldName: string)
}
```

---

## 4. API Endpoints

### Resolution Endpoints

#### POST /api/findings/{id}/resolutions
**Create resolution**

Request:
```json
{
  "description": "Initial investigation plan",
  "assignedTo": "user-123",
  "evidence": ["ev-1", "ev-2"]
}
```

Response (201):
```json
{
  "status": "success",
  "data": {
    "id": "res-1",
    "state": "OPEN",
    "description": "Initial investigation plan",
    "assignedTo": "user-123",
    "evidence": [
      { "id": "ev-1", "originalFilename": "...", "caption": "...", "url": "..." },
      { "id": "ev-2", "originalFilename": "...", "caption": "...", "url": "..." }
    ],
    "createdAt": "2026-08-08T10:00:00Z"
  }
}
```

#### GET /api/findings/{id}/resolutions
**List resolutions**

Query params:
- `limit`: 1-100 (default: 50)
- `offset`: 0+ (default: 0)

Response (200):
```json
{
  "status": "success",
  "data": {
    "items": [...],
    "total": 2
  }
}
```

#### PATCH /api/findings/{id}/resolutions/{resId}
**Update resolution state**

Request:
```json
{
  "state": "TRIAGED",
  "notes": "Initial review completed",
  "evidence": ["ev-3"]
}
```

Response (200): Updated Resolution

#### GET /api/findings/{id}/resolutions/{resId}
**Get single resolution**

Response (200): Resolution detail

### Validation Endpoints

#### POST /api/findings/{id}/validations
**Create validation checkpoint**

Request:
```json
{
  "criteria": [
    { "id": "c1", "name": "All issues documented" },
    { "id": "c2", "name": "Evidence is complete" },
    { "id": "c3", "name": "Resolution is clear" }
  ],
  "evidence": ["ev-4", "ev-5"],
  "notes": "Pre-closure validation"
}
```

Response (201): Validation (result: PENDING)

#### POST /api/findings/{id}/validations/{valId}/check
**Run validation (hybrid)**

Request:
```json
{
  "results": {
    "c1": true,
    "c2": false,
    "c3": true
  },
  "notes": "c2 failed: missing screenshots"
}
```

Response (200):
```json
{
  "status": "success",
  "data": {
    "id": "val-1",
    "result": "FAIL",
    "criteria": [
      { "id": "c1", "name": "All issues documented", "passed": true },
      { "id": "c2", "name": "Evidence is complete", "passed": false },
      { "id": "c3", "name": "Resolution is clear", "passed": true }
    ],
    "validatedBy": "user-456",
    "validatedAt": "2026-08-08T11:00:00Z"
  },
  "message": "Validation result: FAIL"
}
```

#### GET /api/findings/{id}/validations
**List validations (history)**

Response (200): Array of all validations + total

### Audit Log Endpoints

#### GET /api/findings/{id}/audit-log
**Query audit trail**

Query params:
- `action`: Filter by action (CREATE, STATE_CHANGED, etc.)
- `userId`: Filter by actor
- `limit`: 1-100 (default: 50)
- `offset`: 0+ (default: 0)

Response (200):
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": "audit-1",
        "action": "CREATE",
        "changes": {
          "before": null,
          "after": { "state": "OPEN", "description": "..." }
        },
        "actor": { "id": "user-123", "name": "Alice", "email": "alice@..." },
        "createdAt": "2026-08-08T10:00:00Z"
      }
    ],
    "total": 5
  }
}
```

#### GET /api/findings/{id}/audit-log/export
**Export as CSV**

Response (200):
```
Content-Type: text/csv
Content-Disposition: attachment; filename="audit-log-{id}.csv"

Timestamp,Action,Actor,Email,Changes,Details
2026-08-08T10:00:00Z,CREATE,Alice,alice@...,"{""before"":null,""after"":{...}}",Created resolution
2026-08-08T10:15:00Z,STATE_CHANGED,Alice,alice@...,"{""before"":{""state"":""OPEN""},""after"":{""state"":""TRIAGED""}}",State changed
```

---

## 5. Validation & Error Handling

### State Transition Validation

```typescript
// ✓ Valid
OPEN → TRIAGED
TRIAGED → INVESTIGATING
INVESTIGATING → PROPOSED
PROPOSED → APPROVED
APPROVED → IMPLEMENTED
IMPLEMENTED → VERIFIED
VERIFIED → CLOSED
ANY → OPEN (reopen)

// ✗ Invalid
OPEN → INVESTIGATING (must go through TRIAGED)
CLOSED → TRIAGED (can only reopen to OPEN)
TRIAGED → VERIFIED (must follow sequence)
```

### Error Responses

**Invalid State Transition (400)**:
```json
{
  "code": "INVALID_TRANSITION",
  "message": "Invalid state transition: OPEN → VERIFIED. Allowed: TRIAGED, OPEN"
}
```

**Validation Not Found (404)**:
```json
{
  "code": "NOT_FOUND",
  "message": "Validation not found"
}
```

**Generic Error (500)**:
```json
{
  "code": "INTERNAL_ERROR",
  "message": "An unexpected error occurred"
}
```

---

## 6. Validation Schema (Zod)

```typescript
// Resolution inputs
const CreateResolutionSchema = z.object({
  description: z.string().min(1).max(1000),
  assignedTo: z.string().optional(),
  evidence: z.array(z.string()).optional().default([]),
})

const UpdateResolutionStateSchema = z.object({
  state: ResolutionState,
  notes: z.string().optional(),
  evidence: z.array(z.string()).optional().default([]),
})

// Validation inputs
const CreateValidationSchema = z.object({
  criteria: z.array(ValidationCriterion),
  evidence: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
})

const CheckValidationSchema = z.object({
  results: z.record(z.string(), z.boolean()),
  notes: z.string().optional(),
})

// Audit log filters
const AuditLogFilterSchema = z.object({
  action: z.string().optional(),
  userId: z.string().optional(),
  dateRange: z.tuple([z.date(), z.date()]).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
})
```

---

## 7. Frontend Integration Points

### Components Used

1. **WorkflowStateIndicator** — Show current state + next transitions
2. **ResolutionWorkflow** — Main form for resolution management
3. **ValidationCheckpoint** — Validation criteria checklist
4. **AuditTrailViewer** — View + export audit history
5. **EvidenceAttachmentUI** — Attach evidence to workflows

### Example: Finding Detail Page Integration

```tsx
export function FindingDetailPage({ finding }) {
  return (
    <div className="space-y-6">
      {/* Existing: evidence gallery, finding info */}
      <EvidenceGallery findings={finding.evidence} />
      
      {/* New: workflow section */}
      <div className="border-t pt-6">
        <h2 className="text-2xl font-bold mb-4">Resolution Workflow</h2>
        <ResolutionWorkflow 
          finding={finding}
          onStateChange={async (state) => {
            // Refresh finding data
            await refetchFinding()
          }}
        />
      </div>
      
      {/* New: validation section */}
      <div className="border-t pt-6">
        <h2 className="text-2xl font-bold mb-4">Validation Checkpoint</h2>
        <ValidationCheckpoint
          finding={finding}
          onValidation={async (result) => {
            // Handle validation result
            if (result === 'PASS') {
              // Allow closure
            }
          }}
        />
      </div>
      
      {/* New: audit trail */}
      <div className="border-t pt-6">
        <h2 className="text-2xl font-bold mb-4">Audit Trail</h2>
        <AuditTrailViewer findingId={finding.id} compact={false} />
      </div>
    </div>
  )
}
```

---

## 8. Performance Considerations

### Query Optimization

**Batch evidence loading**:
```typescript
// Single query for all evidence across all attachments
const evidence = await prisma.evidence.findMany({
  where: {
    findingId: finding.id,
    OR: [
      { resolutionId: { not: null } },
      { validationId: { not: null } },
    ]
  },
  include: {
    resolution: true,
    validation: true,
  }
})
```

**Paginated audit logs**:
- Default: 50 per page
- Max: 100 per page
- Indexed: findingId, action, createdAt

**Parallel queries**:
```typescript
// Get all workflow data in parallel
const [resolutions, validations, auditLog] = await Promise.all([
  prisma.resolution.findMany({ where: { findingId } }),
  prisma.validation.findMany({ where: { findingId } }),
  prisma.auditLog.findMany({ where: { findingId } }),
])
```

---

## 9. Testing Strategy

### Unit Tests (Service Layer)

```typescript
describe('ResolutionService', () => {
  it('creates resolution with state OPEN')
  it('validates state transitions')
  it('rejects invalid transitions')
  it('logs all operations')
  it('attaches evidence correctly')
})

describe('ValidationService', () => {
  it('creates validation with criteria')
  it('auto-calculates result: all pass → PASS')
  it('auto-calculates result: any fail → FAIL')
  it('stores manual approval')
})

describe('AuditService', () => {
  it('filters by action')
  it('filters by actor')
  it('exports CSV correctly')
  it('calculates statistics')
})
```

### Integration Tests (API)

```typescript
describe('POST /api/findings/{id}/resolutions', () => {
  it('creates resolution and logs to audit')
  it('validates required fields')
  it('attaches evidence')
})

describe('PATCH /api/findings/{id}/resolutions/{resId}', () => {
  it('validates state transitions')
  it('rejects invalid transitions')
  it('logs state change')
  it('updates evidence attachment')
})

describe('POST /api/findings/{id}/validations/{valId}/check', () => {
  it('runs hybrid validation')
  it('calculates result correctly')
  it('records validator info')
})
```

---

## 10. Future Enhancements

### Planned for FASE 7 (Auth)
- Session-based user tracking (replace `temp-user-id`)
- Real user names in audit logs
- Role-based access control (RBAC)
- Finding assignment to users
- User avatars in workflow components

### Planned for FASE 8 (PWA)
- Offline workflow state caching
- Sync on reconnection
- Local audit log queuing

### Planned for FASE 9 (Hardening)
- Comprehensive test coverage
- API rate limiting
- Advanced audit filtering
- Bulk operations
- Workflow templates/presets

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-08  
**FASE 6 Status**: ✅ Complete
