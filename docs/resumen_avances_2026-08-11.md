# Resumen de avances - Pruebas Maria 2.0

Fecha de corte: 2026-08-11  
Ultima actualizacion: 2026-08-11 08:20 UTC  
Deploy publico: https://uix.torrax.cloud

## Resumen ejecutivo

Pruebas Maria 2.0 paso de ser un PWA estatico compartible a una plataforma full-stack desplegada publicamente. El sitio mantiene el reporte legacy en `/` mediante la estrategia strangler, mientras expone una aplicacion dinamica con Next.js 16, APIs protegidas, PostgreSQL, Prisma, autenticacion, RBAC, workflows, evidencias, importacion, busqueda, PWA/offline y documentacion operativa.

El deploy publico esta corriendo con PM2 detras de Nginx. La base de datos tiene todas las migraciones aplicadas y el health endpoint responde correctamente con base de datos sana. Elasticsearch queda tratado como componente opcional/derivado para no bloquear el MVP. La interfaz dinamica ya fue alineada visualmente con el PWA legacy y se agrego la ruta protegida `/profile`.

## Estado publico actual

- Dominio publico activo: `https://uix.torrax.cloud`.
- Runtime: Next.js 16.3.0 servido por PM2 en puerto `3000`.
- Reverse proxy: Nginx hacia el proceso Next.js.
- Ruta principal `/`: sirve el paquete PWA legacy en `public/app.html`.
- Rutas dinamicas confirmadas: `/login`, `/findings`, `/findings/{id}`, `/search`, `/dashboard/analytics`, `/test-import`, `/profile`.
- APIs protegidas activas: por ejemplo `/api/projects` devuelve `401` sin sesion, comportamiento esperado.
- PWA activa: `/sw.js`, `/offline.html` y `/manifest.webmanifest` responden `200`.
- Health publico: `/api/health` responde `200` con `healthy`.
- Busqueda publica: `/api/search/findings?limit=1` responde `200` con `total: 176`, usando fallback PostgreSQL.

Nota sobre health: la base de datos esta sana. Elasticsearch esta deshabilitado como componente opcional, por lo que no bloquea la plataforma ni genera estado degradado.

## Avances por area

### 1. Arquitectura base

- Se consolido el proyecto como monolito modular con Next.js App Router.
- Se definieron capas claras:
  - UI React/App Router.
  - Route Handlers bajo `app/api`.
  - Validadores.
  - Servicios de dominio.
  - Prisma Client.
  - PostgreSQL.
  - Object storage S3-compatible para binarios.
- Se documento la arquitectura en `ARCHITECTURE.md`.
- Se mantiene `public/app.html` como reporte offline legacy y se sirve en `/`.
- Se reemplazo `middleware.ts` por `proxy.ts` para alinearse con la convencion actual de Next.js.

### 2. Base de datos y Prisma

- Se reconcilio `prisma/schema.prisma` con el estado real de la plataforma.
- Se agregaron/aplicaron migraciones de reconciliacion:
  - `zz_20260811000000_reconcile_phase1_schema`
  - `zzz_20260811010000_import_fingerprint`
  - `zzzz_20260811020000_evidence_soft_delete`
- Se corrigieron migraciones para ser tolerantes a diferencias del estado previo de la base.
- `npx prisma migrate deploy` quedo ejecutado correctamente.
- `npx prisma migrate status` confirma: `Database schema is up to date!`.
- `npx prisma generate` se ejecuto correctamente.

### 3. Dominio funcional

- Modelo dinamico para proyectos, miembros, versiones, sesiones de prueba, hallazgos, categorias, evidencias, resoluciones, validaciones, comentarios, historial y auditoria.
- Los hallazgos usan control de concurrencia optimista mediante version.
- Los cambios relevantes generan historial/auditoria.
- Evidencias separadas entre metadata relacional en PostgreSQL y archivos en storage compatible con S3.

### 4. Importacion

- Se implemento flujo de preview/confirm para importaciones.
- Se agrego normalizacion de datos historicos.
- Se incorporo fingerprint/idempotencia para evitar duplicados de import.
- Se separo parser/import service para mantener reglas de dominio fuera de la UI.
- Se documentaron mapping y estrategia de importacion en `docs/backend/04-import-mapping.md`.

### 5. APIs backend

- Se consolidaron Route Handlers para:
  - autenticacion,
  - usuarios,
  - proyectos,
  - sesiones,
  - hallazgos,
  - categorias,
  - evidencias,
  - resoluciones,
  - validaciones,
  - transiciones,
  - comentarios,
  - auditoria,
  - imports,
  - analytics,
  - busqueda,
  - realtime/presence,
  - notificaciones.
