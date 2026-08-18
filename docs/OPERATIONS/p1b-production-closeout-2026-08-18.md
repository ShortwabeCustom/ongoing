# P1-B production closeout — 2026-08-18

## Alcance y clasificación

Este registro cierra documentalmente P1-B Evidence Storage + Authorized Delivery
y registra el ejercicio DR post-smoke. `CONFIRMADO` significa observado en estado
vivo o en artefactos verificados; `PENDIENTE` no se convierte en PASS por
inferencia. Purge permaneció cerrado durante toda la ejecución.

## Release productivo — CONFIRMADO

| Campo | Evidencia |
|---|---|
| Commit desplegado | `9dedc78f07becf071b7c86a94a394cfa0cc0f22b` |
| Runtime | PM2 `uix-torrax-cloud`, online, cwd `/var/www/apps/uix` |
| Versiones | Node 24.19.0; npm 11.17.0; Prisma 7.9.1 |
| HTTP | root 200 antes y después del ejercicio |
| Prisma | baseline resuelto; migrate status sin pendientes; schema diff sin diferencias |
| Baseline SQL | no ejecutado |
| Storage | `/var/lib/pruebas-maria/evidence`, `0700`, `alexis:alexis`; objetos `0600` |
| Smoke funcional | PASS, Evidence `4USqWpz0jE_CUmhmplAcK` |

La transición Prisma registró una sola vez
`000000000000_squashed_migrations` como aplicada y después ejecutó migrate deploy.
El precheck de este closeout confirmó que no surgieron pendientes ni drift. No se
repitió `migrate resolve`, no se ejecutó baseline SQL y no se modificó ninguna fila.

El smoke productivo previo verificó upload 201, metadata confirmada, objeto privado,
GET autenticado 200, igualdad de bytes, Range 206, anónimo 401, ausencia en el
reporte público, soft delete 204, retención de bytes, restore lógico y GET final
200. El storage preflight y PM2 quedaron PASS.

## Incidente C-02 y Evidence histórica — CONFIRMADO

La Evidence histórica `ExMYccC4uoFhJf1gP8Lyi`, asociada al Finding
`cmsxruv9n00004u2suauza2hl`, fue contenida reversiblemente después de detectarse
servida por el build inicial. Los bytes se movieron fuera de `public/`, con hash
verificado, owner `alexis:alexis` y modo `0600`; el build se regeneró. En este
closeout se volvió a observar:

- fila presente, activa y con `url=null`;
- objeto privado presente;
- antigua ruta pública 404;
- ruta privada anónima 401;
- fila y bytes incluidos en el snapshot post-P1-B.

No se modificó ni adoptó la fila. Sigue siendo una excepción pre-P1-B:

```text
HISTORICAL_EVIDENCE_REQUIRES_ADOPTION_DECISION=YES
RECONCILIATION_PROD_READY=NO
```

## Snapshot post-P1-B y copia off-host — CONFIRMADO

El snapshot online se creó el `2026-08-18T08:58:10Z`; dump y archive finalizaron
entre `08:58:12Z` y `08:58:12Z` sin detener producción.

```text
VPS=/home/alexis/backups/pruebas-maria/p1b-dr-20260818T085810Z
MAC=/Users/alexisvaldez/Backups/pruebas-maria/p1b-dr-20260818T085810Z
```

Manifest: dos filas Evidence y dos ficheros privados, incluyendo la Evidence smoke.
El dump usa formato custom, `--no-owner` y `--no-privileges`. La copia Mac tiene
directorio `0700`; FileVault fue observado activo. `SHA256SUMS` pasó tanto en VPS
como en Mac:

| Artefacto | SHA-256 |
|---|---|
| `MANIFEST.txt` | `76e6a91e3796150f850a971f0e3590eea3a1df262b74265873f88096b72820f8` |
| `pruebas_maria_prod.dump` | `856563e522e132e34c8902f92a4a4523658e772ca528b7702e7cde21b0eff528` |
| `private-evidence.tar.gz` | `32a1a31007293dd1f51e03a9241d5fe22b1ce059471f530cb4ef28076e52a798` |
| `DR-EXERCISE.txt` | `173d7bff6791920800dce67109398ab776e0025200d4c71f1debd2f4eb256a1f` |

