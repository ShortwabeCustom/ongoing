# ADR — Blue/Green Deployment Topology for UIX

**Status**: Accepted (describes a topology already in production use, formalized here)
**Fecha**: 2026-08-26
**Autor**: Alexis + Claude Code
**Supersede**: el modelo de proceso único descrito en `docs/OPERATIONS/DEPLOYMENT_CHECKLIST.md` (pre-2026-08-26) y `docs/OPERATIONS/PRODUCTION_MODE_DEPLOYMENT.md`
**Superseded by**: ninguno

---

## Context

`uix.productdesign.mx` corre en un único host (`/var/www/apps/uix`, sin
staging, con una única base PostgreSQL compartida — ver
`docs/SESSIONS/SESSION_RECONCILIATION_EVIDENCE_CHAT_CARDS_2026-08-25.md`
y memoria de proyecto). El repositorio documenta un modelo de
despliegue de **proceso único**: `ecosystem.config.js` define un solo
proceso `uix` en el puerto 3000, y `docs/OPERATIONS/DEPLOYMENT_CHECKLIST.md`
prescribe `pm2 delete uix && pm2 start ecosystem.config.js`.

## Problem

Durante el deploy de `aa81885` (2026-08-26) se descubrió que ese modelo
**no refleja la topología real desde al menos 2026-08-19**: nginx
(`/etc/nginx/sites-enabled/uix.productdesign.mx`) hace `proxy_pass` a
`127.0.0.1:3104`, no a `127.0.0.1:3000`. El puerto 3104 lo sirve un
proceso `uix-release-d621034`, corriendo desde un directorio propio sin
relación con `ecosystem.config.js`. El proceso `uix`/3000 "oficial"
existe, está `online`, pero corre desde un worktree en un commit mucho
más viejo y **no recibe tráfico público**.

Seguir el runbook documentado literalmente (`pm2 reload
ecosystem.config.js` sobre `uix`) habría producido un **ghost
deployment**: el comando termina con éxito, `pm2 list` muestra
`online`, pero `https://uix.productdesign.mx` sigue sirviendo el código
anterior sin que nada lo indique — a menos que se verifique
explícitamente contra el dominio público con una prueba que distinga
un build de otro (chunk hash), no solo un HTTP 200.

Se determinó que esta topología multi-slot no era accidental sino un
patrón ad-hoc ya en uso (evidencia: `uix-canary`:3101,
`uix-release-e07a690`:3102, `uix-release-a63d09c`:3103,
`uix-release-d621034`:3104, cada uno con su propio
`ecosystem.deploy.config.js` local no versionado, mismo formato,
mismas convenciones de nombre). Este ADR formaliza ese patrón como el
oficial, en vez de dejarlo vivir solo en el historial de comandos de
quien lo operó.

## Decision

**UIX production deployments use immutable blue/green release slots.**
Cada release candidato se despliega en un directorio y proceso PM2
propios, se valida de forma aislada contra su propio puerto localhost,
y solo se promueve a tráfico público mediante un cambio atómico de una
sola línea en la configuración de nginx (`proxy_pass`). El slot
anterior permanece corriendo como rollback de un solo cambio de línea
hasta que se retire explícitamente en una auditoría separada.

`ecosystem.config.js` en el repositorio principal deja de ser la fuente
de verdad de qué sirve tráfico público; sigue existiendo como plantilla
de referencia para el proceso `uix`/3000, que hoy es un slot huérfano.

## Blue/Green topology

```
uix.productdesign.mx
        │
      nginx (proxy_pass — la única fuente de verdad de qué está "vivo")
        │
        ▼
127.0.0.1:<puerto del slot promovido>
        │
        ▼
proceso PM2 uix-release-<sha>
        │
        ▼
/var/www/apps/uix-release-<sha>  (git worktree inmutable, detached HEAD == <sha>)
```

En cualquier momento pueden coexistir varios slots; solo uno recibe
tráfico público (el que nginx apunta). Los demás están disponibles
para: validación de un candidato nuevo (green, aún no promovido) o
rollback inmediato (el slot recién retirado, blue, retenido).

## Immutable release slots

- Cada slot es un `git worktree` creado con `git worktree add --detach
  /var/www/apps/uix-release-<sha> <sha>` desde el repo principal
  (`/var/www/apps/uix`) — nunca una copia de archivos manual ni un
  `git clone` independiente, para que `git worktree list` desde el repo
  principal siga siendo la fuente de verdad de qué slots existen y a
  qué commit apuntan.
- `.env` es un **symlink** al `.env` real de `/var/www/apps/uix/.env`,
  nunca una copia. Un solo archivo de secretos, una sola fuente de
  verdad; ningún slot puede quedar con credenciales desactualizadas o
  duplicadas.
- `npm ci` (nunca `npm install`/`update`) + `npm exec -- prisma
  generate` (codegen puro, sin tocar la base de datos) + `npm run
  build`. Si el release requiere migraciones reales, esas se aplican
  aparte, explícitamente, antes del cutover — no como parte rutinaria
  de crear el slot.

## PM2 naming

- Nombre del proceso: `uix-release-<sha-corto>` (el mismo `<sha>` del
  worktree). Evita colisiones y hace trivial correlacionar proceso ↔
  código ↔ commit sin tener que inspeccionar `cwd`.
- Config de arranque: `ecosystem.deploy.config.js` **dentro de cada
  slot**, no versionado en git (es específico de ese slot: nombre, cwd
  y puerto son únicos). Se deriva copiando la forma de
  `ecosystem.config.js` — mismos `node_args`, `max_memory_restart`,
  `autorestart: false`, `watch: false` — cambiando solo `name`, `cwd`,
  `args` (el flag `-p <puerto>`) y `env.PORT`.
