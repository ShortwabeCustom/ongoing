# 🏗️ ARQUITECTURA OBJETIVO — Pruebas María 2.0 Dinámico

**Autor**: Equipo de Arquitectura  
**Fecha**: 2026-08-07  
**Estado**: Propuesta (Pendiente de Aprobación)

---

## VISIÓN

Transformar **"Pruebas María 2.0"** de una PWA estática con datos hardcodeados a una **plataforma dinámica de gestión de evidencias** donde:

1. **Excel es formato de entrada/salida**, NO la base operacional
2. **PostgreSQL es la fuente de verdad** del proceso
3. **API Route Handlers** exponen datos dinámicamente
4. **Next.js + React** rinden interfaz moderna y responsiva
5. **Object Storage** centraliza evidencias en S3-compatible
6. **Offline PWA** sigue funcionando sin romper

---

## DIAGRAMA OBJETIVO

```
┌──────────────────────────────────────────────────────────────┐
│                      USUARIO (Navegador)                      │
│                    Next.js App Router (SSR)                   │
└─────────────────────────┬──────────────────────────────────┬──┘
                          │                                   │
        ┌─────────────────┴────────────┐                ┌────┴─────────┐
        │                              │                │               │
   GET /findings              POST /findings    GET /evidence/:id    UI Cache
        │                              │                │               │
        └──────────────────┬───────────┴────────────────┴───────────────┘
                           │
          ┌────────────────▼────────────────┐
          │    Route Handlers (/api/*)      │
          │  ✓ Validation (Zod)             │
          │  ✓ Authorization                │
          │  ✓ Error handling               │
          │  ✓ Transactions                 │
          └────────────────┬────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐        ┌────▼────┐      ┌─────▼────┐
   │ Services │        │Repositories│  │Validators │
   │ Logic    │        │ DB Access  │  │ Schemas   │
   │ & Rules  │        │ Queries    │  │ Types     │
   └────┬─────┘        └────┬───────┘  └───────────┘
        │                   │
        └───────────┬───────┘
                    │
         ┌──────────▼──────────┐
         │  Prisma ORM         │
         │  ✓ Type-safe        │
         │  ✓ Migrations       │
         │  ✓ Relations        │
         │  ✓ Indexes          │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │   PostgreSQL 15+    │
         │                     │
         │ ✓ Finding          │
         │ ✓ Evidence         │
         │ ✓ TestSession      │
         │ ✓ Project          │
         │ ✓ User             │
         │ ✓ ProjectMember    │
         │ ✓ StatusHistory    │
         │ ✓ AuditLog         │
         │ ✓ ImportBatch      │
         │ + relaciones       │
         └─────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                  S3-Compatible Storage                         │
│        (AWS S3 / Cloudflare R2 / MinIO)                       │
│        ✓ Evidence images & files                             │
│        ✓ Signed URLs                                          │
│        ✓ Metadata in DB                                       │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                    Service Worker (PWA)                       │
│        ✓ Offline reads (IndexedDB cache)                     │
│        ✓ Mutation queue (when online)                        │
│        ✓ Sync on reconnect                                    │
│        ✓ Conflict resolution                                  │
└───────────────────────────────────────────────────────────────┘
```

---

## STACK FINAL

### Frontend
- **Framework**: Next.js 16.3.0 (Keep)
- **UI Library**: React 19 (Keep)
- **Styling**: Tailwind CSS 4.3.3 (Keep)
- **Components**: @base-ui/react + shadcn/ui extensions
- **Icons**: lucide-react (Keep)
- **Type Safety**: TypeScript 5.7.3 (Keep)

### Backend
- **Runtime**: Node.js (Next.js Route Handlers)
- **API**: Next.js App Router `/api/*`
- **Validation**: **Zod** (schema validation)
- **ORM**: **Prisma** (type-safe DB)
- **Database**: **PostgreSQL 15+** (SQL)

### Storage
- **Interface**: StorageService (abstraction)
- **Adapter A**: S3StorageAdapter (AWS S3)
- **Adapter B**: R2StorageAdapter (Cloudflare R2)
- **Adapter C**: MinIOStorageAdapter (self-hosted)

