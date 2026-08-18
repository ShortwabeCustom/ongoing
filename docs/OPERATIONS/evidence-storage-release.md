# Evidence storage release runbook (P1-B)

Estado operativo verificado el 2026-08-18:

```text
RUNTIME_CANONICAL=PM2_SOURCE
PACKAGE_MANAGER_CANONICAL=npm
NODE_RELEASE=24.19.0
PRISMA_BASELINE_RESOLVED=YES
PROD_SCHEMA_DRIFT=NO
P1B_RUNTIME_DEPLOYED=YES
P1B_PRODUCTION_FUNCTIONAL_SMOKE=PASS
PUBLIC_RUNTIME_EVIDENCE_EXPOSURE=CONTAINED
RECONCILIATION_GRACE_MINUTES=30
RECONCILIATION_PROD_READY=NO
DR_POSTGRES16_DOCKER_LINUX=PASS
BACKUP_POLICY_EXISTS=YES
BACKUP_POLICY_APPROVED=NO
BACKUP_POLICY_IMPLEMENTED=NO
BACKUP_RESTORE_VERIFIED=NO
PURGE_GATE=CLOSED
PURGE_EXECUTED=NO
PURGE_CRON_INSTALLED=NO
```

La fuente de estos estados es el closeout operativo
[`p1b-production-closeout-2026-08-18.md`](./p1b-production-closeout-2026-08-18.md).
Este documento no autoriza purge ni reconciliation `--execute`.

## Runtime y transición Prisma

Producción ejecuta el commit
`9dedc78f07becf071b7c86a94a394cfa0cc0f22b` mediante PM2, desde
`/var/www/apps/uix`, con Node 24.19.0 y npm 11.17.0. El baseline squashed
`000000000000_squashed_migrations` se registró como aplicado sin ejecutar su SQL.
Los prechecks del 2026-08-18 confirmaron `prisma migrate status` sin pendientes y
`prisma migrate diff --exit-code --from-config-datasource --to-schema
prisma/schema.prisma` sin diferencias. No se debe repetir `migrate resolve` ni
ejecutar el SQL del baseline.

## Storage privado y preflight

`EVIDENCE_STORAGE_DIR=/var/lib/pruebas-maria/evidence` es el root canónico. Debe
permanecer fuera del repo, build, `public`, `/tmp` y `/var/tmp`, con owner
`alexis:alexis`, directorios `0700` y ficheros `0600`. Cambiar el root requiere
restart por memoización fail-closed. La aplicación nunca debe ejecutar `chown`.

El preflight de storage y el smoke funcional productivo fueron PASS. La Evidence
de referencia es `4USqWpz0jE_CUmhmplAcK`: upload, GET autenticado, Range, control
anónimo, soft delete y restore lógico fueron verificados. `/api/public/report`
mantiene su contrato público e ISR de 180 segundos y no expone Evidence privada.

## Backup/restore gate D6-bis.B

Snapshot post-P1-B preservado:

```text
/home/alexis/backups/pruebas-maria/p1b-dr-20260818T085810Z
/Users/alexisvaldez/Backups/pruebas-maria/p1b-dr-20260818T085810Z
```

Contiene un `pg_dump` custom sin owner/privilegios, el storage privado completo,
manifest, hashes y el informe DR. Los hashes se verificaron en origen y off-host;
FileVault estaba activo en el destino Mac.

El restore formal se repitió en Docker Desktop sobre container Linux con PostgreSQL
16.15 y una app Linux del commit de release. Fueron PASS: restore de DB, schema,
`_prisma_migrations`, metadata/Finding, storage Linux, owner/modos, sesión
restaurada, GET 200, Range 206, anónimo 401 y bytes MATCH. El RTO observado desde
la creación del entorno hasta el smoke fue 8 segundos; el RPO observado para la
Evidence objetivo en el checkpoint del snapshot fue 0 segundos.

El requisito técnico DR está satisfecho. `BACKUP_RESTORE_VERIFIED=NO` permanece
fail-closed únicamente porque la política P1-B todavía no está aprobada ni
implementada. Véase [`p1b-backup-policy.md`](./p1b-backup-policy.md). Los targets
organizacionales `RPO_TARGET` y `RTO_TARGET` permanecen pendientes de aprobación.

## Política de backup P1-B — PROPUESTA, no implementada

La propuesta completa está en [`p1b-backup-policy.md`](./p1b-backup-policy.md).
Frecuencia, retención, responsables, canal de alertas y targets RPO/RTO requieren
aprobación humana. La retención real continúa siendo manual; no borrar backups
previos para implantar la propuesta.

## Operaciones fail-closed

- Reconciliation: sólo dry-run con `--grace-minutes 30`. No usar `--execute` en
  producción mientras exista la excepción histórica descrita abajo.
- Restore lógico: el CLI sin `--execute` es dry-run; cualquier ejecución requiere
  una aprobación específica y sus precondiciones.
- Cleanup de temporales: dry-run por defecto y separado del ciclo de Evidence.
- Purge: permanece cerrado aunque el DR técnico formal haya pasado. No instalar
  cron ni usar `--execute` hasta aprobar/implementar la política y obtener una
  aprobación humana posterior separada.

## Excepción histórica y contención C-02

La Evidence `ExMYccC4uoFhJf1gP8Lyi` existe, permanece activa con `url=null`, y sus
bytes privados están preservados con modo `0600`. Su antigua URL pública devuelve
404 y la ruta privada anónima devuelve 401. El snapshot post-P1-B incluye fila y
bytes.

Este caso pre-P1-B requiere una decisión explícita de adopción; no se debe borrar,
modificar por SQL ni incluir en reconciliation `--execute`:

```text
HISTORICAL_EVIDENCE_REQUIRES_ADOPTION_DECISION=YES
RECONCILIATION_PROD_READY=NO
```

## Rollback y cleanup

Preservar, como mínimo:

- `/var/www/apps/uix-runtime-rollback-20260818T081804Z`
- `/var/www/apps/uix-next-rollback-20260818T082427Z`
- `/var/www/apps/uix-prisma-preflight-20260818T080521Z` o su variante existente
- `/home/alexis/backups/pruebas-maria/release-20260818T080233Z`
- `/home/alexis/backups/pruebas-maria/p1b-dr-20260818T085810Z`
- `/home/alexis/p1b-dr/20260818T085810Z`
- sus copias Mac equivalentes

No ejecutar cleanup general ni usar globs. Cualquier cleanup futuro debe enumerar
paths exactos, verificar que no contienen la única copia y recibir revisión humana.

## Gate final

```text
BACKUP_RESTORE_VERIFIED=NO
PURGE_READY_FOR_HUMAN_APPROVAL=NO
PURGE_GATE=CLOSED
PURGE_EXECUTED=NO
PURGE_CRON_INSTALLED=NO
```
