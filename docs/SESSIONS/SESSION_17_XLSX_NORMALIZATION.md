# Session 17 — Normalización XLSX de Pruebas María

Fecha: 2026-08-19  
Estado: DRY-RUN COMPLETADO; GATE LISTO, PENDIENTE DE AUTORIZACIÓN  
Rama: `feat/xlsx-normalization-2026-08-19`

## Fuente

- Archivo: `/home/alexis/Pruebas Maria 2.0.xlsx`
- SHA-256: `561934a8090c83eee824b8d5d5fd3c4a6b8a0e76c97698180eb5e50c4356c12c`
- Tamaño: 46,221,233 bytes
- Modificado: 2026-08-19T05:31:04.168Z
- Worksheets: 12
- Findings válidos: 234
- Ficheros físicos en `xl/media`: 226
- Colocaciones de imagen: 265
- Asociaciones imagen → Finding: 265
- Findings con imágenes: 205
- Findings sin imágenes: 29
- Imágenes no mapeadas: 0

Las dos imágenes ancladas originalmente en la fila vacía 67 de `Pruebas 30 de julio` se reasocian al Finding de sourceRow 68 según la corrección de origen documentada. Se conservan el anchor original y el target final:

| Media | SHA-256 | Anchor original | Target sourceRow | Finding existente | Acción |
|---|---|---:|---:|---|---|
| xl/media/image89.png | f6007926a98abaf643a0a4475b98b4d1db2e1c6737864cbe89d36b4c482f3a64 | 67 | 68 | ninguno | Evidence CREATE |
| xl/media/image90.png | 28a41f765dd665dbefaef44081383d7ec266ebfb38de8bb2900109b4b51f6a96 | 67 | 68 | ninguno | Evidence CREATE |

## Inventario por hoja

| Worksheet | Filas | Válidas | Vacías | Completadas | Imágenes | URLs/Figma |
|---|---:|---:|---:|---:|---:|---:|
| Mod 31 Jul | 28 | 18 | 10 | 0 | 36 | 0/0 |
| Pruebas 30 de julio | 114 | 104 | 10 | 78 | 112 | 0/0 |
| Pruebas 3 agosto | 1 | 1 | 0 | 0 | 1 | 0/0 |
| Pruebas 4 - 5 agosto | 74 | 51 | 23 | 24 | 56 | 0/0 |
| Pruebas 6 - 7 de agosto | 3 | 3 | 0 | 2 | 3 | 1/1 |
| Pruebas 10 de agosto | 18 | 18 | 0 | 0 | 19 | 5/5 |
| Pruebas 11 de agosto | 11 | 11 | 0 | 0 | 9 | 4/4 |
| Pruebas 12 de agosto | 13 | 10 | 3 | 0 | 11 | 2/2 |
| Pruebas 13 de agosto | 13 | 6 | 7 | 0 | 6 | 5/5 |
| Pruebas 14 de agosto | 1 | 1 | 0 | 0 | 1 | 1/1 |
| Pruebas 17 de agosto | 8 | 8 | 0 | 0 | 8 | 2/2 |
| Pruebas 18 de agosto | 3 | 3 | 0 | 0 | 3 | 2/2 |

## Originación temporal y TestSessions

El workbook no contiene celdas de fecha por fila, columnas o filas ocultas con fechas, comentarios de fecha, propiedades personalizadas ni metadata que permita asignar un día individual dentro de los periodos. El schema vigente solo tiene `TestSession.date`; no existen `originStartDate` ni `originEndDate`.

Política determinista: `TestSession.date` usa el primer día; `TestSession.name` conserva exactamente el nombre/rango de la worksheet; `Finding.sourceSheet` conserva exactamente el nombre original. `createdAt`, `updatedAt`, fecha de importación y mtime del XLSX no participan en la originación.

