# Evidence storage release runbook (P1-B)

Estado operativo actual:

```text
PURGE_GATE=CLOSED
BACKUP_RESTORE_VERIFIED=NO
DEPLOY_READY=NO
RECONCILIATION_GRACE_MINUTES=30
```

`RECONCILIATION_GRACE_MINUTES=30` es el valor operativo aprobado para el release de P1-B; no es un default hardcodeado en la aplicación. Este documento no autoriza producción por sí solo.

## Provisioning y preflight

- Confirmar el runtime real (PM2 con source checkout o imagen Docker) y el usuario del job.
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

- Confirmar PM2/source checkout frente a Docker como runtime canónico.
- Corregir la contradicción `pnpm@10.33.0`/`pnpm-lock.yaml` frente al `package-lock.json` existente.
- Si Docker es canónico, empaquetar `scripts/`, `lib/`, runner y configuración de jobs antes de declarar los CLIs disponibles.