### Authentication
- **Option A**: **Auth.js** (if compatible with Next.js 16)
- **Option B**: **NextAuth.js** (if v4+ supports 16)
- **Option C**: Custom JWT minimal (if external SAML/OAuth required)

### Testing
- **Unit/Integration**: Vitest + @testing-library/react
- **E2E**: Playwright
- **Database**: Test PostgreSQL instance (testcontainers)

### DevOps / Observability
- **Analytics**: Vercel Analytics (Keep)
- **Logging**: Structured logs (JSON)
- **Error Tracking**: Sentry u otro
- **Database Backups**: Automated (Vercel Postgres or managed)
- **Environment**: Vercel (deploy) u otro serverless

---

## DOMINIO — MODELO DE DATOS

### Entidades Principales

```typescript
// User — Usuarios
entity User {
  id: UUID (PK)
  email: String (UNIQUE)
  name: String
  role: Enum(OWNER, QA_LEAD, DESIGNER, DEVELOPER, BUSINESS_REVIEWER, VIEWER)
  createdAt: DateTime
  updatedAt: DateTime
  deletedAt: DateTime? (soft delete)
}

// Project — Proyecto/Producto
entity Project {
  id: UUID (PK)
  name: String
  description: String?
  ownerId: UUID (FK → User)
  createdAt: DateTime
  updatedAt: DateTime
  deletedAt: DateTime? (soft delete)
  
  members: ProjectMember[]
  versions: ProductVersion[]
  testSessions: TestSession[]
  findings: Finding[]
}

// ProjectMember — Miembro del Proyecto
entity ProjectMember {
  id: UUID (PK)
  projectId: UUID (FK)
  userId: UUID (FK)
  role: Enum(OWNER, QA_LEAD, DESIGNER, DEVELOPER, BUSINESS_REVIEWER, VIEWER)
  joinedAt: DateTime
  
  project: Project
  user: User
}

// ProductVersion — Versión del Producto
entity ProductVersion {
  id: UUID (PK)
  projectId: UUID (FK)
  version: String (ej. "1.0.0", "1.1.0")
  releasedAt: DateTime?
  
  testSessions: TestSession[]
}

// TestSession — Sesión de Pruebas
entity TestSession {
  id: UUID (PK)
  projectId: UUID (FK)
  versionId: UUID (FK)
  name: String (ej. "Pruebas 30 de julio")
  date: DateTime
  environment: String? (dev, staging, prod)
  createdBy: UUID (FK → User)
  createdAt: DateTime
  
  project: Project
  version: ProductVersion
  findings: Finding[]
  importBatch: ImportBatch?
}

// Finding — Hallazgo/Observación
entity Finding {
  id: UUID (PK)
  projectId: UUID (FK)
  testSessionId: UUID (FK)
  folio: String? (ej. "REF-001")
  observation: String (descripción)
  
  status: Enum(OPEN, TRIAGED, IN_PROGRESS, READY_FOR_VALIDATION, VALIDATED, CLOSED, BLOCKED, REOPENED)
  version: Int (optimistic locking)
  
  priority: Enum(LOW, MEDIUM, HIGH, CRITICAL)
  severity: Enum(COSMETIC, MINOR, MAJOR, BLOCKER)
  effort: Enum(S, M, L, XL)
  
  previousScreen: String?
  currentScreen: String?
  flowStep: String?
  
  assigneeId: UUID? (FK → User)
  dueDate: DateTime?
  
  sourceSheet: String? (ej. "Hoja 1")
  sourceRow: Int? (para audit)
  importBatchId: UUID? (FK)
  
  createdBy: UUID (FK → User)
  createdAt: DateTime
  updatedAt: DateTime
  updatedBy: UUID? (FK → User)
  deletedAt: DateTime? (soft delete)
  
  // Relations
  incidenceTypes: FindingIncidenceType[] (many-to-many)
  experienceTags: FindingExperienceTag[] (many-to-many)
  evidence: Evidence[]
  resolution: Resolution? (1-to-1)
  validation: Validation? (1-to-1)
  comments: Comment[]
  statusHistory: FindingStatusHistory[]
  auditLogs: AuditLog[]
}

// FindingIncidenceType — Tipo de Incidencia (many-to-many)
entity FindingIncidenceType {
  findingId: UUID (PK, FK)
  incidenceType: Enum(DESIGN, FUNCTIONALITY, BUSINESS_RULE, COPY) (PK)
  
  finding: Finding
}

// FindingExperienceTag — Etiqueta de Experiencia (many-to-many)
entity FindingExperienceTag {
  findingId: UUID (PK, FK)
  experienceTag: Enum(UI, UX, COPY) (PK)
  
  finding: Finding
}

// Evidence — Evidencia (Imagen/Documento)
entity Evidence {
  id: UUID (PK)
  findingId: UUID (FK)
  type: Enum(IMAGE, VIDEO, DOCUMENT, FIGMA_URL, EXTERNAL_URL)
  storageKey: String (ruta en S3: "projects/123/evidence/abc.jpg")
  url: String? (signed URL o external)
  originalFilename: String
  mimeType: String
  fileSize: Int? (bytes)
  caption: String?
  
  createdBy: UUID (FK → User)
  createdAt: DateTime
  
  finding: Finding
}

// Resolution — Resolución del Hallazgo
entity Resolution {
  id: UUID (PK)
  findingId: UUID (FK, UNIQUE)
  description: String
  evidence: Evidence[]? (relación a imagenes de resolución)
  
  createdBy: UUID (FK → User)
  createdAt: DateTime
  updatedAt: DateTime
}

// Validation — Validación del Hallazgo
entity Validation {
  id: UUID (PK)
  findingId: UUID (FK, UNIQUE)
  result: Enum(PASSED, FAILED, PARTIAL)
  notes: String?
  evidence: Evidence[]? (relación a imagenes de validación)
  
  validatedBy: UUID (FK → User)
  validatedAt: DateTime
}

// Comment — Comentarios en Hallazgo
entity Comment {
  id: UUID (PK)
  findingId: UUID (FK)
  text: String
  
  createdBy: UUID (FK → User)
  createdAt: DateTime
  updatedAt: DateTime
}

// FindingStatusHistory — Historial de Estados
entity FindingStatusHistory {
  id: UUID (PK)
  findingId: UUID (FK)
  fromStatus: Enum(...)
  toStatus: Enum(...)
  reason: String?
  
  changedBy: UUID (FK → User)
  changedAt: DateTime
}

// AuditLog — Auditoría General
entity AuditLog {
  id: UUID (PK)
  entityType: String (ej. "Finding", "Evidence")
  entityId: UUID
  action: Enum(CREATE, UPDATE, DELETE, STATUS_CHANGE, ASSIGN, VALIDATE)
  before: JSON?
  after: JSON?
  
  actorId: UUID (FK → User)
  createdAt: DateTime
  
  // Nota: NO almacenar passwords, tokens, sesiones
}

// ImportBatch — Lote de Importación
entity ImportBatch {
  id: UUID (PK)
  projectId: UUID (FK)
  testSessionId: UUID (FK)
  
  originalFilename: String
  fileSize: Int
  importedAt: DateTime
  
  totalRows: Int
  validRows: Int
  skippedRows: Int
  
  status: Enum(PENDING, PROCESSING, COMPLETED, FAILED, ROLLED_BACK)
  errorMessage: String?
  
  importedBy: UUID (FK → User)
  createdAt: DateTime
  
  findings: Finding[] (ref por importBatchId)
}
```

