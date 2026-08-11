# Arquitectura Objetivo Ajustada - Pruebas María 2.0

**Fecha:** 2026-08-11  
**Fase:** 0 - propuesta ajustada al código real  
**Estado:** pendiente de revisión antes de Fase 1  

## Principio Rector

La arquitectura objetivo sigue siendo un **monolito modular con Next.js 16, Route Handlers, Prisma, PostgreSQL y Object Storage S3-compatible**, pero el repositorio ya contiene una implementación parcial. Por eso la arquitectura debe evolucionar por estabilización incremental, no por reemplazo.

Reglas:

- Mantener `public/app.html` temporalmente.
- Mantener PostgreSQL como fuente de verdad.
- Tratar object storage como fuente de binarios y PostgreSQL como fuente de metadata.
- Tratar Elasticsearch, IndexedDB, push y realtime como capacidades derivadas, nunca como fuente canónica.
- No crear microservicios ni infraestructura adicional.
- No cambiar el root routing hasta tener paridad y rollback.

## Vista General Ajustada

```text
Browser / PWA
  |
  |-- Legacy root: / -> /app.html
  |     - HTML estatico generado/derivado
  |     - Datos hardcodeados
  |     - Offline install/consulta actual
  |
  |-- Dynamic platform routes
        /login
        /findings
        /search
        /dashboard/analytics
        /projects/:projectId         (objetivo)
        /projects/:projectId/findings (objetivo)

Next.js 16 App Router
  |
  |-- Server Components para lectura inicial
  |-- Client Components solo para interaccion
  |-- Route Handlers /api/*
        |
        |-- validators (Zod)
        |-- auth/RBAC
        |-- services
        |-- repositories/data access
        |
        |-- Prisma 7 + PostgreSQL
        |-- StorageService -> S3-compatible storage
        |-- Search index derivado opcional
        |-- IndexedDB/SW como cache offline derivado
```

## Capas

### 1. UI

Ubicación objetivo:

```text
app/
  (platform)/
    projects/
      [projectId]/
        page.tsx
        findings/
          [findingId]/
            page.tsx

components/
  ui/
  features/
    findings/
    imports/
    evidence/
    workflow/
    analytics/
```

Uso:

- Server Components para cargar datos iniciales de proyectos/hallazgos.
- Client Components para búsqueda interactiva, filtros, upload, drawer, comentarios y transiciones.
- Mantener la identidad visual de `public/app.html`: paleta, tipografía, densidad, chips, jerarquía editorial-operativa.

No objetivo:

- No convertir toda la app a `use client`.
- No reemplazar el lenguaje visual con dashboard genérico.

### 2. API

Ubicación:

```text
app/api/
```

Convención objetivo:

- Usar `RouteContext`/`params: Promise<...>` compatible con Next.js 16.
- Validar inputs con Zod.
- Usar response envelope consistente.
- Revisar sesión y RBAC en backend.
- No usar spread ciego hacia Prisma.
- Usar transacciones para operaciones compuestas.

Envelope recomendado:

```json
{
  "data": {}
}
```

Errores:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mensaje legible",
    "fields": {}
  }
}
```

### 3. Servicios de Aplicación

Ubicación:

```text
lib/services/
```

Responsabilidades:

- Reglas de negocio.
- Transiciones de estado.
- Import pipeline.
- Cálculo de stats.
- Upload/metadata de evidencia.
- Auditoría.
- Indexación derivada.

Los servicios no deben depender de UI ni de objetos `Request`.

### 4. Data Access

Estado actual: el código usa Prisma directamente dentro de services y rutas.

Objetivo gradual:

```text
lib/repositories/
  project-repository.ts
  finding-repository.ts
  import-repository.ts
  evidence-repository.ts
