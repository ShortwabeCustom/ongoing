# Evidence storage release runbook (P1-B)

Estado operativo actual:

```text
RUNTIME_CANONICAL=PM2_SOURCE
PACKAGE_MANAGER_CANONICAL=npm
NODE_RELEASE=24.19.0
PRISMA_BASELINE_RESOLVED=NO
PURGE_GATE=CLOSED
BACKUP_RESTORE_VERIFIED=NO
DEPLOY_READY=NO
RECONCILIATION_GRACE_MINUTES=30
NPM_LEGACY_PEER_DEPS=true
```

`RECONCILIATION_GRACE_MINUTES=30` es el valor operativo aprobado para el release de P1-B; no es un default hardcodeado en la aplicación. Este documento no autoriza producción por sí solo.

La aplicación productiva actual usa PM2 sobre un source checkout y `npm start`. Docker queda documentado pero no es el runtime canónico actual. `NPM_LEGACY_PEER_DEPS=true` es deuda técnica temporal: `@base-ui/react@1.7.0` exige `date-fns@^4`, mientras la aplicación permanece deliberadamente en `date-fns@3`; debe retirarse después de revisar ese upgrade mayor.

## Transición one-time del baseline Prisma

`PRISMA_BASELINE_RESOLVED` permanece en `NO`. Antes del primer
`prisma migrate deploy` en producción con la historia squashed, y solo después
de contar con la readiness de backup/restore correspondiente, comprobar que no
existe drift:

```bash
npm exec -- prisma migrate diff \
  --exit-code \
  --from-config-datasource \
  --to-schema prisma/schema.prisma
```

El comando debe devolver exit code 0. Después se debe registrar exactamente una
vez el baseline ya existente en producción, sin ejecutar su SQL:

```bash
npm exec -- prisma migrate resolve \
  --applied 000000000000_squashed_migrations
```

Finalmente, verificar la historia activa:

```bash
npm exec -- prisma migrate deploy
```

`migrate resolve` es una transición humana y controlada; no debe incorporarse
al deploy general ni ejecutarse sobre una base vacía.

## Provisioning y preflight

- Confirmar el usuario del proceso PM2 y el cwd del source checkout.
- Provisionar `EVIDENCE_STORAGE_DIR` absoluto, durable, fuera del repo/build/`public`, `/tmp` y `/var/tmp`.
- Owner igual al usuario del proceso; directorio `0700`; ficheros `0600`; nunca ejecutar `chown` desde la app.
- Tras restart, ejecutar manualmente `node scripts/run-ts.cjs scripts/preflight-evidence-storage.ts`. El preflight crea y limpia únicamente un subdirectorio `.preflight-*`, y comprueba escritura, fsync y hard links.

## Backup/restore gate D6-bis.B

Antes de abrir el gate se requiere evidencia verificable de:

1. backup PostgreSQL durable, cifrado y fuera del host;
2. backup durable que incluya explícitamente el realpath de `EVIDENCE_STORAGE_DIR`;
3. política de retención y monitorización de ambos backups;
4. restore aislado probado de metadata y bytes, preservando owner y modos `0700`/`0600`;
5. smoke test autenticado de una Evidence restaurada;
6. registro fechado del ejercicio, responsables, RPO/RTO y artefactos verificados.

La mera existencia del directorio o un `pg_dump` local no abre el gate. Purge no puede pasar a `--execute` hasta una aprobación humana posterior a la demostración de backup y restore.

## Operaciones (todavía no autorizadas en producción)

- Reconciliation: dry-run primero, con `--grace-minutes 30`; revisar conteos y después obtener aprobación separada para `--execute`.
- Restore lógico: `node scripts/run-ts.cjs scripts/restore-evidence.ts <evidenceId>` es dry-run; `--execute` requiere aprobación y objeto presente.
- Temporales: `node scripts/run-ts.cjs scripts/cleanup-evidence-temporaries.ts --grace-minutes 30` es dry-run.
- Purge: `node scripts/run-ts.cjs scripts/purge-evidence.ts` solo hace dry-run. `--execute` falla cerrado mientras D6-bis.B no esté verificado.

## Smoke tests y rollback

- Upload → GET autenticado; Range 206; anónimo 401; soft delete 204 → GET 404; restore manual → GET 200.
- Confirmar que legacy y reporte público no cambian.
- Rollback de código no recupera bytes purgados. Por eso purge permanece cerrado hasta completar D6-bis.B.
- Un cambio de `EVIDENCE_STORAGE_DIR` exige restart por memoización fail-closed.

## Pendientes de release

- Validar `npm ci`, tests, lint y build en Node 24.19.0 Linux mediante CI.
- Provisionar y verificar storage/backup/restore en el host antes de cambiar `DEPLOY_READY`.
- Docker sigue siendo no canónico y no empaqueta los CLIs operativos P1-B.