| Worksheet/sourceSheet | OriginDate/periodo | TestSession.name | TestSession.date | Acción | Findings | SourceRows | Fecha por fila |
|---|---|---|---|---|---:|---|---|
| Mod 31 Jul | 2026-07-31 | Mod 31 Jul | 2026-07-31 | CREATE | 18 | 2-19 | no |
| Pruebas 30 de julio | 2026-07-30 | Pruebas 30 de julio | 2026-07-30 | CREATE | 104 | 2-106 | no |
| Pruebas 3 agosto | 2026-08-03 | Pruebas 3 agosto | 2026-08-03 | CREATE | 1 | 2-2 | no |
| Pruebas 4 - 5 agosto | 2026-08-04/2026-08-05 | Pruebas 4 - 5 agosto | 2026-08-04 | CREATE | 51 | 2-52 | no |
| Pruebas 6 - 7 de agosto | 2026-08-06/2026-08-07 | Pruebas 6 - 7 de agosto | 2026-08-06 | CREATE | 3 | 2-4 | no |
| Pruebas 10 de agosto | 2026-08-10 | Pruebas 10 de agosto | 2026-08-10 | CREATE | 18 | 2-19 | no |
| Pruebas 11 de agosto | 2026-08-11 | Pruebas 11 de agosto | 2026-08-11 | CREATE | 11 | 2-12 | no |
| Pruebas 12 de agosto | 2026-08-12 | Pruebas 12 de agosto | 2026-08-12 | CREATE | 10 | 2-11 | no |
| Pruebas 13 de agosto | 2026-08-13 | Pruebas 13 de agosto | 2026-08-13 | CREATE | 6 | 2-7 | no |
| Pruebas 14 de agosto | 2026-08-14 | Pruebas 14 de agosto | 2026-08-14 | CREATE | 1 | 2-2 | no |
| Pruebas 17 de agosto | 2026-08-17 | Pruebas 17 de agosto | 2026-08-17 | CREATE | 8 | 2-9 | no |
| Pruebas 18 de agosto | 2026-08-18 | Pruebas 18 de agosto | 2026-08-18 | CREATE | 3 | 2-4 | no |

Validación cruzada: 0 asociaciones agosto→julio o julio→agosto detectadas; 0 quedarían después del plan.

## Hallazgos de conocimiento

### CONFIRMADO

- PostgreSQL es la fuente transaccional; el schema vigente permite `Finding 1:N Evidence`.
- `generateFingerprint` incluye proyecto, TestSession, worksheet, sourceId opcional, fila y observación normalizada.
- `StorageService.uploadFile()` implementa la máquina PENDING → objeto privado → CONFIRMED y genera el `AuditLog` de Evidence.
- La entrega runtime autorizada usa `/api/evidence/{evidenceId}/file`; `storageKey` no se expone al cliente.
- ADR-001 D7/D9 exige evidencia runtime privada y preserva legacy; ninguna evidencia nueva puede escribirse en `public/`.
- Tras la reconciliación canónica, la BD conectada tiene 1 proyecto, 2 versiones, 4 TestSessions, 2 findings activos, 2 Evidence activas, 3 ImportBatch, 18 historiales de estado y 45 AuditLog.
- El proyecto correcto es `cmsoc6p7l0000h1acb6i9uoyt`, la versión operativa seleccionada es `1.0` y existe un único usuario OWNER apto para la importación.
- El storage privado está provisionado en `/var/lib/pruebas-maria/evidence`, owner correcto y modo `0700`.
- Existía una Evidence runtime PENDING (`ExMYccC4uoFhJf1gP8Lyi`), con objeto físico y más de 31 horas. El reconciler canónico con grace de 30 minutos produjo `scanned=1 cleaned=1 failed=0` y AuditLog DELETE con `after.phase=INCOMPLETE_UPLOAD_CLEANUP`. Verificación posterior: 0 PENDING activas, objeto inexistente y dry-run `scanned=0`.
- Elasticsearch está deliberadamente deshabilitado. `/api/health` devuelve `healthy` y ES `disabled/optional=true`; `SearchService.search()` confirmó `source=postgresql`. Es no bloqueante.

Detalle PENDING previo a la reconciliación:

| id | findingId | url | deletedAt | storageKey | originalFilename | createdAt | age | objectExists | AuditLog previo |
|---|---|---|---|---|---|---|---|---|---|
| ExMYccC4uoFhJf1gP8Lyi | cmsxruv9n00004u2suauza2hl | null | null | findings/cmsxruv9n00004u2suauza2hl/ExMYccC4uoFhJf1gP8Lyi/alexis-valdez-cortez.jpg | alexis-valdez-cortez.jpg | 2026-08-17T21:54:50.583Z | ~31h56m | true | CREATE `cmsxruwd500044u2sisko8kbm` |

Resultado canónico: AuditLog DELETE `cmszocceq0000nk2sefypmtx3`, `after.phase=INCOMPLETE_UPLOAD_CLEANUP`; el objeto y la fila PENDING ya no existen. Ninguna Evidence soft-deleted fue seleccionada.

