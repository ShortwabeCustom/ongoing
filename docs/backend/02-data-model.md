# 📊 MODELO DE DATOS — Pruebas María 2.0

**Fecha**: 2026-08-07  
**Status**: Implementado en Prisma ✓  
**ORM**: Prisma 7.9.1  
**Database**: PostgreSQL 15+

---

## RELACIONES DE ENTIDADES

```
┌──────────────┐
│ User         │
├──────────────┤
│ id (PK)      │
│ email (UQ)   │
│ name         │
│ role (Enum)  │
│ createdAt    │
└──────────────┘
       │
       ├─────────────────────┬──────────────────┬─────────────────┐
       │                     │                  │                 │
       ▼                     ▼                  ▼                 ▼
  ┌─────────────┐    ┌───────────────┐  ┌──────────────┐  ┌──────────────┐
  │ProjectMember│    │Finding        │  │Evidence      │  │Comment       │
  └─────────────┘    │(createdBy,    │  └──────────────┘  └──────────────┘
                     │updatedBy,     │
                     │assignee)      │
                     └───────────────┘


┌────────────┐
│ Project    │ ◀──── 1:N ────── ProjectMember
├────────────┤
│ id (PK)    │
│ name       │
│ ownerId(FK)│ ─────────► User
└────────────┘
     │
     ├─ 1:N ──────► ProductVersion
     │
     ├─ 1:N ──────► TestSession
     │
     └─ 1:N ──────► Finding


┌──────────────────┐
│ ProductVersion   │
├──────────────────┤
│ id (PK)          │
│ projectId (FK)   │
│ version (String) │
│ releasedAt       │
└──────────────────┘
     │
     └─ 1:N ──────► TestSession


┌──────────────────┐
│ TestSession      │
├──────────────────┤
│ id (PK)          │
│ projectId (FK)   │
│ versionId (FK)   │
│ name (String)    │
│ date             │
│ environment      │
│ createdBy (FK)   │
└──────────────────┘
     │
     ├─ 1:N ──────► Finding
     │
     └─ 1:1 ──────► ImportBatch


┌──────────────────────────────┐
│ Finding (CORE)               │ ◀──── El corazón del dominio
├──────────────────────────────┤
│ id (PK)                      │
│ projectId (FK)               │
│ testSessionId (FK)           │
│ observation (Text)           │
│ status (Enum)                │
│ priority (Enum)              │
│ severity (Enum)              │
│ effort (Enum)                │
│ version (Int - opt lock)     │
│ assigneeId (FK, nullable)    │
│ importBatchId (FK, nullable) │
│ createdBy (FK)               │
│ updatedBy (FK, nullable)     │
│ createdAt / updatedAt        │
│ deletedAt (soft delete)      │
└──────────────────────────────┘
     │
     ├─ N:M ──────► IncidenceType (FindingIncidenceType pivot)
     │
     ├─ N:M ──────► ExperienceTag (FindingExperienceTag pivot)
     │
     ├─ 1:N ──────► Evidence
     │
     ├─ 1:1 ──────► Resolution
     │
     ├─ 1:1 ──────► Validation
     │
     ├─ 1:N ──────► Comment
     │
     ├─ 1:N ──────► FindingStatusHistory
     │
     └─ 1:N ──────► AuditLog


┌────────────────────────────────┐
│ FindingIncidenceType (Pivot)   │
├────────────────────────────────┤
│ findingId (PK, FK)             │
│ incidenceType (PK, Enum)       │
│                                │
│ Enum values:                   │
│ • DESIGN                       │
│ • FUNCTIONALITY                │
│ • BUSINESS_RULE                │
│ • COPY                         │
└────────────────────────────────┘


┌────────────────────────────────┐
│ FindingExperienceTag (Pivot)   │
├────────────────────────────────┤
│ findingId (PK, FK)             │
│ experienceTag (PK, Enum)       │
│                                │
│ Enum values:                   │
│ • UI                           │
│ • UX                           │
│ • COPY                         │
└────────────────────────────────┘


┌──────────────────┐
│ Evidence         │ ◀──── Imágenes, videos, documentos
├──────────────────┤
│ id (PK)          │
│ findingId (FK)   │
│ type (Enum)      │
│ storageKey       │ ──────► S3 path
│ url              │ ──────► Signed URL
│ originalFilename │
│ mimeType         │
│ fileSize         │
│ caption          │
│ createdBy (FK)   │
│ createdAt        │
└──────────────────┘


┌──────────────────┐
│ Resolution       │ ◀──── Cómo se resolvió
├──────────────────┤
│ id (PK)          │
│ findingId (UQ)   │
│ description      │
│ createdBy (FK)   │
│ createdAt        │
│ updatedAt        │
└──────────────────┘


┌──────────────────┐
│ Validation       │ ◀──── Fue validado?
├──────────────────┤
│ id (PK)          │
│ findingId (UQ)   │
│ result (Enum)    │ ─► PASSED / FAILED / PARTIAL
│ notes            │
│ validatedBy (FK) │
│ validatedAt      │
└──────────────────┘


┌──────────────────┐
│ Comment          │ ◀──── Comentarios en hallazgo
├──────────────────┤
│ id (PK)          │
│ findingId (FK)   │
│ text (Text)      │
│ createdBy (FK)   │
│ createdAt        │
│ updatedAt        │
└──────────────────┘


┌───────────────────────────┐
│ FindingStatusHistory      │ ◀──── Auditoría de cambios
├───────────────────────────┤
│ id (PK)                   │
│ findingId (FK)            │
│ fromStatus (Enum)         │
│ toStatus (Enum)           │
│ reason (Text, nullable)   │
│ changedBy (FK)            │
│ changedAt (DateTime)      │
└───────────────────────────┘


┌───────────────────────────┐
│ AuditLog                  │ ◀──── Log general de cambios
├───────────────────────────┤
│ id (PK)                   │
│ entityType (String)       │
│ entityId (UUID)           │
│ action (Enum)             │
│ before (JSON)             │
│ after (JSON)              │
│ actorId (FK)              │
│ createdAt                 │
│                           │
│ Actions:                  │
│ • CREATE                  │
│ • UPDATE                  │
│ • DELETE                  │
│ • STATUS_CHANGE           │
│ • ASSIGN                  │
│ • VALIDATE                │
│ • RESOLVE                 │
│ • IMPORT                  │
└───────────────────────────┘


┌──────────────────────┐
│ ImportBatch          │ ◀──── Lote de importación
├──────────────────────┤
│ id (PK)              │
│ projectId (FK)       │
│ testSessionId (UQ)   │
│ originalFilename     │
│ fileSize             │
│ totalRows            │
│ validRows            │
│ skippedRows          │
│ status (Enum)        │
│ errorMessage         │
│ importedBy (FK)      │
│ createdAt            │
│                      │
│ Status:              │
│ • PENDING            │
│ • PROCESSING         │
│ • COMPLETED          │
│ • FAILED             │
│ • ROLLED_BACK        │
└──────────────────────┘
```

