# Auditoría del Estado Actual - Pruebas María 2.0

**Fecha:** 2026-08-11  
**Fase:** 0 - auditoría solamente  
**Rama:** `master`  
**Commit revisado:** `9ec2aae`  
**Directorio:** `/var/www/apps/uix`
**Alcance:** diagnóstico técnico sin cambios funcionales.

## Resumen Ejecutivo

El repositorio ya no está en el estado "frontend estático sin backend" descrito por documentación anterior. Hoy conviven dos superficies:

1. **Legacy PWA:** `public/app.html`, servido en `/`, con 176 hallazgos y KPIs hardcodeados.
2. **Plataforma dinámica parcial:** rutas Next.js App Router, Route Handlers bajo `app/api`, Prisma 7, PostgreSQL, Lucia auth, RBAC parcial, R2/S3 storage parcial, Elasticsearch, PWA/offline sync, push notifications y componentes React de búsqueda/evidencia/workflow.

La arquitectura objetivo del master prompt sigue siendo válida, pero la siguiente fase no debe "crear desde cero"; debe **normalizar, reparar y cerrar brechas** sobre una implementación existente e inconsistente.

Hallazgos críticos:

- `public/app.html` sigue siendo la entrada principal por rewrite de `/` a `/app.html`.
- Prisma existe y el schema valida, pero **las migraciones no corresponden completamente al schema actual**.
- `pnpm build` pasa, pero lo hace con `typescript.ignoreBuildErrors: true`; `tsc --noEmit` falla.
- `pnpm lint` no corre porque `eslint` no está instalado/configurado.
- Existen secretos o valores sensibles hardcodeados en archivos de soporte/deploy y scripts. No se reproducen aquí.
- Hay APIs implementadas, pero faltan endpoints centrales del prompt: `projects`, `POST findings`, transiciones de estado de Finding y rutas por proyecto.
- Importación actual es CSV-first; acepta MIME de XLSX en el endpoint, pero el parser real es Papa Parse sobre texto.
- La autenticación existe con Lucia, pero la autorización es inconsistente entre endpoints.

## Fuentes Revisadas

Se revisaron los archivos solicitados y los equivalentes reales del repo:

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `doc./architecture.md`
- `docs/reference/file-structure.md`
- `doc./readme.md`
- `doc./guides/development_setup.md`
- `package.json`
- `next.config.mjs`
- `tsconfig.json`
- `public/manifest.webmanifest`
- `public/app.html`
- `app/`
- `components/`
- `lib/`
- `prisma/`
- `public/contenido/`
- `public/sw.js`
- `.github/workflows/deploy.yml`
- `Dockerfile`
- `docker-compose*.yml`

También se leyó documentación local de Next.js 16 en:

- `node_modules/next/dist/doc./index.md`
- `node_modules/next/dist/docs/01-ap./index.md`
- `node_modules/next/dist/docs/03-architectur./index.md`
- `node_modules/next/dist/docs/01-app/04-glossary.md`

Observación Next.js 16: los tipos generados en `.next/types/routes.d.ts` esperan `params: Promise<...>` para App Router y Route Handlers. Varias rutas actuales todavía usan `params` síncrono.

## Estado Git y Ambiente

Rama actual: `master`.

Estado inicial observado antes de modificar documentación:

- Cambios existentes en `.next/*`, `Dockerfile`, `next-env.d.ts`.
- Archivos no trackeados: `.env.docker`, `docker-compose.app.yml`.

Después de correr verificaciones no destructivas, `tsconfig.tsbuildinfo` y artefactos `.next` también quedaron modificados por herramientas de build/typecheck. No se revirtieron cambios existentes.

Versiones detectadas:

- Node.js: `v20.20.2`
- npm: `10.8.2`
- pnpm: `10.33.0`

Package manager ambiguo:

- Existen `package-lock.json` y `pnpm-lock.yaml`.
- `package.json` usa scripts npm-style.
- Documentación reciente recomienda npm; documentación antigua menciona pnpm.
- Para esta auditoría se ejecutaron comandos con `pnpm` porque el prompt pide reportar `pnpm lint` y `pnpm build`.

## Estructura Real del Proyecto

Rutas principales:

```text
app/
  api/
    analytics/
    auth/
    evidence/
    findings/
    health/
    imports/
    notifications/
    realtime/
    search/
    users/
  dashboard/analytics/page.tsx
  findings/page.tsx
  login/page.tsx
  page.tsx
  search/page.tsx
  test-import/page.tsx
  layout.tsx
  globals.css

components/
  analytics/
  auth/
  evidence/
  features/import/
  finding/
  notifications/
  realtime/
  search/
  ui/
  workflow/

lib/
  api/
  auth/
  constants/
  elasticsearch/
  hooks/
  indexeddb/
  middleware/
  services/
  storage/
  types/
  utils/
  validators/

prisma/
  schema.prisma
  migrations/

public/
  app.html
  sw.js
  manifest.webmanifest
  contenido/
  images/
  icons/
```

La documentación existente en `docs/backend/00-current-state-audit.md` y `docs/backend/01-target-architecture.md` era de 2026-08-07 y ya estaba obsoleta.

## Next.js 16 y Routing

Stack detectado:

- Next.js `16.3.0`
- React `^19`
- TypeScript `5.7.3`
- Tailwind CSS `4.3.3`

`next.config.mjs`:

- Rewrites `beforeFiles`: `/` -> `/app.html`.
- `typescript.ignoreBuildErrors: true`.
- `images.unoptimized: true`.
- `experimental.instrumentationHook: false`, reportado por build como opción inválida/deprecada.
- Headers básicos de seguridad para todo el sitio, `sw.js`, manifest e imágenes.

`app/page.tsx` también redirige a `/app.html` si el rewrite no aplica.

Conclusión: la navegación raíz sigue anclada a legacy. Las rutas dinámicas existen, pero no son la primera pantalla.

## `public/app.html`

`public/app.html` es un artefacto legacy derivado, no una fuente limpia de dominio.

Evidencia:

- Es un HTML monolítico de 1,727 líneas.
- Incluye CSS, JS, 176 `<details>` y KPIs hardcodeados.
- Registra `public/sw.js`.
- Hace navegación interna por anchors (`#insights`, `#hallazgos`, `#documentos`).
- No consulta API para hallazgos ni estadísticas.
- Contiene textos, conteos y referencias a imágenes directamente embebidos.

Cómo se genera o modifica:

- No se encontró un generador único que reconstruya `app.html` desde cero.
- Sí existen scripts Python que lo mutan:
  - `scripts/clasificar.py` lee `public/contenido/inventario-observaciones.csv` y escribe `clasificacion-diseno-copy.json`.
  - `scripts/inyectar_chips.py` lee `app.html` y `clasificacion-diseno-copy.json` para inyectar chips.
  - `scripts/inyectar_filtros.py` lee y modifica `app.html` para agregar `data-status`, `data-ronda` y filtros.

Conclusión: durante la migración debe tratarse como **legacy artifact / compatibility shell**. No debe convertirse en la nueva fuente de verdad.

## Datos Históricos Disponibles

No se encontró `Pruebas Maria 2.0.xlsx` ni `Pruebas Maria 2.csv` en el repo.

Fuente disponible:

- `public/contenido/inventario-observaciones.csv`
- `public/contenido/inventario-observaciones.json`
- `public/contenido/MANIFIESTO.json`
- `public/contenido/clasificacion-diseno-copy.json`
- `public/images/image1.jpg` a `image173.jpg`
- PDFs fuente bajo `public/contenido/fuentes-originales/`

CSV real:

```text
ID
Ronda
Fila fuente
Observación
Ajuste
Comentarios
Estatus
Área
Etapa
Evidencias
```

Conteos del CSV:

- Filas: 176
- Observaciones vacías: 0
- IDs únicos: 176
- Estatus: `Completado` 82, `Pendiente` 94
- Áreas: `UI` 103, `Copy` 26, `Funcionalidad` 26, `Backend` 12, `Negocio` 9
- Rondas: `Pruebas 30 de julio` 104, `Mod 31 Jul` 19, `Pruebas 3 agosto` 1, `Pruebas 4 - 5 agosto` 52
- Etapas: `Etapa 1` 26, `Etapa 2` 150
- Filas sin evidencia: 20
- Referencias de evidencia: 198 totales, 172 únicas

Detalle importante: el CSV/JSON referencian `imageN.png`, pero los archivos reales son `public/images/imageN.jpg`. Las 172 referencias únicas tienen variante `.jpg` existente.

No se puede analizar extracción de imágenes embebidas en XLSX porque no hay XLSX disponible en el repo.

## Frontend React Actual

Rutas React existentes:

- `/findings`: renderiza `SearchFindings`.
- `/search`: ruta de búsqueda.
- `/dashboard/analytics`: server component con auth, RBAC y servicios de analytics.
- `/login`: formulario Lucia.
- `/test-import`: pantalla de importación con `projectId` hardcodeado de prueba.

