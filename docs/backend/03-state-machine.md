# Maquina de estados - Pruebas Maria 2.0

Fecha: 2026-08-11  
Fase: 1 - Modelo de datos  
Fuente de verdad: `prisma/schema.prisma` y `lib/validators/workflow.ts`

Este documento separa tres conceptos que antes estaban mezclados:

- estado operativo del hallazgo: `FindingStatus`
- estado de trabajo de una resolucion: `ResolutionState`
- resultado de validacion: `ValidationResult`

## FindingStatus

Estados del hallazgo:

- `OPEN`
- `TRIAGED`
- `IN_PROGRESS`
- `READY_FOR_VALIDATION`
- `VALIDATED`
- `CLOSED`
- `BLOCKED`
- `REOPENED`

Estado inicial:

- `OPEN`

## Transiciones objetivo de Finding

| Desde | Hacia | Uso |
| --- | --- | --- |
| `OPEN` | `TRIAGED` | El hallazgo fue revisado y clasificado. |
| `TRIAGED` | `IN_PROGRESS` | Se inicia trabajo de resolucion. |
| `IN_PROGRESS` | `BLOCKED` | El trabajo queda bloqueado. |
| `BLOCKED` | `IN_PROGRESS` | Se desbloquea el trabajo. |
| `IN_PROGRESS` | `READY_FOR_VALIDATION` | La resolucion esta lista para revision. |
| `READY_FOR_VALIDATION` | `VALIDATED` | Validacion exitosa. |
| `READY_FOR_VALIDATION` | `IN_PROGRESS` | Validacion fallida; regresa a trabajo. |
| `VALIDATED` | `CLOSED` | Cierre operativo. |
| `VALIDATED` | `REOPENED` | Reapertura por hallazgo no resuelto o regresion. |
| `CLOSED` | `REOPENED` | Reapertura posterior al cierre. |
| `REOPENED` | `TRIAGED` | El hallazgo reabierto vuelve a analisis. |

Transiciones invalidas relevantes:

- `OPEN` -> `VALIDATED`
- `OPEN` -> `CLOSED`
- `TRIAGED` -> `CLOSED`
- `IN_PROGRESS` -> `CLOSED`
- `BLOCKED` -> `VALIDATED`

## Efectos obligatorios por cambio de FindingStatus

Cada cambio significativo de `Finding.status` debe:

- incrementar `Finding.version`
- crear `FindingStatusHistory`
- registrar `fromStatus`
- registrar `toStatus`
- registrar `changedBy`
- registrar `reason` cuando exista
- crear `AuditLog` con `entityType = "Finding"` y `entityId = finding.id`

La validacion de permisos pertenece a Fase 3/API, pero la regla objetivo es:

- `OWNER` y `QA_LEAD` pueden cerrar, validar y reabrir.
- `DESIGNER`, `DEVELOPER` y `BUSINESS_REVIEWER` pueden trabajar resoluciones segun categoria/responsabilidad.
- `VIEWER` solo lectura.

## ResolutionState

Estados de resolucion:

- `OPEN`
- `TRIAGED`
- `INVESTIGATING`
- `PROPOSED`
- `APPROVED`
- `IMPLEMENTED`
- `VERIFIED`
- `CLOSED`

Estado inicial:

- `OPEN`

Transiciones permitidas en `lib/validators/workflow.ts`:

| Desde | Hacia |
| --- | --- |
| `OPEN` | `TRIAGED`, `OPEN` |
| `TRIAGED` | `INVESTIGATING`, `OPEN` |
| `INVESTIGATING` | `PROPOSED`, `OPEN` |
| `PROPOSED` | `APPROVED`, `OPEN` |
| `APPROVED` | `IMPLEMENTED`, `OPEN` |
| `IMPLEMENTED` | `VERIFIED`, `OPEN` |
| `VERIFIED` | `CLOSED`, `OPEN` |
| `CLOSED` | `OPEN` |

Notas:

- `Resolution` es historial de trabajo, no reemplaza el estado del hallazgo.
- Un `Finding` puede tener muchas resoluciones.
- Evidencia puede vincularse a una resolucion mediante `Evidence.resolutionId`.
- Cambios de resolucion usan `AuditAction.RESOLVE`.

## ValidationResult

Resultados:

- `PENDING`
- `PASS`
- `FAIL`

Estado inicial:

- `PENDING`

Reglas:

- `PENDING` significa checkpoint creado pero no concluido.
- `PASS` permite mover el hallazgo de `READY_FOR_VALIDATION` a `VALIDATED`.
- `FAIL` regresa el hallazgo a `IN_PROGRESS`.
- Evidencia puede vincularse a una validacion mediante `Evidence.validationId`.
- Cambios de validacion usan `AuditAction.VALIDATE`.

La migracion de Fase 1 reemplaza los valores historicos `PASSED/FAILED/PARTIAL` por `PASS/FAIL/PENDING`.

## Mapping legacy inicial

Durante importacion futura:

- `Completado`, `TRUE` o `VERDADERO` pueden mapear inicialmente a `VALIDATED`.
- `Pendiente`, `FALSE` o `FALSO` pueden mapear inicialmente a `OPEN`.

Esta regla debe documentarse y hacerse configurable en Fase 2. No debe inferirse `CLOSED` solo porque una fila legacy indique completado.

## AuditAction

Acciones vigentes:

- `CREATE`
- `UPDATE`
- `DELETE`
- `STATUS_CHANGE`
- `ASSIGN`
- `VALIDATE`
- `RESOLVE`
- `IMPORT`

`AuditLog` almacena `before` y `after` como JSON. No debe registrar secretos.

## Invariantes

- Un `Finding` no se borra fisicamente en flujos normales: usa `deletedAt`.
- `FindingStatusHistory` conserva transiciones de estado, no ediciones generales.
- `AuditLog` conserva cambios significativos de cualquier entidad mediante `entityType/entityId`.
- `Validation` y `Resolution` son colecciones historicas; no son relaciones 1:1.
- `Evidence` pertenece siempre a un `Finding` y opcionalmente a una `Resolution` o `Validation`.
- La UI puede mostrar nombres en espanol, pero los enums internos permanecen en ingles.

## Pendiente para fases posteriores

- Implementar enforcement completo de transiciones en API.
- Corregir Route Handlers dinamicos a `params: Promise` de Next.js 16.
- Reemplazar validators `uuid()` por validacion compatible con CUID.
- Integrar auth real en import preview/confirm; no usar actores funcionales como `system`.
- Definir politica de retencion/soft delete para evidencia y object storage.