---

## ÍNDICES DE BASE DE DATOS

```sql
-- Performance para búsquedas frecuentes
CREATE INDEX idx_finding_projectid ON findings(projectId);
CREATE INDEX idx_finding_status ON findings(status);
CREATE INDEX idx_finding_testsession ON findings(testSessionId);
CREATE INDEX idx_finding_assignee ON findings(assigneeId);
CREATE INDEX idx_finding_priority ON findings(priority);
CREATE INDEX idx_finding_created ON findings(createdAt DESC);

-- Soft deletes
CREATE INDEX idx_finding_not_deleted ON findings(projectId, status)
  WHERE deletedAt IS NULL;

-- Relaciones
CREATE INDEX idx_evidence_finding ON evidence(findingId);
CREATE INDEX idx_statushistory_finding ON finding_status_history(findingId);
CREATE INDEX idx_auditlog_entity ON audit_logs(entityType, entityId);
```

---

## RESTRICCIONES ÚNIQUES

```sql
-- Usuarios
CREATE UNIQUE INDEX idx_user_email ON users(email);

-- Proyectos
-- (no unique email, pero sí email por usuario)

-- ProjectMembers
CREATE UNIQUE INDEX idx_projectmember_unique ON project_members(projectId, userId);

-- ProductVersions
CREATE UNIQUE INDEX idx_productversion_unique ON product_versions(projectId, version);

-- TestSession
CREATE UNIQUE INDEX idx_testsession_importbatch ON test_sessions(id)
  WHERE EXISTS (SELECT 1 FROM import_batches WHERE import_batches.testSessionId = test_sessions.id);

-- Finding
-- (version es para optimistic locking, no unique)

-- Resolution / Validation
CREATE UNIQUE INDEX idx_resolution_finding ON resolutions(findingId);
CREATE UNIQUE INDEX idx_validation_finding ON validations(findingId);

-- FindingIncidenceType / FindingExperienceTag
-- (PK compuesto ya garantiza unicidad)
```

---

## FOREIGN KEY CONSTRAINTS

```sql
-- Cascade on delete para relaciones normales
-- SetNull para opcional (ej: assigneeId, updatedBy)
-- Cascade para puros borrados (soft delete manejo)

-- ON DELETE rules:
-- • User: No cascade (evitar borrar usuarios con datos)
-- • Project: Cascade (si borro proyecto, borro todo)
-- • TestSession: Cascade (si borro sesión, borro hallazgos)
-- • Finding: NO cascade (Finding es central)
-- • Evidence: Cascade (depende de Finding)
-- • ImportBatch: SetNull (para auditoría)
```

---

## CAMPOS ESPECIALES

### Optimistic Locking
```
Finding.version (Int, default: 1)

ANTES de UPDATE:
  WHERE id = ? AND version = ?
  
Si version no coincide:
  409 Conflict (otro usuario actualizó)
  
Si éxito:
  version = version + 1
```