Componentes reutilizables importantes:

- `components/search/SearchFindings.tsx`
- `components/search/AdvancedFilterPanel.tsx`
- `components/search/BatchActionsToolbar.tsx`
- `components/evidence/EvidenceUploader.tsx`
- `components/evidence/EvidenceGallery.tsx`
- `components/features/import/import-dialog.tsx`
- `components/workflow/ResolutionWorkflow.tsx`
- `components/workflow/ValidationCheckpoint.tsx`
- `components/analytics/*`
- `components/auth/*`
- `components/realtime/*`
- `components/notifications/*`

Problemas del frontend actual:

- La UI dinámica se ve más dashboard/admin genérico que evolución visual directa del legacy.
- Textos de import/evidence mezclan inglés y español.
- `app/layout.tsx` mantiene metadata hardcodeada con 176/82/94/173.
- `test-import` usa un project id placeholder que no es compatible con validación UUID del endpoint.
- Algunos componentes usan tipos obsoletos (`Finding.title`, `Finding.description`, `Finding.area`) que no existen en el modelo Prisma actual.

## Información Hardcodeada

Hardcoded funcional:

- `public/app.html`: KPIs, hallazgos, filtros, evidencias y textos.
- `app/layout.tsx`: metadata con conteos hardcodeados.
- `app/test-import/page.tsx`: `projectId="test-project-id-1"`.
- `app/api/imports/preview/route.ts`: `createdBy: 'system'`, `importedBy: 'system'`.
- `app/api/imports/[id]/confirm/route.ts`: usuario `'system'`.
- `app/api/findings/[id]/validations/*`: `temp-user-id`.

Hardcoded sensible:

- Se detectaron valores de credenciales/secretos o datos sensibles en archivos de soporte/deploy/scripts. No se reproducen en esta auditoría.
- Algunos archivos de documentación también contienen ejemplos con valores que parecen credenciales reales. Deben sanearse.

## API Actual

Route Handlers detectados:

```text
GET    /api/analytics/activity
GET    /api/analytics/summary
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/session
PATCH  /api/evidence/:id
DELETE /api/evidence/:id
POST   /api/evidence/:id/refresh-url
POST   /api/evidence/upload
GET    /api/findings
GET    /api/findings/:id
PATCH  /api/findings/:id
DELETE /api/findings/:id
GET    /api/findings/:id/audit-log
GET    /api/findings/:id/audit-log/export
GET    /api/findings/:id/resolutions
POST   /api/findings/:id/resolutions
GET    /api/findings/:id/resolutions/:resId
PATCH  /api/findings/:id/resolutions/:resId
GET    /api/findings/:id/validations
POST   /api/findings/:id/validations
POST   /api/findings/:id/validations/:valId/check
POST   /api/findings/bulk-update
GET    /api/findings/stats
GET    /api/health
GET    /api/imports/:id
POST   /api/imports/:id/confirm
POST   /api/imports/preview
POST   /api/notifications/subscribe
DELETE /api/notifications/subscribe
GET    /api/realtime/activity
GET    /api/realtime/presence
POST   /api/realtime/presence
GET    /api/search/findings
GET    /api/search/lookups
GET    /api/users
POST   /api/users
PATCH  /api/users/:id
DELETE /api/users/:id
GET    /api/users/me
```

Brechas frente al master prompt:

- No existe `GET/POST /api/projects`.
- No existe `GET/PATCH /api/projects/:projectId`.
- No existe `GET/POST /api/projects/:projectId/findings`.
- No existe `POST /api/findings` para creación directa.
- No existe `POST /api/findings/:id/transitions` para estado de Finding.
- No existe `POST /api/findings/:id/comments`.
- Las estadísticas están en `/api/findings/stats`, no por proyecto.
- Import preview/confirm no usa usuario real ni RBAC.
- No hay confirmación de idempotencia real en importación.

## Validación y Errores API

Existe Zod en:

- `lib/validators/finding.ts`
- `lib/validators/query.ts`
- `lib/validators/search-query.ts`
- `lib/validators/import.ts`
- `lib/validators/auth.ts`
- `lib/validators/workflow.ts`
- `lib/validators/evidence.ts`

Existe helper común en `lib/utils/api-response.ts`, pero no se usa de forma consistente.

Inconsistencias:

- Algunas rutas devuelven `{ code, message }`.
- Otras devuelven `{ error: string }`.
- Otras envuelven `{ status: 'success', data }` dentro de `apiSuccess`, duplicando estilos.
- `apiError` no acepta segundo argumento, pero al menos una ruta lo llama como si lo aceptara.
- Import endpoints no usan `ImportPreviewSchema` para validar el FormData completo.
- Validadores exigen UUID para `projectId`, mientras Prisma usa `cuid()`.

## Base de Datos y Prisma

Prisma existe:

- `prisma/schema.prisma`
- `prisma.config.ts`
- `lib/db.ts`
- `lib/db-lazy.ts`
- `lib/prisma.ts`
- `lib/generated/prisma/*`

Dependencias:

- `@prisma/client` `^7.9.1`
- `prisma` `^7.9.1`
- `@prisma/adapter-pg` `^7.9.1`
- `pg` `^8.22.0`
- `@prisma/cli` `3.0.0-beta.30` en devDependencies, lo cual es sospechoso junto con Prisma 7.

El schema actual modela:

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
- PushSubscription
- Notification
- Activity

El schema valida con warning:

- Prisma advierte que una relación usa `onDelete: SetNull` sobre campo requerido.

Riesgo crítico: migraciones desalineadas.

- Solo existen tres migraciones: `1786121852_init`, `add_auth_session`, `add_activities_fase10`.
- El schema actual incluye `PushSubscription` y `Notification`, pero no se encontraron migraciones que creen esas tablas.
- `ValidationResult` en migración inicial usa `PASSED/FAILED/PARTIAL`, mientras el schema actual usa `PENDING/PASS/FAIL`.
- `AuditLog` en migración inicial usa `entityType/entityId/before/after`, mientras el schema actual usa `findingId/changes/details/actorId`.
- `Resolution` y `Validation` cambiaron respecto a la migración inicial.
- El código de servicios usa campos (`state`, `criteria`, `changes`, `resolutionId`, `validationId`) que no están garantizados por las migraciones existentes.

Conclusión: antes de cualquier migración de producción se debe reconciliar schema, migraciones y base real.

## Autenticación y RBAC

Autenticación:

- Implementada con Lucia 3.
- Sesiones persistidas en tabla `sessions`.
- Cookie `auth_session`, httpOnly, sameSite lax, secure en producción.
- Password hashing con `@node-rs/argon2`.

RBAC:

- Helper `checkRBAC` en `lib/middleware/rbac.ts`.
- Roles del prompt presentes: OWNER, QA_LEAD, DESIGNER, DEVELOPER, BUSINESS_REVIEWER, VIEWER.

Brechas:

- `middleware.ts` deja pasar todo y comenta que está deshabilitado durante pruebas RBAC.
- Varias APIs verifican RBAC, pero otras no.
- Search permite acceso no autenticado (`requireAuth: false`).
- Validations todavía usan usuario temporal.
- Import todavía usa actor `system`.
- Project membership no se usa de forma consistente para autorización por proyecto.
- Faltan pruebas ejecutables de RBAC por falta de test runner.

## Storage y Evidencias

Storage actual:

- `StorageService` sube a `R2Client`.
- `R2Client` usa AWS SDK S3 compatible.
- Env vars usan prefijo `S3_*`.
- URLs firmadas con `@aws-sdk/s3-request-presigner`.

Fortalezas:

- No guarda binarios en PostgreSQL.
- Metadata en tabla `Evidence`.
- Límite de tamaño de archivo.
- Lista de MIME permitidos.
- Limpieza compensatoria: si falla DB tras upload, intenta borrar de R2.

Brechas:

- El servicio está acoplado nominalmente a R2; falta interfaz/adaptador proveedor-neutral (`StorageService` + `S3StorageService`/`R2StorageService`).
- La validación de MIME se basa en `file.type`; no valida magic bytes.
- No sanitiza nombres de archivo antes de armar storage key.
- Evidence delete hace delete físico de DB y storage; no hay soft delete/auditoría de evidencia.
- No hay soporte real para video ni documentos fuera de los MIME permitidos actuales.
- Import crea metadata de evidencia pero no sube archivos ni verifica existencia.

## Importación Actual

Implementación:

- `POST /api/imports/preview`
- `POST /api/imports/:id/confirm`
- `GET /api/imports/:id`
- `ImportService`
- `NormalizationService`
- `parseCSV` con Papa Parse
- `components/features/import/import-dialog.tsx`

Estado real:

- Preview parsea CSV y normaliza.
- Confirm ejecuta transacción Prisma para crear findings/evidence/tags/history/audit.
- `potentialDuplicates` siempre es `0`.
- Fingerprint existe como helper, pero no se persiste ni se consulta.
- No hay soporte real XLSX.
- No hay extracción de imágenes embebidas.
- No hay RBAC ni usuario real.
- Se crea `TestSession` en preview con datos que no satisfacen el schema actual (`versionId`, `date`, `createdBy` real).
- El `batchId` se genera con `Math.random` aunque schema usa `cuid()` por defecto y validators esperan UUID en otros lugares.

Conclusión: importación es prototipo avanzado para CSV, no importador productivo.

## Búsqueda y Analytics

Búsqueda:

- Elasticsearch integrado con índice `findings-v1`.
- Fallback a `/api/findings` si falla ES.
- Filtros avanzados y batch actions en frontend.

Brecha con el master prompt:

- El prompt pedía no introducir Elasticsearch para MVP; el repo ya lo introdujo.
- Recomendación: mantener PostgreSQL como fuente canónica y tratar Elasticsearch como índice derivado opcional, nunca como fuente de verdad.

Analytics:

- Servicios y componentes existentes calculan KPIs desde DB.
- Dashboard `/dashboard/analytics` exige sesión y rol de analytics.

Riesgos:

- Fire-and-forget de indexación puede desincronizar ES.
- Docs reportan blocker `hasEvidence` en ES; código ya incluye `evidenceCount`, pero no se validó índice real.

## PWA y Offline

Manifest:

- `public/manifest.webmanifest`
- `start_url: "/"`, `scope: "/"`, display standalone.
- Shortcuts a anchors legacy.

Service worker actual:

- `public/sw.js`
- Cache names: `pruebas-maria-v1`, `pruebas-maria-api-v1`, `pruebas-maria-assets-v1`.
- API: network-first con timeout.
- Assets: cache-first.
- Background sync sobre IndexedDB `sync_queue`.
- Push notifications.

Brechas:

- `URLS_TO_CACHE` incluye `/manifest.json`, pero el archivo real es `/manifest.webmanifest`.
- `URLS_TO_CACHE` incluye `/offline.html`, pero no se encontró `public/offline.html`.
- El legacy `app.html` registra el SW por su cuenta, y los hooks React también registran `/sw.js`.
- La cola offline usa idempotency keys, pero no se confirmó cobertura server-side completa.

Conclusión: PWA/offline existe y va más allá de Fase inicial, pero requiere reconciliación antes de considerarse product-ready.

## Deployment y Entorno

Archivos detectados:

- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `docker-compose.app.yml` no trackeado
- `.github/workflows/deploy.yml`
- `doc./deployment.md`
- `doc./final_deployment_guide.md`
- `doc./production_runbook.md`
- `doc./production_status.md`

CI/CD:

- Workflow corre en `main`, pero rama local actual es `master`.
- Usa npm cache e `npm ci --omit=dev`.
- Luego ejecuta `npm run lint` y `npm run build`.
- Riesgo: `eslint` está en script pero no en dependencias, y con `--omit=dev` cualquier dependencia dev requerida para build/lint puede faltar.

Variables de entorno detectadas por nombre, sin valores:

```text
DATABASE_URL
S3_ENDPOINT
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_SIGNED_URL_EXPIRY
AUTH_SECRET
AUTH_TRUST_HOST
GITHUB_ID
GITHUB_SECRET
NODE_ENV
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_ENABLE_OFFLINE_SYNC
NEXT_PUBLIC_IMPORT_MAX_FILE_SIZE
NEXT_PUBLIC_ANALYTICS_ID
ELASTICSEARCH_URL
ELASTICSEARCH_FINDINGS_INDEX
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
SENTRY_DSN
LOG_LEVEL
SEED_DB
RATE_LIMIT_WINDOW_MS
RATE_LIMIT_MAX_REQUESTS
```

Riesgos:

- `.env.production` está trackeado.
- `docker-compose.app.yml` no trackeado contiene valores sensibles o placeholders inseguros.
- Documentación y scripts incluyen ejemplos con credenciales. Deben sanearse y rotarse si fueron reales.

## Dependencias Reutilizables

Reutilizables:

- Next.js 16 / App Router
- React 19
- Tailwind 4
- Zod
- Prisma 7 + adapter pg
- Lucia + Argon2
- AWS SDK S3 compatible
- Papa Parse para CSV
- Elasticsearch client, si se conserva como índice derivado
- Socket.io, Redis y Web Push, si se priorizan fases posteriores
- `idb` para offline
- `lucide-react`
- `date-fns`
- `recharts`

