# Session: Production Deploy — Evidence / Chat / Cards Reconciliation (2026-08-26)

## Contexto

Deploy a producción del candidato ya validado por Release Gate:
`release/evidence-chat-cards-reconciliation-2026-08-26` →
`aa81885c1ff837c44e8c81e874d7c14849d74b47`.

## PRE_DEPLOY_SHA / DEPLOYED_SHA

```
PRE_DEPLOY_SHA (blue, público antes del cutover) = d6210345689d0c6f17cf78208a355c174a45eed8
DEPLOYED_SHA   (green, público después del cutover) = aa81885c1ff837c44e8c81e874d7c14849d74b47
```

## Hallazgo de drift de infraestructura (antes de tocar nada)

El runbook asumido (`ecosystem.config.js` → proceso `uix` → puerto 3000 →
`pm2 reload`) **no coincide con la topología real**:

```
DOCUMENTED_TOPOLOGY:
nginx → uix (ecosystem.config.js) → 3000

ACTUAL_TOPOLOGY_FOUND (antes del deploy):
nginx → uix-release-d621034 → 127.0.0.1:3104
(proceso ad-hoc, directorio sin .git, no worktree, "PORT: 3104"
 fijado a mano en 2026-08-21 18:24, cuando se promovió ese candidato)

uix (puerto 3000, ecosystem.config.js "oficial") corre desde
/var/www/apps/uix-release-portal-848be7f — un worktree real pero en un
commit mucho más viejo (a459a5f), huérfano de tráfico público real.

Familia de slots encontrados:
  uix                    :3000  (huérfano, no en el path público)
  uix-canary             :3101  (findings-filter-prod-8d1414f)
  uix-release-e07a690    :3102
  uix-release-a63d09c    :3103
  uix-release-d621034    :3104  ← el que servía tráfico público real
```

Ejecutar la Fase 8 literal del runbook original (`pm2 reload
ecosystem.config.js` sobre `uix:3000`) habría "tenido éxito" sin afectar
en absoluto `https://uix.productdesign.mx` — un deploy fantasma. Se
detuvo la ejecución y se re-planificó con el usuario antes de tocar
pm2/nginx.

**NEW_CANONICAL_DEPLOY_PATTERN adoptado para este release** (mismo
patrón ya usado por los slots anteriores, formalizado aquí):

```
git worktree inmutable en /var/www/apps/uix-release-<sha>
→ .env symlink al .env real de /var/www/apps/uix (nunca copiado)
→ ecosystem.deploy.config.js local, no versionado (name/cwd/port propios)
→ npm ci + prisma generate (sin migrate) + npm run build
→ pm2 start, proceso propio en puerto propio
→ smoke directo contra 127.0.0.1:<puerto>, sin pasar por nginx
→ solo entonces, cutover atómico de nginx (proxy_pass) al nuevo puerto
→ slot anterior se retiene corriendo, como rollback de un solo cambio de línea
```

Recomendación explícita para после de este release: documentar esto en
un ADR (`ADR: Blue/Green deployment topology for UIX`) — no se hizo en
esta sesión por estar fuera de alcance.

## Blue / Green

```
BLUE (rollback target)
  proceso   uix-release-d621034
  directorio /var/www/apps/uix-release-d621034
  puerto    3104
  SHA       d6210345689d0c6f17cf78208a355c174a45eed8
  estado    retenido, online, sin reinicios durante todo el deploy

GREEN (candidato, ahora en producción)
  proceso   uix-release-aa81885
  directorio /var/www/apps/uix-release-aa81885 (git worktree, detached)
  puerto    3105
  SHA       aa81885c1ff837c44e8c81e874d7c14849d74b47
  estado    online, 0 restarts, 0 unstable restarts
```

## Build

`npm ci` (944 paquetes, sin actualizar dependencias) + `prisma generate`
(solo codegen, sin `migrate deploy`/`db push`/`migrate dev` — coherente
con `SCHEMA_CHANGE=NO`/`NEW_MIGRATIONS=NO` ya confirmado en el Release
Gate) + `npm run build` → **PASS**, `BUILD_ID=E6bFti9GFhjsQQd2JNR4G`.

## Validación pre-cutover (contra 127.0.0.1:3105, sin nginx)

```
GREEN_HEALTH        200, database healthy, elasticsearch disabled (esperado)
GREEN_LOGIN         200
GREEN_FINDINGS      307 (redirect por auth, idéntico a blue)
GREEN_PUBLIC_REPORT 200, sin "comments", sin storageKey, sin /api/public/evidence/
GREEN_EVIDENCE      200, Content-Type: image/png (legacy /evidence-from-excel intacto)
GREEN_LOGS          sin errores/Prisma/React #418/#441, solo warning benigno
                     de next.config.mjs (isrMemoryCacheSize/serverRuntimeConfig,
                     preexistente en todos los slots)
```

## Cutover de nginx

Ejecutado por el usuario (requería sudo, no disponible en esta sesión).

**Incidente menor durante el cutover**: el primer backup de la config se
guardó dentro de `/etc/nginx/sites-enabled/`, lo que provocó que
`nginx -t` detectara un `server_name`/`listen` duplicado (el backup
seguía activo por estar en el directorio `sites-enabled`, no
`sites-available`). No se llegó a hacer `reload` con esa config
inválida. Se movió el backup a `/var/backups/nginx/`, se re-verificó
`nginx -t` → `syntax is ok / test is successful`, y el cutover continuó.