---

## ÍNDICES DE BASE DE DATOS

```sql
-- Búsquedas frecuentes
CREATE INDEX idx_finding_projectid ON Finding(projectId);
CREATE INDEX idx_finding_status ON Finding(status);
CREATE INDEX idx_finding_testsession ON Finding(testSessionId);
CREATE INDEX idx_finding_assignee ON Finding(assigneeId);
CREATE INDEX idx_finding_priority ON Finding(priority);
CREATE INDEX idx_finding_created ON Finding(createdAt DESC);

-- Importación (idempotencia)
CREATE UNIQUE INDEX idx_finding_fingerprint ON Finding(importBatchId, sourceRow, HASH(observation));
-- o alternativa: almacenar fingerprint como columna

-- Relaciones
CREATE INDEX idx_evidence_finding ON Evidence(findingId);
CREATE INDEX idx_statushistory_finding ON FindingStatusHistory(findingId);
CREATE INDEX idx_auditlog_entity ON AuditLog(entityType, entityId);

-- Soft deletes
CREATE INDEX idx_finding_not_deleted ON Finding(projectId, status) WHERE deletedAt IS NULL;
```

---

## MACHINE DE ESTADOS — FINDING

```
┌─────────────────────────────────────────────────────────────┐
│                  FINDING STATE MACHINE                      │
└─────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │ OPEN (start) │
                    └──────┬───────┘
                           │ triaged()
                           ▼
                    ┌──────────────┐
                    │   TRIAGED    │
                    └──────┬───────┘
                           │ startWork()
                           ▼
                    ┌──────────────┐
          ┌────────▶│ IN_PROGRESS  │◀─────────────┐
          │         └──────┬───────┘              │
          │                │                      │
          │   blockWork()   │ readyForValidation()│ unblock()
          │                ▼                      │
          │         ┌──────────────┐              │
          └─────────│   BLOCKED    │──────────────┘
                    └──────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
 ┌────────────────────┐            ┌─────────────────────┐
 │ READY_FOR_VALIDATION│            │ IN_PROGRESS         │
 └────────┬───────────┘            └─────────────────────┘
          │ validate()
          │
          ├─ pass() ─────────┐
          │                  │
          │                  ▼
          │           ┌──────────────┐
          │           │  VALIDATED   │
          │           └──────┬───────┘
          │                  │ close()
          │                  ▼
          │           ┌──────────────┐
          │           │    CLOSED    │ ◀─── close() desde VALIDATED
          │           └──────────────┘
          │
          ├─ fail() ──────────────────────────────┐
          │                                       │
          │                                       ▼
          │                                ┌──────────────┐
          │                                │ IN_PROGRESS  │
          │                                └──────────────┘
          │
          └─ reopen()
                      ┌──────────────┐
                      │  REOPENED    │
                      └──────┬───────┘
                             │ triaged()
                             ▼
                      ┌──────────────┐
                      │   TRIAGED    │
                      └──────────────┘

NOTA: Version = optimistic locking
      Si client envía version 5 pero DB está en 6 → 409 Conflict
```