```

No es obligatorio crear repositorios para todo de inmediato; sí conviene para:

- importación,
- transiciones,
- búsqueda/filtros,
- autorización por proyecto.

### 5. Prisma y PostgreSQL

Antes de nuevas migraciones:

1. Decidir schema final de foundation.
2. Comparar schema vs migraciones.
3. Generar una migración de reconciliación o reset controlado solo en entorno dev.
4. Validar fresh DB desde cero.
5. Nunca usar `migrate reset` o `DROP` en `/var/www` sin aprobación explícita.

Modelo conceptual base:

- User
- Session
- Project
- ProjectMember
- ProductVersion
- TestSession
- Finding
- FindingIncidenceType
- FindingExperienceTag
- Evidence
- Resolution
- Validation
- Comment
- FindingStatusHistory
- AuditLog
- ImportBatch

Extensiones ya presentes:

- PushSubscription
- Notification
- Activity

Recomendación: conservarlas solo si las migraciones y pruebas se estabilizan; si no, marcarlas como fases posteriores.

## Routing Objetivo

El repo actual tiene APIs parciales. La arquitectura final debe converger hacia:

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId

GET    /api/projects/:projectId/findings
POST   /api/projects/:projectId/findings

GET    /api/findings/:id
PATCH  /api/findings/:id
POST   /api/findings/:id/transitions
POST   /api/findings/:id/comments
POST   /api/findings/:id/resolutions
POST   /api/findings/:id/validations

POST   /api/findings/:id/evidence
DELETE /api/evidence/:id

GET    /api/projects/:projectId/stats

POST   /api/imports/preview
POST   /api/imports/:id/confirm
GET    /api/imports/:id
```

Compatibilidad temporal:

- Mantener `/api/findings?projectId=...` mientras se migran consumers.
- Mantener `/api/evidence/upload` hasta introducir ruta contextual.
- Mantener `/api/findings/stats` como alias si lo consume frontend existente.

## Modelo de Dominio

### Finding

Debe preservar:

- observación original,
- fuente histórica,
- estado,
- clasificación,
- asignación,
- prioridad/severidad/esfuerzo,
- versión de concurrencia,
- historial,
- evidencia original,
- resolución,
- evidencia de resolución,
- validación.

IDs:

- El schema actual usa `cuid()`.
- Los validators no deben exigir UUID si el dominio usa CUID.
- Elegir una estrategia y aplicarla en schema, validators, rutas y fixtures.

### Categorías

La arquitectura correcta es many-to-many:

```text
Finding -> FindingIncidenceType -> IncidenceType
Finding -> FindingExperienceTag -> ExperienceTag
```

El CSV histórico tiene un único campo `Área`; el importador debe mapearlo con reglas explícitas, no como copia directa.

Mapeo inicial recomendado:

```text
UI              -> experienceTag UI, incidenceType DESIGN
Copy            -> experienceTag COPY, incidenceType COPY
Funcionalidad   -> incidenceType FUNCTIONALITY
Backend         -> incidenceType FUNCTIONALITY
Negocio         -> incidenceType BUSINESS_RULE
```

Estas reglas deben quedar documentadas en `docs/backend/04-import-mapping.md` durante Fase 2.

### Estados

Estados de Finding:

```text
OPEN
TRIAGED
IN_PROGRESS
READY_FOR_VALIDATION
VALIDATED
CLOSED
BLOCKED
REOPENED
```

La transición debe:

- validar flujo permitido,
- exigir versión actual,
- responder `409` si hay conflicto,
- escribir `FindingStatusHistory`,
- escribir `AuditLog`,
- actualizar índice derivado si aplica.

No basta con `PATCH` genérico de status.

## Import Pipeline

Flujo objetivo:

```text
UPLOAD
  -> PARSE
  -> NORMALIZE
  -> VALIDATE
  -> DETECT DUPLICATES
  -> PREVIEW
  -> CONFIRM
  -> TRANSACTION
  -> IMPORT REPORT
```

Estado ajustado al repo:

- Fase inmediata debe estabilizar CSV.
- XLSX no debe marcarse soportado hasta incorporar parser real.
- No hay XLSX disponible para analizar imágenes embebidas.

Preview debe devolver:

- archivo,
- hojas detectadas si aplica,
- filas analizadas,
- registros válidos,
- filas ignoradas,
- errores,
- warnings,
- duplicados,
- columnas reconocidas,
- columnas desconocidas,
- categorías,
- evidencias encontradas.

Confirm debe:

- usar usuario real,
- exigir RBAC,
- usar transacción DB,
- persistir fingerprint,
- evitar duplicados,
- crear status history/audit,
- no subir binarios a storage dentro de una falsa transacción ACID.

Estrategia de fingerprint:

```text
sha256(projectId + normalizedSource + sheetOrCsv + sourceRow + normalizedObservation)
```

El fingerprint debe ser campo persistido con índice único dentro del alcance correcto. La misma observación en otra sesión puede ser válida, así que el alcance no debe ser solo texto.

## Evidencia y Storage

Objetivo:

```text
StorageService interface
  upload()
  delete()
  getSignedUrl()
  exists()

S3CompatibleStorageService
  AWS S3
  Cloudflare R2
  MinIO
```

Configuración:

```text
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_SIGNED_URL_EXPIRY
```

Reglas:

- Validar tamaño.
- Validar MIME real, no solo `Content-Type`.
- Sanitizar nombre.
- Guardar metadata en PostgreSQL.
- Guardar binarios en object storage.
- Usar URLs firmadas temporales para privado.
- Auditar upload/delete.
- Preferir soft delete para evidencia histórica.

## Auth y RBAC

Auth actual con Lucia puede reutilizarse si se estabiliza.

Arquitectura objetivo:

- `getSession()` server-side como fuente de usuario actual.
- `requireSession()` helper para APIs protegidas.
- `authorizeProject(user, projectId, action)` para reglas por membresía.
- `authorizeFinding(user, findingId, action)` para evitar IDOR.
- Roles globales y rol por proyecto reconciliados.

Reglas:

- No confiar en ocultar botones.
- No aceptar `createdBy`, `updatedBy`, `importedBy` desde cliente.
- Import, upload, validation, transition y bulk update deben exigir RBAC.

## Search

Arquitectura canónica:

- PostgreSQL filtra y pagina inventario transaccional.
- PostgreSQL cubre MVP search sobre `observation`, `resolution`, `screen`, `folio`.
- Elasticsearch, ya presente, debe ser índice derivado opcional.

Regla:

- Si Elasticsearch falla, la plataforma debe seguir funcionando con PostgreSQL.
- Si Elasticsearch queda activo, debe tener reindex job, health check, drift detection y documentación de consistencia eventual.

## PWA / Offline

Fase inicial ajustada:

- Mantener installability de legacy.
- Corregir cache manifest (`/manifest.webmanifest`) y fallback offline real.
- Evitar prometer sync offline completo para writes críticos hasta tener idempotencia y conflictos resueltos.

Fase posterior:

```text
IndexedDB cache
  + mutation queue
  + idempotency keys
  + background sync
  + conflict resolver
  + UI de pendientes/fallidos
```

La cola offline debe alinearse con optimistic concurrency; `409` no debe considerarse éxito silencioso sin resolver conflicto en UI.

## Analytics y Observabilidad

Stats deben venir de PostgreSQL:

- totalFindings
- openFindings
- validatedFindings
- closedFindings
- blockedFindings
- evidenceCount
- distribuciones por status, incidenceType, experienceTag, priority, severity, screen, session

Eventos preparados:

- finding_created
- finding_imported
- finding_viewed
- finding_status_changed
- finding_assigned
- finding_reopened
- evidence_uploaded
- comment_created
- validation_completed
- import_completed
- export_generated

Logging:

- requestId,
- operation,
- entityId,
- errorCode.

Nunca:

- passwords,
- tokens,
- cookies,
- secrets,
- URLs firmadas completas en logs.

## Seguridad

Prioridades antes de producción:

1. Sanear secretos hardcodeados y rotar credenciales si fueron reales.
2. Revisar archivos trackeados `.env*`.
3. Corregir auth/RBAC inconsistente.
4. Corregir mass assignment potencial.
5. Validar uploads con magic bytes.
6. Rate limiting para login/import/upload.
7. CSRF según estrategia de cookies.
8. IDOR por project/finding/evidence.
9. Error envelope sin leaks.
10. Auditoría sin secretos.