**Aprendizaje documentado**: nunca guardar backups de configuración
dentro de `sites-enabled/` — cualquier archivo ahí es tomado por nginx
como un server block activo. Usar `sites-available/` o un directorio
fuera del árbol de nginx (p. ej. `/var/backups/nginx/`).

```
Backup final: /var/backups/nginx/uix.productdesign.mx.pre-aa81885-20260826-170153
Cambio único: proxy_pass http://127.0.0.1:3104; → proxy_pass http://127.0.0.1:3105;
nginx -t: syntax is ok / test is successful
reload: systemctl reload nginx (sin restart)
```

## Verificación pública post-cutover (verificada de forma independiente, no solo repetida del reporte del usuario)

```
HEALTH_HTTP       200, database healthy
LOGIN_HTTP        200
FINDINGS_HTTP     307 (redirect por auth, esperado)

ACTUAL chunk (build local green, .next/static/chunks/app/login/page-*.js)
  = 3be05c0421f5e659
SERVED chunk (https://uix.productdesign.mx/login, HTML servido)
  = 3be05c0421f5e659
CHUNK_CONSISTENCY = PASS (coinciden)
BLUE chunk (para contraste, debe diferir) = 5425581df1ff5ebc → confirma
  que el público efectivamente cambió de blue a green, no solo que
  "responde 200"

Legacy evidence (https://.../evidence-from-excel/image-101.png)
  HTTP 200, Content-Type: image/png

Public report (https://.../api/public/report)
  HTTP 200
  sin "comments", sin storageKey, sin /api/public/evidence/
  stats.observations=234, evidenceCount=267 (valores actuales, no
  hardcodeados como criterio — solo se validó estructura/aislamiento)
```

## Smoke funcional

Verificación HTTP/infraestructura realizada directamente y de forma
independiente (health, login, findings-redirect, chunk consistency,
evidencia legacy, reporte público — todo arriba).

**No se realizó un recorrido visual en navegador real** (no hay
herramienta de navegador disponible en esta sesión, y entrar con
credenciales reales de producción para probar filtros/date
picker/chat/lightbox interactivamente no estaba autorizado ni era
necesario dado lo siguiente). En su lugar, la cobertura de UI se apoya
en:

1. La suite automatizada completa (**680/680 tests, jsdom + Testing
   Library**) ya verde sobre exactamente este mismo código antes del
   Release Gate — incluye específicamente: filtros nuevos y date picker
   (96 tests dedicados), creación/listado/borrado de comentarios con
   verificación de ownership, DeleteFindingButton con confirmación y
   RBAC, ActivityLog, ImageLightbox.
2. La prueba de `CHUNK_CONSISTENCY` arriba, que demuestra que el
   binario servido en público es bit-a-bit el mismo build validado
   (no una aproximación ni una versión distinta desplegada por error).
3. Los logs del proceso green después de servir tráfico público real:
   sin errores nuevos, sin Prisma, sin React #418/#441, sin restarts.

Esta distinción se documenta explícitamente para no reclamar una
verificación visual que no ocurrió.

## PM2

```
uix-release-aa81885: online, 0 restarts, 0 unstable restarts
uix-release-d621034 (blue): online, 0 restarts, retenido sin cambios
pm2 save: ejecutado después de confirmar todos los gates — dump.pm2 actualizado
```

Ningún slot histórico (`uix`, `uix-canary`, `uix-release-e07a690`,
`uix-release-a63d09c`) fue detenido ni eliminado en esta sesión —
limpieza de slots fuera de alcance, según instrucción explícita.

## Rollback

**No requerido** — todos los criterios pasaron.

Disponible en un solo cambio de línea si se necesitara después:
```
proxy_pass http://127.0.0.1:3105; → proxy_pass http://127.0.0.1:3104;
nginx -t && systemctl reload nginx
```
Blue (`uix-release-d621034`, puerto 3104, SHA `d621034`) permanece
online exactamente para esto. Sin rebuild, sin tocar PostgreSQL (este
release no tiene migraciones).

## Estado final

```
DEPLOYED_SHA    aa81885c1ff837c44e8c81e874d7c14849d74b47
PUBLIC_UPSTREAM 127.0.0.1:3105 (uix-release-aa81885)
Working tree (/var/www/apps/uix, rama fix/date-picker-unification-2026-08-19): CLEAN, HEAD sin mover
PRODUCTION_STATUS: PASS
```

## Pendientes

- ADR de la topología blue/green (recomendado, no ejecutado en esta sesión).
- Limpieza de slots históricos (`uix`:3000 huérfano, `uix-canary`:3101,
  `uix-release-e07a690`:3102, `uix-release-a63d09c`:3103) — fuera de
  alcance de este deploy.
- Integración de `main` con `fix/date-picker-unification-2026-08-19` —
  explícitamente pospuesta hasta después de este smoke exitoso (Fase 17
  del deploy original).
- Bulk Delete v2 sigue pendiente (ver sesión de reconciliación anterior).