- Se estandarizaron respuestas y validaciones.
- Se reforzaron rutas protegidas con autenticacion/RBAC donde aplica.
- Se agrego `/api/health` con chequeo de base de datos y Elasticsearch opcional.

### 6. Autenticacion y RBAC

- Autenticacion con sesiones y hashing Argon2id.
- Roles soportados:
  - `OWNER`
  - `QA_LEAD`
  - `DESIGNER`
  - `DEVELOPER`
  - `BUSINESS_REVIEWER`
  - `VIEWER`
- Helpers RBAC centralizados para proteger operaciones sensibles.
- Login publico probado con una cuenta `OWNER`.
- Las APIs protegidas devuelven `401` cuando no hay sesion.

### 7. Frontend dinamico

- Se habilitaron pantallas dinamicas principales:
  - login,
  - listado de hallazgos,
  - detalle de hallazgo,
  - busqueda,
  - analytics,
  - importacion de prueba,
  - perfil de usuario.
- Se conectaron componentes de hallazgos, evidencia, workflow, auditoria y busqueda a servicios/APIs.
- Se agregaron componentes PWA para registrar service worker y solicitar permisos de push cuando corresponde.
- El root `/` conserva el reporte legacy para continuidad publica.
- Se agrego `AppShell` como layout editorial comun para las pantallas dinamicas, con navegacion, hero visual, imagen de portada, logo y metricas.
- Se incorporo la tipografia Poppins y tokens visuales compartidos con el PWA legacy.
- Se redisenaron los formularios, chips, tarjetas, paneles, estados de carga y vistas principales para una apariencia mas cercana a la base publica.

### 8. Workflows

- Flujo de resoluciones y validaciones.
- Transiciones de estado de hallazgos.
- Registro de auditoria por cambios relevantes.
- Historial de estado.
- Validaciones/checkpoints asociados a hallazgos.

### 9. PWA y offline

- Service worker activo en `/sw.js`.
- Fallback offline en `/offline.html`.
- Manifest activo en `/manifest.webmanifest`.
- Cache de shell/assets.
- IndexedDB para cache local y cola de sincronizacion.
- Background Sync cuando el navegador lo soporta.
- Las APIs autenticadas no se precachean para evitar guardar datos privados en CacheStorage.

### 10. Busqueda y Elasticsearch

- Se mantiene PostgreSQL como fuente canonica.
- Elasticsearch queda como indice derivado/opcional.
- El health endpoint ya no bloquea produccion si Elasticsearch no responde.
- Cuando Elasticsearch este disponible, puede usarse para busqueda avanzada y agregaciones.
- `/api/search/findings` cuenta con fallback PostgreSQL y evita la cadena de errores `503` cuando Elasticsearch no esta disponible.
- La UI de busqueda usa resultados iniciales, filtros rapidos, modo panel y modo dropdown segun la ruta.

### 11. Redisenio UX frontend

- Se redisenaron las rutas principales con una linea visual consistente:
  - `/login`
  - `/findings`
  - `/findings/{id}`
  - `/search`
  - `/dashboard/analytics`
  - `/test-import`
  - `/profile`
- Se creo `components/app/AppShell.tsx` para centralizar:
  - header sticky,
  - navegacion principal,
  - menu de usuario,
  - indicador offline,
  - hero con imagen editorial,
  - estadisticas por pantalla.
- Se mejoraron `app/globals.css` y los componentes compartidos con:
  - fuentes Poppins locales,
  - variables de color `--pm-*`,
  - clases utilitarias `pm-shell`, `pm-card`, `pm-card-subtle`, `pm-panel-dark`, `pm-chip`, `pm-chip-active`, `pm-input`.
- Se modernizo `/login` con imagen editorial, formulario en tarjeta, iconos y copy en espanol.
- Se modernizaron `/findings` y `/search` con busqueda en panel, chips de estado/prioridad y resultados en tarjetas compactas.
- Se modernizo `/findings/{id}` con vista protegida, estadisticas del hallazgo, acciones de estado, evidencia, workflow, validacion y auditoria.
- Se modernizo `/dashboard/analytics` con layout editorial, filtros, KPIs, graficas y actividad reciente.
- Se modernizo `/test-import` con selector de proyecto, flujo upload/preview/confirm y tabla de preview en espanol.
- Se corrigio la experiencia mobile de busqueda para evitar apertura automatica innecesaria del bottom sheet en modo panel.

### 12. Perfil de usuario

- Se agrego la ruta protegida `/profile`.
- El menu de usuario ya no apunta a una ruta inexistente.
- Comportamiento validado:
  - sin sesion: `/profile` redirige a `/login` con `307`;
  - con sesion: `/profile` responde `200`.
- Se agrego `components/auth/ProfileSettings.tsx` con:
  - resumen de cuenta,
  - rol del usuario,
  - identificador de usuario,
  - edicion de nombre,
  - edicion de email,
  - cambio opcional de contrasena.