---

## CATEGORIZACIÓN (DDD BOUNDED CONTEXT)

```
Finding categoría NO es un simple enum string.

OPCIÓN A: Tabla Pivot (Recomendado)
┌──────────────┐        ┌──────────────────────────┐
│ Finding      │        │ FindingIncidenceType     │
│              │◀───┤├──│                          │
│ id (PK)      │        │ findingId (PK, FK)       │
└──────────────┘        │ incidenceType (PK, Enum) │
                        │ • DESIGN                 │
                        │ • FUNCTIONALITY          │
                        │ • BUSINESS_RULE          │
                        │ • COPY                   │
                        └──────────────────────────┘

                ┌──────────────────────────┐
                │ FindingExperienceTag     │
                │                          │
                │ findingId (PK, FK)       │
                │ experienceTag (PK, Enum) │
                │ • UI                     │
                │ • UX                     │
                │ • COPY                   │
                └──────────────────────────┘

Ventaja: Un Finding puede ser DESIGN + BUSINESS_RULE
         Un Finding puede ser UI + UX + COPY
         Consultas eficientes: WHERE incidenceType = 'DESIGN'

OPCIÓN B: JSONB (PostgreSQL)
Finding.incidenceTypes = ["DESIGN", "BUSINESS_RULE"] (JSONB array)
Finding.experienceTags = ["UI", "UX"] (JSONB array)

Ventaja: Menos tablas
Desventaja: Búsquedas menos eficientes

RECOMENDACIÓN: Opción A (Pivot Tables)
```

---

## API ENDPOINTS — DEFINICIÓN

