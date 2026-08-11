# Security / RBAC — Fase 7

Estado: autenticación existente Lucia reutilizada, con permisos de backend para APIs críticas.

## Autenticación

- La sesión se lee desde `auth_session` con `getSession()`.
- No se agregó una segunda librería de auth.
- Los atributos de usuario expuestos por Lucia son `id`, `email`, `name` y `role`.
- Se corrigió la configuración de cookie para la versión instalada de Lucia.

## Roles

Roles soportados:

- `OWNER`
- `QA_LEAD`
- `DESIGNER`
- `DEVELOPER`
- `BUSINESS_REVIEWER`
- `VIEWER`

## Autorización

`lib/middleware/rbac.ts` centraliza permisos por rol.

Endpoints protegidos:

- proyectos
- sesiones
- hallazgos
- transiciones
- evidencia
- importación
- analytics
- miembros

## Project Members

Se agregaron endpoints:

- `GET /api/projects/:projectId/members`
- `POST /api/projects/:projectId/members`
- `PATCH /api/projects/:projectId/members/:memberId`
- `DELETE /api/projects/:projectId/members/:memberId`

Reglas:

- lectura: usuarios con acceso al proyecto
- administración: dueño del proyecto o rol global `OWNER`
- no se puede remover al owner del proyecto
- el owner del proyecto debe conservar rol `OWNER`

## Controles Implementados

- validación server-side con Zod
- allowlist explícita en mutaciones
- optimistic locking en edición/transición de hallazgos
- auditoría de cambios relevantes
- soft delete para Finding y Evidence
- signed URLs temporales para evidencia privada
- errores consistentes y sin detalles sensibles

## Pendiente De Hardening

- rate limiting real para login/import/upload
- CSRF según política final de cookies/sesión
- pruebas automatizadas de permisos
- revisión IDOR por proyecto en todas las rutas antiguas
- logging estructurado con request id