## Ejercicio DR aislado

El VPS no tiene Docker, Podman ni nerdctl. Instalar software en producción o usar
`sudo` interactivo quedó fuera de una ejecución desatendida segura. Se continuó
con un fallback claramente identificado: PostgreSQL 16.14 nativo, usuario y
password efímeros, loopback `127.0.0.1`, database y puertos aislados, storage bajo
`/home/alexis/p1b-dr/20260818T085810Z`, y una app temporal del mismo commit en otro
puerto. No se reemplazó PM2 ni se modificó `.env` productivo.

Resultados observados entre `2026-08-18T09:01:20Z` y `09:01:23Z`:

| Verificación | Resultado |
|---|---|
| pg_restore, 21 tablas | PASS, PostgreSQL 16 nativo; no Docker |
| `_prisma_migrations` | PASS |
| Evidence smoke + Finding + URL + `deletedAt=null` | PASS |
| storage privado restaurado | PASS |
| root/directorios `0700`, ficheros `0600`, `alexis:alexis` | PASS |
| objeto histórico incluido | PASS |
| sesión activa del backup restaurado | PASS |
| `/api/auth/session` con usuario válido | PASS |
| GET Evidence autenticado | 200 |
| bytes descargados vs. objeto restaurado | MATCH |
| Range `bytes=0-7` | 206 |
| GET sin cookie | 401 |

La app, PostgreSQL y credenciales temporales se retiraron con certeza. Se preservó
el filesystem DR y el informe; no se borró ningún backup ni rollback.

```text
RPO_OBSERVED=0s para la Evidence objetivo en el checkpoint del snapshot
RTO_OBSERVED=3s en el restore compensatorio nativo
RPO_TARGET=PENDIENTE
RTO_TARGET=PENDIENTE
```

El RPO observado significa que la Evidence objetivo y sus bytes estaban presentes
en el checkpoint verificado; no constituye un objetivo organizacional aprobado.

### Ejercicio formal Docker/Linux posterior — CONFIRMADO

El `2026-08-18` se repitió el restore usando el snapshot off-host existente, sin
crear un backup nuevo. Docker Desktop ejecutó containers Linux `arm64`; PostgreSQL
reportó `16.15 (Debian 16.15-1.pgdg13+2)`. La app se construyó desde el commit exacto
`9dedc78f07becf071b7c86a94a394cfa0cc0f22b` y se conectó sólo a la DB y al volumen
DR, ambos aislados.

| Verificación formal | Resultado |
|---|---|
| PostgreSQL 16 container Linux | PASS |
| pg_restore, schema e historial Prisma | PASS |
| Evidence smoke + Finding + URL + `deletedAt=null` | PASS |
| storage Linux privado | PASS |
| root/subdirectorios `0700`, ficheros `0600`, UID/GID del proceso `1001:1001` | PASS |
| sesión restaurada y `/api/auth/session` | PASS |
| GET autenticado | 200 |
| bytes descargados | MATCH |
| Range `bytes=0-7` | 206 |
| GET sin sesión | 401 |

```text
RPO_OBSERVED=0s para la Evidence objetivo en el checkpoint del snapshot
RTO_OBSERVED=8s desde creación del entorno Docker hasta smoke PASS
```

Container de app, container PostgreSQL, volumen, red y credenciales efímeras fueron
eliminados de forma dirigida. El informe preservado es
`DR-DOCKER-EXERCISE-20260818T170810Z.txt`, SHA-256
`c8cb8af2054514c4098c5aba606108007d702f211f6da7d5082e9f49a3bd6344`.

## Retención y monitorización — PENDIENTE