Riesgos de dependencias:

- No existe `eslint` instalado aunque hay script `lint`.
- No existe Vitest/Jest/Playwright configurado aunque hay tests.
- `@prisma/cli` beta no coincide con Prisma 7 estable.
- Package manager duplicado.

## Componentes Que Deben Conservarse

Legacy visual:

- Paleta verde institucional (`#052b20`, `#00a85a`, etc.).
- Tipografía Poppins.
- Hero editorial con imagen real.
- KPIs compactos.
- Lista de hallazgos con detalles expandibles.
- Chips Diseño/Copy y estados visibles.
- Filtros por estado/ronda.
- PWA install prompt.
- Documentos descargables.

Plataforma React:

- Search/findings components como base, pero con alineación visual.
- Evidence gallery/uploader.
- Workflow components.
- Analytics components.
- Auth components.
- Notification/realtime/offline utilities, previa estabilización.

## Problemas Técnicos Bloqueantes

Prioridad crítica:

- Resolver secretos/credenciales hardcodeadas y rotar si fueron reales.
- Reconciliar Prisma schema, generated client, migrations y base real.
- Quitar `typescript.ignoreBuildErrors` después de reparar type errors.
- Corregir `scripts/create-user.ts`, que rompe `tsc --noEmit`.
- Instalar/configurar ESLint o cambiar el script de lint.
- Definir un solo package manager.
- Corregir Route Handler params para Next.js 16 (`params: Promise<...>`).
- Reemplazar actores `system`/`temp-user-id` por sesión real.
- Crear autorización por proyecto/miembro en backend.

Prioridad alta:

- Implementar `projects` API y `POST findings`.
- Implementar transición de estados de Finding con history/audit/version.
- Reparar importación para idempotencia real.
- Separar CSV de XLSX; no aceptar XLSX hasta tener parser real.
- Reconciliar PWA cache URLs.
- Sanear docs que contradicen el código actual.

Prioridad media:

- Volver UI dinámica más cercana al legacy visual.
- Definir si Elasticsearch queda o se posterga.
- Soft delete/auditoría para evidencia.
- Rate limiting en auth/import/upload.
- Observabilidad estructurada sin secretos.

## Verificación Ejecutada

Comandos no destructivos ejecutados:

```text
git status --short
git branch --show-current
npx prisma validate
pnpm lint
pnpm build
pnpm test
npx tsc --noEmit
```

Resultados:

- `npx prisma validate`: pasa; warning por `onDelete: SetNull` con campo requerido.
- `pnpm lint`: falla; `eslint` no encontrado.
- `pnpm build`: pasa, pero:
  - falla carga de `.env.production` con `RangeError: Maximum call stack size exceeded`;
  - reporta `experimental.instrumentationHook` inválido/deprecado;
  - reporta `middleware` deprecado a favor de `proxy`;
  - omite validación de TypeScript por configuración.
- `pnpm test`: falla; no hay script `test`.
- `npx tsc --noEmit`: falla en `scripts/create-user.ts` con error de sintaxis (`'from' expected`).

No se ejecutó migración ni comandos destructivos de base de datos.

## Estrategia de Migración Recomendada

El enfoque debe ser Strangler, pero ajustado a que ya existe backend parcial:

1. Mantener `/` -> `/app.html` mientras se corrigen fundamentos.
2. Congelar cambios funcionales en legacy salvo correcciones críticas.
3. Reparar foundation antes de agregar features:
   - schema/migrations,
   - TypeScript,
   - lint/tests,
   - auth/RBAC,
   - secrets,
   - import CSV real.
4. Consolidar rutas dinámicas bajo una convención por proyecto.
5. Migrar UI progresivamente desde el lenguaje visual legacy hacia React dinámico.
6. Solo cambiar root routing cuando haya paridad funcional/visual y plan de rollback.

## Conclusión de Fase 0

El proyecto ya contiene gran parte de la plataforma deseada, pero está en un estado de integración incompleta. La próxima fase no debe ser "crear Prisma" sino **estabilizar la base existente**:

- decidir si se conserva el schema actual o se ajusta antes de una nueva migración;
- reconciliar migraciones;
- sanear secretos;
- arreglar TypeScript/lint/test runner;
- cerrar auth/RBAC en import, validation y search;
- corregir importador CSV antes de prometer XLSX.

No se debe iniciar Fase 1 hasta revisar y aprobar este diagnóstico.