### INFERIDO

- El año de las sesiones es 2026 por el contexto temporal del XLSX y la secuencia de hojas; para rangos se usa el primer día como fecha de sesión.
- `Mod 31 Jul` conserva ese nombre exacto y deriva la fecha 2026-07-31.
- La versión `1.0` es la versión de producto correcta; `legacy-import` pertenece a intentos de importación previos sin findings vinculados.
- Los valores TRUE históricos promueven únicamente OPEN/TRIAGED a VALIDATED. FALSE no degrada estados.

### PROPUESTA IMPLEMENTADA

- Un `ImportBatch` por worksheet, ya que el modelo exige una sola TestSession por batch.
- Matching en orden: fingerprint; proyecto+hoja+fila; sesión+hoja+fila; observación normalizada única dentro de sesión.
- Nombre de evidencia determinista `xlsx-{sheet}-row-{row}-{hash12}.{ext}` y marker completo de SHA-256 en caption.
- Soft-delete legacy solamente cuando filename o marker prueban equivalencia con una evidencia nueva ya confirmada.
- Comments se crean solo desde la columna semántica Comentarios; una celda que contiene exclusivamente URL genera SupportLink, no Comment.
- APPLY exige preflight de storage, backup PostgreSQL, backup del storage y dry-run guardado. Elasticsearch deshabilitado es aceptable cuando health y fallback PostgreSQL están sanos.

### PENDIENTE

- Autorizar explícitamente el APPLY después de revisar este dry-run.

## Contradicciones históricas

- Session 2 documenta 204 findings, 204 Evidence y archivos bajo `public/evidence-from-excel/`; la BD actual solo tiene 2 findings y 3 Evidence privadas. Se priorizaron schema, código, ADR-001 y estado actual de BD.
- Scripts históricos procesan solo `worksheets[0]`, `drawing1.xml`, un número fijo de drawings o asignan una imagen por finding. No son compatibles con el XLSX actual de 12 hojas y relación 1:N.
- Los tres ImportBatch PENDING existentes señalan un XLSX anterior de 33,458,128 bytes y no tienen findings vinculados. El XLSX actual tiene 46,221,233 bytes y SHA distinto.

## Resultado del dry-run

- Findings XLSX: 234
- Matched existing: 0
- CREATE: 234
- UPDATE: 0
- NOOP: 0
- CONFLICT/AMBIGUOUS: 0
- Sessions CREATE: 12
- Sessions REUSE: 0
- XLSX media unique: 226
- XLSX drawing anchors: 265
- Evidence mappings: 265
- Evidence CREATE: 265
- Evidence duplicate: 0
- Evidence existing/reuse: 0
- Evidence unmapped/conflict: 0
- Legacy replacements: 0
- Status promotions: 104
- SupportLinks CREATE: 22
- Comments CREATE: 80

## Validación

- `npm test`: PASS, 42 archivos y 570 tests.
- Tests nuevos: PASS, 19 tests.
- `npm run build`: PASS.
- `npm run lint`: FAIL por deuda preexistente fuera de este cambio (274 errores y 85 warnings); lint dirigido a los tres archivos nuevos: PASS.
- No se ejecutó APPLY, deployment, restart PM2 ni smoke HTTP autenticado.

## Rollback previsto

Antes de cualquier mutación el script crea `backups/xlsx-normalization-{timestamp}/` con `pg_dump` custom, archive del storage privado, reporte dry-run y manifest. Los cambios de Finding son auditados; los cambios de estado crean `FindingStatusHistory`; la evidencia usa el ciclo de vida de `StorageService`. Legacy solo se soft-deletea después de confirmar objeto y URL de sustitución.

## Artefactos y código

- `scripts/normalize-pruebas-maria-xlsx.ts`
- `scripts/lib/pruebas-maria-xlsx.ts`
- `scripts/__tests__/normalize-pruebas-maria-xlsx.test.ts`
- `artifacts/xlsx-normalization-report-2026-08-19.json`

## Comando de APPLY (NO EJECUTADO; requiere autorización)

```bash
node scripts/run-ts.cjs scripts/normalize-pruebas-maria-xlsx.ts \
  --file="/home/alexis/Pruebas Maria 2.0.xlsx" \
  --report="/var/www/apps/uix/artifacts/xlsx-normalization-report-2026-08-19.json" \
  --apply
```