### Projects
```
GET    /api/projects
       Response: { projects: Project[], total: Int }

POST   /api/projects
       Body: { name, description }
       Response: { id, name, ... } (201 Created)

GET    /api/projects/:projectId
       Response: Project (con miembros y stats)

PATCH  /api/projects/:projectId
       Body: { name?, description? }
       Response: Project (200 OK)

DELETE /api/projects/:projectId
       Response: {} (204 No Content) o soft-delete
```

### Findings
```
GET    /api/projects/:projectId/findings
       Query: ?status=OPEN&priority=HIGH&limit=20&offset=0&search=text
       Response: { findings: Finding[], total, hasMore }

POST   /api/projects/:projectId/findings
       Body: { observation, priority, severity, effort, assigneeId?, ... }
       Response: Finding (201 Created)

GET    /api/findings/:findingId
       Response: Finding (con evidence, resolution, validation, comments, history)

PATCH  /api/findings/:findingId
       Body: { observation?, priority?, severity?, version }
       Response: Finding (200) o Finding + 409 if version mismatch

DELETE /api/findings/:findingId
       Response: {} (204) o soft delete

POST   /api/findings/:findingId/transition
       Body: { toStatus, reason?, version }
       Response: Finding (status actualizado + history)

POST   /api/findings/:findingId/assign
       Body: { assigneeId }
       Response: Finding

POST   /api/findings/:findingId/comments
       Body: { text }
       Response: Comment (201)

GET    /api/findings/:findingId/history
       Response: { statusHistory, auditLog }
```

### Evidence
```
POST   /api/evidence/upload
       Body: FormData (multipart/form-data)
              file: File
              findingId?: UUID
              caption?: String
       Response: Evidence (201)
              { id, url (signed), storageKey, ... }

GET    /api/evidence/:evidenceId
       Response: Evidence { url (signed), ... }

DELETE /api/evidence/:evidenceId
       Response: {} (204)
```

### Resolutions & Validations
```
POST   /api/findings/:findingId/resolutions
       Body: { description, evidenceIds?: [UUID] }
       Response: Resolution (201)

POST   /api/findings/:findingId/validations
       Body: { result, notes, evidenceIds?: [UUID] }
       Response: Validation (201)
```

### Imports
```
POST   /api/imports/preview
       Body: FormData
              file: File (Excel o CSV)
              projectId: UUID
              testSessionId?: UUID
       Response: {
         preview: {
           totalRows: 176,
           validRows: 174,
           skippedRows: 2,
           newFindings: 150,
           duplicates: 24,
           incidences: [{ row: 2, type: 'EMPTY_OBSERVATION', message: '...' }]
         }
       }

POST   /api/imports/:batchId/confirm
       Body: { confirm: true }
       Response: { importBatch, findings: [...] } (201)

GET    /api/imports/:batchId
       Response: ImportBatch { status, errorMessage, stats }
```

### Stats / Analytics
```
GET    /api/projects/:projectId/stats
       Response: {
         totalFindings: 176,
         openFindings: 94,
         validatedFindings: 82,
         byStatus: { OPEN: 10, IN_PROGRESS: 5, ... },
         byPriority: { LOW: 20, MEDIUM: 50, ... },
         byIncidenceType: { DESIGN: 60, FUNCTIONALITY: 50, ... },
         ...
       }
```

---

## VALIDACIÓN ESQUEMAS (ZOD)

```typescript
// lib/validators/finding.ts

export const FindingCreateSchema = z.object({
  observation: z.string().min(5).max(2000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  severity: z.enum(['COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER']),
  effort: z.enum(['S', 'M', 'L', 'XL']),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.date().optional(),
  incidenceTypes: z.array(z.enum(['DESIGN', 'FUNCTIONALITY', 'BUSINESS_RULE', 'COPY'])).min(1),
  experienceTags: z.array(z.enum(['UI', 'UX', 'COPY'])).optional(),
})

export type FindingCreate = z.infer<typeof FindingCreateSchema>

// lib/validators/import.ts

export const ImportPreviewSchema = z.object({
  file: z.instanceof(File).refine(f => ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'].includes(f.type), 'Solo XLSX o CSV'),
  projectId: z.string().uuid(),
})

// Middleware en Route Handler
export async function validateRequest(req: NextRequest) {
  const body = await req.json()
  const parsed = FindingCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({
      error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors }
    }, { status: 400 })
  }
  return parsed.data
}
```