- La actualizacion reutiliza `PATCH /api/users/{id}`, que ya permite actualizar el perfil propio o cualquier usuario si el rol es `OWNER`.

### 13. Correcciones runtime adicionales

- Se corrigio `/api/findings/{id}/audit-log` para normalizar parametros vacios (`action`, `userId`, `limit`, `offset`) antes de validarlos con Zod.
- Esta correccion evita errores runtime cuando el visor de auditoria solicita el historial sin filtros explicitos.
- Se verifico `/api/findings/{id}/audit-log` autenticado con respuesta `200`.

### 14. Testing y calidad

Validaciones ejecutadas:

```bash
npx prisma validate
npx tsc --noEmit --pretty false
pnpm test
pnpm lint
node --check public/sw.js
pnpm build
```

Resultados documentados:

- Prisma schema valido.
- TypeScript pasando.
- Vitest configurado y pasando.
- ESLint pasando con warnings no bloqueantes.
- Service worker con sintaxis valida.
- Build de produccion pasando.
- Build configurado con `next build --webpack` por una incompatibilidad del host con Turbopack durante el pipeline CSS.
- Smoke tests publicos posteriores al redisenio pasando.
- Smoke tests autenticados para `/profile`, `/dashboard/analytics`, `/findings/{id}`, `/test-import` y auditoria pasando.

### 15. Documentacion creada o actualizada

- `README.md`
- `ARCHITECTURE.md`
- `file-structure.md`
- `docs/backend/00-current-state-audit.md`
- `docs/backend/01-target-architecture.md`
- `docs/backend/02-data-model.md`
- `docs/backend/03-state-machine.md`
- `docs/backend/04-import-mapping.md`
- `docs/backend/05-api.md`
- `docs/backend/06-storage.md`
- `docs/backend/07-security.md`
- `docs/backend/08-deployment.md`
- `docs/backend/09-testing.md`
- `docs/RESUMEN_AVANCES_2026-08-11.md`

## Deploy realizado

Secuencia completada:

```bash
npx prisma migrate deploy
npx prisma generate
npx tsc --noEmit --pretty false
pnpm build
pm2 restart uix-torrax-cloud --update-env
pm2 save
```

Verificaciones publicas realizadas:

```bash
curl https://uix.torrax.cloud/api/health
curl "https://uix.torrax.cloud/api/search/findings?limit=1"
curl -I https://uix.torrax.cloud/findings
curl -I https://uix.torrax.cloud/login
curl -I https://uix.torrax.cloud/search
curl -I https://uix.torrax.cloud/dashboard/analytics
curl -I https://uix.torrax.cloud/test-import
curl -I https://uix.torrax.cloud/profile
curl -I https://uix.torrax.cloud/sw.js
curl -I https://uix.torrax.cloud/offline.html
curl -I https://uix.torrax.cloud/manifest.webmanifest
```

Resultado:

- `/api/health`: `200`, `healthy`.
- `/api/search/findings?limit=1`: `200`, `total: 176`, `source: postgresql`.
- `/findings`: `200`.
- `/login`: `200`.
- `/search`: `200`.
- `/dashboard/analytics`: `200`.
- `/test-import`: `200`.
- `/profile`: `307` sin sesion hacia `/login`; `200` con sesion autenticada.
- `/findings/{id}`: `307` sin sesion hacia `/login`; `200` con sesion autenticada.
- `/api/findings/{id}/audit-log`: `200` con sesion autenticada.
- `/api/projects`: `401` sin sesion, esperado.
- `/sw.js`: `200`.
- `/offline.html`: `200`.
- `/manifest.webmanifest`: `200`.

## Pendientes conocidos

- Levantar o configurar Elasticsearch si se quiere habilitar busqueda avanzada completa sin warnings.
- Agregar rate limiting en login, imports y uploads.
- Completar pruebas de integracion con PostgreSQL disposable y storage fixture.
- Agregar pruebas E2E para:
  - login,
  - importacion historica,
  - apertura de detalle,
  - cambio de estado,
  - carga de evidencia,
  - validacion de hallazgo.
- Definir politica final de backups para PostgreSQL y object storage.
- Revisar y limpiar archivos generados `.next` en el working tree antes de preparar un commit.
- Hacer hardening de observabilidad: logs estructurados, request id, alertas y monitoreo.

## Conclusion

La plataforma ya esta publicada y operativa. El sistema conserva compatibilidad con el reporte PWA legacy y al mismo tiempo deja disponible la base dinamica para evolucionar Pruebas Maria 2.0 como producto: datos en PostgreSQL, APIs protegidas, workflows, evidencias, imports, PWA/offline y despliegue publico verificado.