### Soft Delete
```
Finding.deletedAt (DateTime, nullable)

Query por defecto:
  WHERE deletedAt IS NULL
  
Restaurar:
  UPDATE finding SET deletedAt = NULL WHERE id = ?
```

### Signed URLs
```
Evidence.storageKey   (ruta en S3)
Evidence.url          (signed URL, temporal)

GET /evidence/123 → devuelve URL firmada actual
```

---

## ENUMS DEFINIDOS

### UserRole
```
OWNER                 ← Acceso completo
QA_LEAD              ← Crear/validar hallazgos
DESIGNER             ← Trabajar hallazgos UI/Copy
DEVELOPER            ← Trabajar hallazgos funcionalidad
BUSINESS_REVIEWER    ← Revisar reglas de negocio
VIEWER               ← Solo lectura
```

### FindingStatus
```
OPEN                 ← Nuevo hallazgo
TRIAGED              ← Analizado, listo para trabajo
IN_PROGRESS          ← Siendo resuelto
READY_FOR_VALIDATION ← Esperando validación
VALIDATED            ← Validado exitoso
CLOSED               ← Cerrado (resuelto + validado)
BLOCKED              ← Bloqueado (espera recurso externo)
REOPENED             ← Reabierto (falló validación)
```

### FindingPriority
```
LOW      ← No urgente
MEDIUM   ← Estándar
HIGH     ← Importante
CRITICAL ← Bloqueador
```

### FindingSeverity
```
COSMETIC ← Visual, no funcional
MINOR    ← Impacto bajo
MAJOR    ← Impacto significativo
BLOCKER  ← Bloquea funcionalidad
```

### FindingEffort
```
S  ← Small (< 2h)
M  ← Medium (2-4h)
L  ← Large (4-8h)
XL ← Extra Large (> 8h)
```

### IncidenceType
```
DESIGN         ← Problema de diseño
FUNCTIONALITY  ← Problema funcional
BUSINESS_RULE  ← Regla de negocio
COPY           ← Problema de texto
```

### ExperienceTag
```
UI   ← Interfaz
UX   ← Experiencia
COPY ← Texto/Contenido
```

### EvidenceType
```
IMAGE         ← Imagen (PNG, JPG)
VIDEO         ← Video (MP4, etc)
DOCUMENT      ← Documento (PDF, Word)
FIGMA_URL     ← Link a Figma
EXTERNAL_URL  ← URL externa
```

### ValidationResult
```
PASSED  ← Validó correctamente
FAILED  ← No pasó validación
PARTIAL ← Parcialmente validado
```

### AuditAction
```
CREATE        ← Entidad creada
UPDATE        ← Campos actualizados
DELETE        ← Borrado (soft)
STATUS_CHANGE ← Cambio de estado
ASSIGN        ← Asignación
VALIDATE      ← Validación
RESOLVE       ← Resolución
IMPORT        ← Importación
```

### ImportStatus
```
PENDING     ← Esperando confirmación
PROCESSING  ← En procesamiento
COMPLETED   ← Completado
FAILED      ← Error durante importación
ROLLED_BACK ← Transacción revocada
```

---

## ARCHIVOS GENERADOS

```
prisma/
├── schema.prisma         ← Definición completa (440 líneas)
├── migrations/
│   └── [timestamp]_init  ← Primera migración (generated)
└── seed.ts (futuro)      ← Seeder para datos de prueba

lib/
├── db.ts                 ← Cliente Prisma singleton
├── types/
│   └── index.ts          ← Re-exports de Prisma types
└── validators/
    ├── finding.ts        ← Esquemas Zod para Finding
    └── import.ts         ← Esquemas Zod para Import

.env                      ← Configuración local
.env.example              ← Plantilla con placeholders
.gitignore                ← Actualizado con .env
```

---

## PRÓXIMOS PASOS

1. ✓ Schema definido en Prisma
2. ⏳ Generar migración inicial: `pnpm exec prisma migrate dev --name init`
3. ⏳ Crear seed.ts para datos de prueba
4. ⏳ Documentar API endpoints
5. ⏳ Implementar Route Handlers

---

## NOTAS DE DISEÑO

### Por qué N:M con Pivot
- Un hallazgo puede tener múltiples incidenceTypes (DESIGN + BUSINESS_RULE)
- Un hallazgo puede tener múltiples experienceTags (UI + COPY)
- Pivot tables permiten queries eficientes: `WHERE incidenceType = 'DESIGN'`

### Por qué Soft Delete
- Hallazgos son históricos
- No queremos perder auditoría
- Recuperación posible si error

### Por qué Optimistic Locking
- Concurrencia: dos usuarios editando simultáneamente
- Sin lock = última escritura gana (bad)
- Con versión = conflicto detectado (good)

### Por qué Separate Resolution/Validation
- Finding original se preserva
- Resolution = cómo se arregló
- Validation = fue correcta la resolución?
- Permite ANTES/DESPUÉS en UI

---

**Status**: Schema listo para migración.  
**Siguiente**: Generar migración con `prisma migrate dev --name init`