---

## TRANSACCIONES — IMPORT IDEMPOTENTE

```typescript
// Pseudocódigo: Flujo de importación segura

async function confirmImport(batchId: UUID) {
  const batch = await db.importBatch.findUnique({ where: { id: batchId } })
  
  try {
    // Inicio de transacción
    await db.$transaction(async (tx) => {
      // 1. Crear TestSession si no existe
      const session = await tx.testSession.create({
        data: {
          projectId: batch.projectId,
          name: batch.originalFilename,
          date: new Date(),
          createdBy: batch.importedBy,
        }
      })
      
      // 2. Procesar cada fila
      for (const row of batch.rows) {
        // Calcular fingerprint (idempotencia)
        const fingerprint = sha256(
          batch.projectId + session.id + row.sourceRow + row.observation
        )
        
        // ¿Ya existe?
        const existing = await tx.finding.findFirst({
          where: { importBatchId: batch.id, sourceRow: row.sourceRow }
        })
        
        if (existing) continue // Skip duplicado en mismo batch
        
        // Crear Finding
        const finding = await tx.finding.create({
          data: {
            projectId: batch.projectId,
            testSessionId: session.id,
            observation: row.observation,
            status: 'OPEN',
            sourceRow: row.sourceRow,
            importBatchId: batch.id,
            priority: 'MEDIUM',
            severity: 'MINOR',
            // ...
          }
        })
        
        // 3. Subir evidencias (si existen)
        for (const imageName of row.evidenceFiles) {
          const buffer = await extractImageFromZip(batch.fileKey, imageName)
          const storageKey = await storage.upload(buffer, {
            path: `projects/${batch.projectId}/evidence/${finding.id}/${imageName}`
          })
          
          await tx.evidence.create({
            data: {
              findingId: finding.id,
              type: 'IMAGE',
              storageKey,
              originalFilename: imageName,
              mimeType: 'image/jpeg',
              createdBy: batch.importedBy,
            }
          })
        }
        
        // 4. Crear categorías (many-to-many)
        for (const tag of row.incidenceTypes) {
          await tx.findingIncidenceType.create({
            data: { findingId: finding.id, incidenceType: tag }
          })
        }
      }
      
      // 5. Actualizar batch
      await tx.importBatch.update({
        where: { id: batch.id },
        data: { status: 'COMPLETED' }
      })
    })
  } catch (error) {
    // Rollback automático
    await db.importBatch.update({
      where: { id: batch.id },
      data: { status: 'FAILED', errorMessage: error.message }
    })
    throw error
  }
}
```

---

## STORAGE INTERFACE (ADAPTER PATTERN)

```typescript
// lib/storage/types.ts

export interface IStorageService {
  upload(file: File, options: { path: string }): Promise<string> // storageKey
  download(storageKey: string): Promise<Buffer>
  delete(storageKey: string): Promise<void>
  getSignedUrl(storageKey: string, expiresIn?: number): Promise<string>
  exists(storageKey: string): Promise<boolean>
}

// lib/storage/s3.ts

export class S3StorageService implements IStorageService {
  private client: S3Client
  
  constructor(config: S3Config) {
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint, // Funciona con R2, MinIO, etc
    })
  }
  
  async upload(file: File, options: { path: string }): Promise<string> {
    const buffer = await file.arrayBuffer()
    await this.client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: options.path,
      Body: buffer,
      ContentType: file.type,
    }))
    return options.path
  }
  
  async getSignedUrl(storageKey: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: storageKey,
    })
    return await getSignedUrl(this.client, command, { expiresIn })
  }
  
  // ... otras métodos
}

// Factory
export function createStorageService(): IStorageService {
  const provider = process.env.STORAGE_PROVIDER || 's3'
  
  switch(provider) {
    case 's3':
      return new S3StorageService({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      })
    // ... casos para R2, MinIO
    default:
      throw new Error(`Unknown storage provider: ${provider}`)
  }
}

// Uso
const storage = createStorageService()
const signedUrl = await storage.getSignedUrl('projects/123/evidence/abc.jpg')
```