## Testing

Antes de Fase 1 o como primer bloque de Fase 1:

- Definir test runner: Vitest recomendado si se mantiene stack Vite-like para unit tests.
- Agregar script `test`.
- Asegurar que `pnpm lint`, `pnpm build`, `npx tsc --noEmit` sean señales reales.

Pruebas críticas:

- normalización CSV,
- fingerprint,
- transiciones de Finding,
- RBAC,
- validators,
- import preview,
- import confirm rollback,
- update conflict `409`,
- upload validation,
- project/finding IDOR.

## Deployment

Estrategia recomendada:

- Un solo package manager.
- CI en rama real (`master` o cambiar repo a `main`).
- `npm/pnpm ci` con dependencias necesarias para lint/build.
- `prisma generate`.
- `prisma migrate deploy` solo después de backup.
- Smoke tests:
  - `/api/health`
  - login,
  - list findings,
  - stats,
  - upload signed URL if configured.

Producción:

- Nunca migrar sin backup verificado.
- No usar valores literales de secretos en compose/docs.
- Separar `.env.example` de `.env.production`.
- Revisar `.gitignore` y archivos ya trackeados.

## Secuencia Recomendada de Fases

### Bloque 0A - Saneamiento Foundation

Antes de funcionalidad nueva:

- secrets/docs cleanup,
- package manager decision,
- ESLint install/config,
- test runner config,
- TypeScript errors,
- Next 16 params/proxy/config warnings,
- Prisma schema vs migrations.

### Fase 1 - Modelo de Datos Reconciliado

- Ajustar schema.
- Crear migración coherente.
- Fresh DB desde cero.
- Seed mínimo seguro.
- Documentar `02-data-model.md` y `03-state-machine.md`.

### Fase 2 - Importador CSV Real

- `04-import-mapping.md` desde CSV real.
- CSV parser/normalizer/validator.
- Duplicate detection.
- Preview.
- Confirm transaccional.
- Actor real y RBAC.

### Fase 2B - XLSX

Solo cuando exista archivo XLSX real:

- analizar hojas,
- evaluar ExcelJS u otra librería,
- extraer imágenes embebidas si existen,
- mapear hoja/fila/evidencia.

### Fase 3 - API Foundation

- Projects CRUD.
- Findings CRUD.
- Findings por proyecto.
- Transitions.
- Comments.
- Stats por proyecto.
- Response envelope consistente.

### Fase 4 - Evidencias

- StorageService neutral.
- S3/R2/MinIO compatible.
- MIME real.
- Signed URLs.
- Soft delete/audit.

### Fase 5 - Frontend Dinámico

- Migrar visualmente desde legacy.
- Inventario desde API/Server Components.
- Filtros server-side.
- Detail drawer/sheet.
- States loading/error/empty.

### Fase 6+ - Workflow, RBAC, PWA Sync, Hardening

- Completar resolución/validación.
- Reopen/history.
- Offline mutations.
- Tests.
- Observability.
- Security readiness.

## Non-goals

No hacer en esta fase:

- No eliminar `public/app.html`.
- No cambiar `/` a UI dinámica.
- No instalar paquetes.
- No escribir migraciones.
- No ejecutar migraciones.
- No implementar Prisma desde cero.
- No añadir microservicios, Kafka, RabbitMQ, Redis adicional, Kubernetes, GraphQL, CQRS, event sourcing ni vector DB.

## Criterio Para Avanzar a Fase 1

Fase 1 debe empezar solo cuando el equipo acepte:

- el diagnóstico de `00-current-state-audit.md`;
- que el repo ya tiene backend parcial;
- que se debe reconciliar y estabilizar antes de ampliar;
- si se conserva o se reduce temporalmente Elasticsearch/realtime/offline;
- qué package manager se usará;
- cómo se sanearán secretos existentes.

Hasta entonces, la recomendación es detenerse aquí.
