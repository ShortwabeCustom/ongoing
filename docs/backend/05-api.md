# API — Fase 3

Estado: implementado como Route Handlers de Next.js 16 con `params` asíncrono, validación Zod y autorización server-side mediante la sesión Lucia existente.

## Convenciones

- Respuestas exitosas: JSON directo desde `apiSuccess(data, statusCode)`.
- Errores: `code`, `message` y `fields` opcional desde `apiError`.
- IDs públicos: CUID/string, validados por longitud mínima en endpoints nuevos.
- Mutaciones de hallazgo: allowlist explícita de campos; no se hace `data: body`.
- Concurrencia: `PATCH /api/findings/:id` y `POST /api/findings/:id/transitions` requieren `version` y responden `409` cuando la versión cambió.

## Proyectos

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/projects` | Lista proyectos accesibles para el usuario autenticado. |
| POST | `/api/projects` | Crea proyecto y membresía OWNER inicial. |
| GET | `/api/projects/:projectId` | Obtiene proyecto con versiones, sesiones y conteos. |
| PATCH | `/api/projects/:projectId` | Actualiza nombre/descripción del proyecto. |

## Sesiones

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/projects/:projectId/sessions` | Lista sesiones de prueba del proyecto. |
| POST | `/api/projects/:projectId/sessions` | Crea sesión y hace upsert de `ProductVersion`. |

Payload de creación:

```json
{
  "name": "Pruebas 30 de julio",
  "date": "2026-07-30T00:00:00.000Z",
  "environment": "staging",
  "version": "legacy-import"
}
```

## Hallazgos

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/findings` | Lista global filtrada/paginada. |
| GET | `/api/projects/:projectId/findings` | Lista hallazgos filtrados por proyecto. |
| POST | `/api/projects/:projectId/findings` | Crea hallazgo con categorías multi-valor. |
| GET | `/api/findings/:id` | Detalle con evidencia, resolución, validación, comentarios e historial. |
| PATCH | `/api/findings/:id` | Edición con optimistic locking y auditoría. |
| DELETE | `/api/findings/:id` | Soft delete con auditoría. |
| POST | `/api/findings/:id/transitions` | Cambio de estado validado por state machine. |
| GET | `/api/findings/:id/comments` | Lista comentarios. |
| POST | `/api/findings/:id/comments` | Agrega comentario y audita. |

Filtros soportados por GET findings:

- `status`
- `incidenceType`
- `experienceTag` / `area`
- `priority`
- `severity`
- `assigneeId`
- `testSessionId` / `session`
- `screen`
- `search`
- `createdAfter` / `createdBefore`
- `createdFrom` / `createdTo`
- `updatedAfter` / `updatedBefore`
- `limit`
- `offset`
- `sort`

## Categorías Y Stats

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/categories` | Devuelve enums de estados, incidencia, experiencia, prioridad, severidad y esfuerzo. |
| GET | `/api/findings/stats` | Agregados globales desde PostgreSQL. |
| GET | `/api/projects/:projectId/stats` | Agregados por proyecto. |

Stats incluye:

- `totalFindings`
- `openFindings`
- `validatedFindings`
- `closedFindings`
- `blockedFindings`
- `evidenceCount`
- distribución por status, incidence type, experience tag, priority, severity, screen y test session.

## Evidencia, Resolución Y Validación Existentes

Se mantuvieron y tiparon para Next.js 16:

- `POST /api/findings/:id/evidence`
- `PATCH /api/evidence/:id`
- `DELETE /api/evidence/:id`
- `POST /api/evidence/:id/refresh-url`
- `POST /api/findings/:id/resolutions`
- `GET /api/findings/:id/resolutions`
- `GET /api/findings/:id/resolutions/:resId`
- `PATCH /api/findings/:id/resolutions/:resId`
- `POST /api/findings/:id/validations`
- `GET /api/findings/:id/validations`
- `POST /api/findings/:id/validations/:valId/check`
- `GET /api/findings/:id/audit-log`
- `GET /api/findings/:id/audit-log/export`

## Verificación

- `npx tsc --noEmit --pretty false` ya no reporta errores de rutas dinámicas Next 16 ni de los servicios/rutas de Fase 3.
- El build completo sigue limitado por el entorno: el intento previo terminó con código `137` durante `pnpm build`.
- Persisten errores TypeScript ajenos a Fase 3 en tests sin dependencias, UI de evidencia/búsqueda, realtime/offline y tipados Elasticsearch; quedan para fases posteriores de hardening.