---

## AUTORIZACIÓN (RBAC SIMPLE)

```typescript
// lib/auth/permissions.ts

export const ROLE_PERMISSIONS = {
  OWNER: ['read', 'create', 'update', 'delete', 'invite', 'config'],
  QA_LEAD: ['read', 'create', 'update', 'validate', 'assign', 'reopen'],
  DESIGNER: ['read', 'comment', 'update_resolution'],
  DEVELOPER: ['read', 'comment', 'update_resolution'],
  BUSINESS_REVIEWER: ['read', 'validate'],
  VIEWER: ['read'],
}

// Middleware en Route Handler
export async function authorize(req: NextRequest, requiredAction: string) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  
  const projectId = req.nextUrl.searchParams.get('projectId')
  const member = await db.projectMember.findFirst({
    where: { projectId, userId: session.user.id }
  })
  
  const permissions = ROLE_PERMISSIONS[member.role] || []
  if (!permissions.includes(requiredAction)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  
  return { session, member, projectId }
}
```

---

## MIGRACIÓN PWA OFFLINE → DINÁMICO

### Fase Inicial (Sin Offline Mutations)
- PWA cachea último estado conocido
- Offline: pueden LEER datos cacheados
- Offline: NO pueden crear/editar (mostrar mensajes)
- Online: sync automático

### Fase Futura (Con Offline Mutations)
- IndexedDB local + mutation queue
- Crear Finding localmente
- Guardar en cola cuando online
- Sync on reconnect con conflict resolution
- Rollback si error

---

## PRÓXIMA FASE (DIAGRAMA)

```
FASE 0 (ACTUAL)
├── ✓ Auditoría completada
├── ✓ Arquitectura diseñada
└── Espera aprobación

FASE 1
├── Crear prisma/schema.prisma
├── PostgreSQL setup
├── Primeras migraciones
└── Validar modelo

FASE 2
├── Import preview/confirm
├── CSV/XLSX parser
├── StorageService (mock)

FASE 3
├── Route Handlers CRUD
├── Validación Zod
├── Autorización básica

... y así sucesivamente
```

---

## DECISIONES PENDIENTES DE USUARIO

1. **Auth**: ¿Auth.js v5? ¿NextAuth v4? ¿Custom JWT?
2. **Storage**: ¿AWS S3? ¿Cloudflare R2? ¿MinIO local?
3. **DB Hosted**: ¿Vercel Postgres? ¿Managed PostgreSQL?
4. **Soft Delete**: ¿Sí para Finding/Evidence/Project?
5. **RBAC**: ¿6 roles suficientes? ¿Agregar más?
6. **Offline Sync**: ¿MVP sin mutations? ¿Implementar desde inicio?
7. **Testing**: ¿Qué coverage target? ¿E2E en Playwright?

---

## RIESGOS Y MITIGACIÓN

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|-----------|
| 176 findings sin paginación → lento | ALTA | MEDIA | Implementar offset/limit desde inicio |
| Service Worker cache stuck | MEDIA | ALTA | Versionado de SW, cache busting |
| Dependencia "hono" sin uso | BAJA | BAJA | Investigar y limpiar |
| TypeScript errors ignorados | MEDIA | MEDIA | Resolver `ignoreBuildErrors` antes de Fase 1 |
| Auth complejidad subestimada | MEDIA | ALTA | Evaluar Auth.js pronto |
| Transacciones de importa fallan | BAJA | CRÍTICA | Tests de importación temprano |

---

## ÉXITO = CUANDO

✅ PostgreSQL con schema de datos
✅ API CRUD de findings funciona
✅ Import CSV/XLSX funciona
✅ Frontend lee datos dinámicos (NO JSON hardcoded)
✅ Evidencias se suben a storage
✅ Autorización bloquea sin permiso
✅ PWA offline sigue funcionando
✅ Tests críticos pasan
✅ Documentación actualizada

---

**Estado Final de Documento**: Listo para review.  
**Siguiente**: Esperar feedback usuario → Iniciar FASE 1 (Modelo de Datos).