No se encontró crontab del usuario ni timer específico para backup de
`pruebas_maria_prod` y storage privado. El único timer coincidente era el backup
genérico de dpkg; `pg_basebackup@.timer` estaba deshabilitado. La retención real es
manual y existen varios snapshots preservados, pero no hay frecuencia, ventana de
retención, responsable ni alerta P1-B implementados.

La propuesta detallada se registró en
[`p1b-backup-policy.md`](./p1b-backup-policy.md). Responsable nominal, suplente,
frecuencia, retención, canal de alertas y objetivos RPO/RTO requieren aprobación;
después debe implementarse y observarse una ejecución automática completa. No se
autoriza borrar backups para implantarla.

### Automatización observada — CONFIRMADO

Se instaló el job diario completo mediante LaunchAgent del Mac, conservando el
pull SSH/rsync ya verificado. La corrida válida `p1b-auto-20260818T175747Z` pasó:
dump DB, archive privado, manifest, hash origen, copia off-host, hash destino,
marcadores `SUCCESS` y heartbeat. Un monitor de 15 minutos terminó con exit 0 y
aplica umbral de ausencia de 26 horas y restore vencido trimestral. Se generaron
inventarios pre-política y `RETENTION_DELETE_ENABLED=NO`; no se borró ningún backup.

La entrega SMTP queda bloqueada por sender/OAuth y por la creación root-owned de
`/etc/pruebas-maria/backup-alert.env`. No se usará autenticación básica ni password
normal de Microsoft. Por ello `ALERT_DELIVERY_VERIFIED=NO` y el gate general sigue
cerrado.

## Decisión de gates

| Gate | Estado | Razón |
|---|---|---|
| Runtime P1-B | PASS | commit, PM2, HTTP, storage y smoke verificados |
| Prisma baseline | PASS | resuelto, sin pendientes ni drift |
| Backup post-P1-B | PASS | DB+storage+hashes+off-host cifrado |
| Restore formal Docker/Linux | PASS | PostgreSQL 16.15, app y storage Linux, auth y bytes |
| DR técnico D6-bis.B | PASS | ejercicio formal reproducible e informe con SHA-256 |
| Política P1-B | PENDIENTE | propuesta no aprobada ni implementada |
| Backup automático observado | PASS | `p1b-auto-20260818T175747Z`, ambos extremos |
| Alertas email | PENDIENTE | identidad OAuth/secreto root-owned no provisionados |
| Reconciliation producción | CLOSED | Evidence histórica requiere decisión de adopción |
| Purge | CLOSED | requiere DR completo y aprobación humana posterior separada |

```text
BACKUP_RESTORE_VERIFIED=NO
PURGE_READY_FOR_HUMAN_APPROVAL=NO
PURGE_GATE=CLOSED
PURGE_EXECUTED=NO
PURGE_CRON_INSTALLED=NO
```

## Artefactos preservados

- `/var/www/apps/uix-runtime-rollback-20260818T081804Z`
- `/var/www/apps/uix-next-rollback-20260818T082427Z`
- worktree Prisma preflight `20260818T080521Z` o variante existente
- `/home/alexis/backups/pruebas-maria/release-20260818T080233Z`
- `/home/alexis/backups/pruebas-maria/p1b-dr-20260818T085810Z`
- `/Users/alexisvaldez/Backups/pruebas-maria/p1b-dr-20260818T085810Z`
- `/home/alexis/p1b-dr/20260818T085810Z`

## Próximos pasos humanos

1. Aprobar e implementar frecuencia, responsable, suplente, monitorización y
   retención P1-B; observar al menos una ejecución automática completa.
2. Aprobar objetivos RPO/RTO y el canal operativo de alertas.
3. Tomar una decisión explícita de adopción para `ExMYccC4uoFhJf1gP8Lyi` antes de
   considerar reconciliation `--execute`.
4. Revisar el PR documental. Incluso tras cerrar DR, abrir purge requiere una
   aprobación humana posterior y separada.
