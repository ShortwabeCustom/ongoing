# Modelo de datos - Pruebas Maria 2.0

Fecha: 2026-08-11  
Fase: 1 - Modelo de datos  
Fuente de verdad: `prisma/schema.prisma`

Este documento describe el contrato de datos vigente para evolucionar la PWA estatica hacia la plataforma de evidencias. El modelo usa PostgreSQL + Prisma 7 con cliente generado en `lib/generated/prisma`.

## Estado de Fase 1

- Prisma ya estaba instalado y configurado.
- `prisma.config.ts` ahora declara `SHADOW_DATABASE_URL` opcional para diff/validacion de migraciones.
- `npx prisma validate` pasa sin warnings.
- Se agrego una migracion de reconciliacion: `prisma/migrations/zz_20260811000000_reconcile_phase1_schema/migration.sql`.
- La migracion fue probada sobre una DB temporal vacia con `prisma migrate deploy`; el diff final contra `schema.prisma` quedo sin diferencias.
- La DB local de desarrollo aun no tiene aplicada esa migracion. Esto es intencional: no se ejecutaron cambios destructivos ni `migrate dev` contra la DB de trabajo.

## Identificadores

Los modelos usan `String @default(cuid())`. No son UUID. Cualquier validator/API que exija `uuid()` debe considerarse deuda tecnica para Fase 3, salvo endpoints que ya hayan sido corregidos.

## Entidades

### User

Representa usuarios autenticados y actores de auditoria.

Campos principales:

- `id`
- `email`
- `name`
- `passwordHash`
- `role`
- `createdAt`, `updatedAt`, `deletedAt`

Relaciones:

- proyectos propios
- membresias de proyecto
- hallazgos creados, actualizados o asignados
- sesiones de prueba creadas
- evidencia y comentarios
- resoluciones, validaciones, historial y auditoria
- sesiones auth, push subscriptions, notificaciones y actividad

Soft delete: si, mediante `deletedAt`.

### Project

Agrupa producto o iniciativa.

Campos principales:

- `id`
- `name`
- `description`
- `ownerId`
- `createdAt`, `updatedAt`, `deletedAt`

Relaciones:

- `owner`
- `members`
- `versions`
- `testSessions`
- `findings`
- `importBatches`

Soft delete: si, mediante `deletedAt`.

### ProjectMember

Une usuarios con proyectos y su rol operativo dentro del proyecto.

Campos principales:

- `projectId`
- `userId`
- `role`
- `joinedAt`

Restriccion:

- `@@unique([projectId, userId])`

### ProductVersion

Version de producto evaluada.

Campos principales:

- `projectId`
- `version`
- `releasedAt`
- `createdAt`

Restriccion:

- `@@unique([projectId, version])`

### TestSession

Representa una sesion/ronda de pruebas.

Campos principales:

- `projectId`
- `versionId`
- `name`
- `date`
- `environment`
- `createdBy`
- `createdAt`

Relaciones:

- pertenece a `Project`
- pertenece a `ProductVersion`
- contiene muchos `Finding`
- puede tener un `ImportBatch`

### Finding

Entidad central del dominio.

Campos principales:

- `projectId`
- `testSessionId`
- `folio`
- `observation`
- `status`
- `version`
- `priority`
- `severity`
- `effort`
- `previousScreen`, `currentScreen`, `flowStep`
- `assigneeId`, `dueDate`
- `sourceSheet`, `sourceRow`, `importBatchId`
- `createdBy`, `updatedBy`
- `createdAt`, `updatedAt`, `deletedAt`

Relaciones:

- categorias multi-value via `FindingIncidenceType`
- etiquetas de experiencia via `FindingExperienceTag`
- muchas evidencias
- muchas resoluciones
- muchas validaciones
- comentarios
- historial de estado

Soft delete: si, mediante `deletedAt`.

Concurrencia:

- `version` habilita optimistic locking.
- Las actualizaciones deben comparar version cliente vs DB antes de escribir.

### FindingIncidenceType

Tabla pivote para tipos de incidencia.

Enum:

- `DESIGN`
- `FUNCTIONALITY`
- `BUSINESS_RULE`
- `COPY`

Clave:

- `@@id([findingId, incidenceType])`

### FindingExperienceTag

Tabla pivote para clasificacion UI/UX/Copy.

Enum:

- `UI`
- `UX`
- `COPY`

Clave:

- `@@id([findingId, experienceTag])`

### Evidence

Metadatos de evidencia almacenada en object storage o URLs externas.

Campos principales:

- `findingId`
- `type`
- `storageKey`
- `url`
- `originalFilename`
- `mimeType`
- `fileSize`
- `caption`
- `resolutionId`
- `validationId`
- `createdBy`
- `createdAt`

Tipos:

- `IMAGE`
- `VIDEO`
- `DOCUMENT`
- `FIGMA_URL`
- `EXTERNAL_URL`

Decision de Fase 1:

- No se agrego `deletedAt` a `Evidence` todavia.
- Motivo: borrar o restaurar evidencia requiere una politica coordinada con object storage. Agregar soft delete sin esa politica podria dejar objetos huerfanos o una falsa sensacion de retencion.
- Esta decision debe revisarse en la fase de Storage/API de evidencia.

### Resolution

Registro de propuesta o trabajo de resolucion asociado a un hallazgo.

Campos principales:

- `findingId`
- `state`
- `description`
- `notes`
- `assignedTo`
- `createdBy`
- `createdAt`, `updatedAt`

Relacion:

- un `Finding` puede tener muchas `Resolution`.
- una `Resolution` puede tener evidencia adjunta.

### Validation

Checkpoint de validacion del resultado.

Campos principales:

- `findingId`
- `result`
- `criteria`
- `notes`
- `validatedBy`
- `validatedAt`
- `createdAt`, `updatedAt`

Relacion:

- un `Finding` puede tener muchas `Validation`.
- una `Validation` puede tener evidencia adjunta.

Resultados:

- `PENDING`
- `PASS`
- `FAIL`

La migracion de reconciliacion mapea valores historicos:

- `PASSED` -> `PASS`
- `FAILED` -> `FAIL`
- `PARTIAL` -> `PENDING`

### Comment

Comentarios sobre un hallazgo.

Campos principales:

- `findingId`
- `text`
- `createdBy`
- `createdAt`, `updatedAt`

### FindingStatusHistory

Historial especifico de transiciones de estado de `Finding`.

Campos principales:

- `findingId`
- `fromStatus`
- `toStatus`
- `reason`
- `changedBy`
- `changedAt`

`reason` cumple el rol de comentario de transicion.

### AuditLog

Log generico de cambios significativos.

Campos principales:

- `entityType`
- `entityId`
- `action`
- `actorId`
- `before`
- `after`
- `createdAt`

Decisiones:

- `AuditLog` es generico, no una relacion fuerte a `Finding`.
- `actorId` es nullable para conservar auditoria si el usuario actor se elimina.
- No debe almacenar passwords, tokens, cookies ni secretos.

Acciones:

- `CREATE`
- `UPDATE`
- `DELETE`
- `STATUS_CHANGE`
- `ASSIGN`
- `VALIDATE`
- `RESOLVE`
- `IMPORT`

### ImportBatch

Control de lote de importacion.

Campos principales:

- `projectId`
- `testSessionId`
- `originalFilename`
- `fileSize`
- `importedAt`
- `totalRows`, `validRows`, `skippedRows`
- `status`
- `errorMessage`
- `importedBy`
- `createdAt`

Estados:

- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`
- `ROLLED_BACK`

### PushSubscription, Notification, Activity

Modelos existentes para fases posteriores de notificaciones y colaboracion.

Quedan en el schema porque ya existen servicios/componentes que los referencian, pero no son el foco funcional de Fase 1.

## Indices principales

Se mantienen indices para consultas esperadas:

- `projectId`
- `testSessionId`
- `status`
- `priority`
- `assigneeId`
- `createdAt`
- `createdAt, status`
- `importBatchId`
- `deletedAt`
- pivotes de categorias
- `AuditLog.entityType, entityId`
- `AuditLog.action`
- `Validation.result`
- `Validation.result, validatedAt`
- `Resolution.state`

## Migracion de Fase 1

Archivo:

`prisma/migrations/zz_20260811000000_reconcile_phase1_schema/migration.sql`

Incluye:

- `ResolutionState`
- cambios de `ValidationResult`
- campos de workflow en `Resolution` y `Validation`
- relacion opcional de evidencia con resolucion/validacion
- tablas `push_subscriptions` y `notifications`
- indices faltantes
- reconciliacion de foreign keys/referential actions
- `AuditLog.actorId` nullable

Validacion ejecutada:

- `DATABASE_URL=<db temporal> npx prisma migrate deploy`
- `DATABASE_URL=<db temporal> npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`

Resultado:

- Todas las migraciones aplican desde DB vacia.
- No queda diferencia contra `schema.prisma`.

## Deuda tecnica que no se resuelve en Fase 1

- La DB local de desarrollo tiene la migracion nueva pendiente.
- Varias Route Handlers aun deben migrarse al contrato Next.js 16 con `params: Promise`.
- El importador real corresponde a Fase 2; aun debe incorporar mapping, fingerprint, preview/confirm robusto y auth real.
- Algunos validators usan UUID aunque los modelos usan CUID.
- `public/app.html` sigue siendo legacy y no fue modificado.