- `autorestart: false` es intencional (igual que en `ecosystem.config.js`):
  un crash debe requerir intervención manual, no reintentos silenciosos
  contra una base de datos compartida sin staging.

## Port allocation

- Puertos localhost dedicados, fuera del rango que usa `ecosystem.config.js`
  (3000): observado en uso 3101–3104 al momento de este ADR. Antes de
  asignar uno nuevo: `ss -lntp | grep ':<puerto>'` y `pm2 describe
  uix-release-<sha>` deben devolver vacío/error — no elegir un puerto a
  ciegas.
- Estos puertos **nunca** se exponen directamente al exterior; solo
  nginx los alcanza vía `proxy_pass http://127.0.0.1:<puerto>`.

## Pre-cutover validation

Antes de tocar nginx, el slot candidato se valida **directamente
contra su propio puerto** (`http://127.0.0.1:<puerto>`), nunca contra
el dominio público — así una validación exitosa no puede confundirse
con tráfico real ya migrado. Mínimo:

- `pm2 describe` → `online`, `restarts: 0`
- `/api/health` → 200, `database: healthy`
- `/login` → 200
- `/api/public/report` → 200, sin `comments`, sin `storageKey`, sin
  `/api/public/evidence/`
- evidencia legacy conocida → 200, `Content-Type` correcto
- logs (`error` y `out`, leídos directamente del archivo, no solo
  `pm2 logs` que puede mostrar encabezados engañosos) → sin
  excepciones, sin Prisma, sin React #418/#441

## Nginx cutover

- Backup de la config **siempre fuera de `sites-enabled/`** —
  `/var/backups/nginx/` o equivalente. Cualquier archivo dentro de
  `sites-enabled/` es parseado por nginx como un server block activo;
  un backup dejado ahí produce un `server_name`/`listen` duplicado y
  rompe `nginx -t` antes de que ocurra ningún reload real (incidente
  observado durante el deploy de `aa81885`, ver
  `docs/SESSIONS/SESSION_DEPLOY_EVIDENCE_CHAT_CARDS_2026-08-26.md`).
- Cambio atómico de una sola directiva (`proxy_pass`), nada más —
  mismo `server_name`, mismos certificados, mismos headers.
- `nginx -t` obligatorio antes de `systemctl reload nginx`. Reload,
  nunca restart.

## Chunk verification

HTTP 200 en `/api/health` **no** demuestra que el tráfico público llegó
al slot nuevo — solo demuestra que el proceso responde. La prueba real:

```bash
ACTUAL=$(find /var/www/apps/uix-release-<sha>/.next/static/chunks/app/login \
  -maxdepth 1 -name 'page-*.js' -printf '%f\n' | head -1 | sed -E 's/^page-(.*)\.js$/\1/')
SERVED=$(curl -sS https://uix.productdesign.mx/login \
  | grep -oE '/_next/static/chunks/app/login/page-[^"]+\.js' | head -1 \
  | sed -E 's#^.*/page-(.*)\.js$#\1#')
[ "$ACTUAL" = "$SERVED" ]
```

Comparar además contra el chunk del slot **anterior** (debe diferir) —
así se demuestra positivamente que el público cambió de slot, no solo
que el candidato "también respondería si se le preguntara".

## Rollback

Revertir `proxy_pass` al puerto anterior, `nginx -t`, `systemctl
reload`. Sin rebuild, sin tocar PostgreSQL (asumiendo, como en el
release de `aa81885`, que no hubo migraciones). Por esto el slot
anterior se mantiene corriendo tras el cutover en vez de eliminarse
inmediatamente — el rollback debe ser un cambio de una línea, no una
reconstrucción.

## Why ecosystem.config.js alone is insufficient

`ecosystem.config.js` describe un proceso singular, fijo en nombre y
puerto. No puede representar "el candidato N validándose en paralelo
al que sirve tráfico real" — dos procesos con el mismo nombre/puerto no
pueden coexistir en PM2, y reemplazar el único proceso en su lugar
significa que la validación y el cutover son el mismo evento
indistinguible: si algo falla, ya está en producción. El patrón
blue/green existe precisamente para separar esos dos momentos. Por
eso `docs/OPERATIONS/DEPLOYMENT_CHECKLIST.md` y
`docs/OPERATIONS/PRODUCTION_MODE_DEPLOYMENT.md` fueron marcados como
supersedidos: no están equivocados sobre cómo arrancar `next start`
correctamente, pero asumen una topología de un solo proceso que ya no
gobierna el tráfico público.

## Known operational debt

- **Auditoría de inventario PM2 pendiente**: existen slots que
  `pm2 save` persiste indefinidamente — `uix` (huérfano, puerto 3000),
  `uix-canary` (puerto 3101), `uix-release-e07a690` (3102),
  `uix-release-a63d09c` (3103) — sin que se haya determinado
  explícitamente cuáles deben sobrevivir un reinicio del host y cuáles
  son basura acumulada de candidatos ya promovidos o descartados.
  Ninguno se eliminó en el deploy de `aa81885` (ver sesión de deploy).
- `ecosystem.config.js` sigue sin actualizarse para reflejar la
  realidad — sigue describiendo solo `uix`/3000. Alinearlo (o
  documentar explícitamente que es solo una plantilla base para slots
  nuevos, no el proceso vivo) queda pendiente.
- Bulk Delete v2 — no relacionado con esta topología, pendiente por
  separado (ver sesión de reconciliación 2026-08-25): se reimplementará
  sobre la arquitectura de filtros actual, no reutilizando `da25e32`
  completo.
