# Import mapping - Fase 2

Fecha: 2026-08-11  
Fuente real disponible: `public/contenido/inventario-observaciones.csv`  
XLSX real encontrado: no

## Resumen del archivo real

Columnas detectadas:

- `ID`
- `Ronda`
- `Fila fuente`
- `Observación`
- `Ajuste`
- `Comentarios`
- `Estatus`
- `Área`
- `Etapa`
- `Evidencias`

Conteo:

- filas con contenido: 176
- observaciones vacias: 0
- `Completado`: 82
- `Pendiente`: 94
- areas: UI 103, Copy 26, Funcionalidad 26, Backend 12, Negocio 9
- referencias de evidencia: 198
- referencias unicas de evidencia: 172

## Mapping de columnas

| Columna original | Campo normalizado | Persistencia |
| --- | --- | --- |
| `ID` | `sourceId` | Entra al fingerprint; no tiene columna propia. |
| `Ronda` | `round` | Conservado en normalizacion; puede orientar `TestSession`. |
| `Fila fuente` | `sourceRow` | `Finding.sourceRow`. |
| `Observación` | `observation` | `Finding.observation`. |
| `Ajuste` | `adjustment` | Crea `Resolution.description` cuando existe. |
| `Comentarios` | `comments` | Crea `Comment.text` cuando existe. |
| `Estatus` | `status` | `Finding.status`. |
| `Área` | `area` | Mapea a incidencia y/o experience tag. |
| `Etapa` | `stage` | Conservado en normalizacion; pendiente de campo dedicado. |
| `Evidencias` | `evidenceRefs` | Crea registros `Evidence`. |

## Mapping de estados

| Valor legacy | Enum interno |
| --- | --- |
| `Completado` | `VALIDATED` |
| `Pendiente` | `OPEN` |
| `TRUE` / `VERDADERO` | `VALIDATED` |
| `FALSE` / `FALSO` | `OPEN` |

Decision: no se infiere `CLOSED` desde `Completado`. Un hallazgo validado y un hallazgo cerrado son estados operativos distintos.

## Mapping de area

| Area legacy | IncidenceType | ExperienceTag | Nota |
| --- | --- | --- | --- |
| `UI` | `DESIGN` | `UI` | Mapea a diseño visual. |
| `UX` | `DESIGN` | `UX` | Soportado aunque no aparece en el CSV real. |
| `Copy` | `COPY` | `COPY` | Mapea a incidencia y experiencia copy. |
| `Funcionalidad` | `FUNCTIONALITY` | ninguno | No fuerza UI/UX/Copy. |
| `Backend` | `FUNCTIONALITY` | ninguno | Advertencia: no existe enum `BACKEND`. |
| `Negocio` | `BUSINESS_RULE` | ninguno | Reglas de negocio. |

Areas desconocidas se importan sin categoria y generan warning de preview.

## Evidencias legacy

El CSV referencia archivos como `image4.png`, pero el filesystem real contiene `public/images/image4.jpg`.

Regla implementada:

1. Buscar el nombre exacto bajo `public/images`.
2. Si no existe, probar mismo basename con `.jpg`, `.jpeg`, `.png`, `.webp`.
3. Si existe, guardar:
   - `Evidence.originalFilename`: referencia original del CSV.
   - `Evidence.storageKey`: `legacy/public/images/<archivo-resuelto>`.
   - `Evidence.url`: `/images/<archivo-resuelto>`.
4. Si no existe, guardar `legacy/unresolved/<archivo>` y emitir warning.

La migracion a object storage real pertenece a Fase 4.

## XLSX

No hay `.xlsx` real en el repositorio, por lo que no se puede validar una asociacion fila-imagen con evidencia empirica.

Implementacion actual:

- soporta lectura `.xlsx` via `exceljs`
- detecta hojas
- detecta headers
- extrae filas tabulares
- detecta conteo de imagenes embebidas por hoja
- emite warning `EMBEDDED_IMAGES_NOT_EXTRACTED` si hay imagenes

Decision: no se promete extraccion/asociacion de imagen embebida hasta probar con un workbook real.

## Fingerprint idempotente

Persistencia:

- `Finding.sourceFingerprint String? @unique`

Componentes del hash:

- `projectId`
- `testSessionId`
- `sourceSheet`
- `sourceId`
- `sourceRow`
- `observation` normalizada

Razonamiento:

- misma observacion en otra sesion puede ser valida
- misma fila en otro archivo/sesion no debe bloquearse
- solo texto de observacion no es suficiente
- el fingerprint permite preview de duplicados y confirm idempotente

## Preview

`POST /api/imports/preview`:

- requiere usuario autenticado
- valida archivo CSV/XLSX
- valida `projectId`
- crea `TestSession` de import si no se envia una
- crea `ImportBatch` con status `PENDING`
- no crea `Finding`
- retorna resumen, incidencias, hojas, columnas, duplicados y primeras filas normalizadas

## Confirm

`POST /api/imports/:id/confirm`:

- requiere usuario autenticado
- requiere batch `PENDING`
- reparsea el archivo
- recalcula fingerprints
- salta duplicados existentes o repetidos dentro del archivo
- crea Findings, Evidence, categorias, comentarios, resoluciones, historial y audit logs en una transaccion
- marca el batch `COMPLETED`
- marca el batch `FAILED` si ocurre error

## Cambios de schema de Fase 2

Migracion:

`prisma/migrations/zzz_20260811010000_import_fingerprint/migration.sql`

Incluye:

- `Finding.sourceFingerprint`
- unique index para idempotencia
- remocion de `import_batches_testSessionId_key` para permitir varios batches por sesion

Validacion:

- migraciones aplicadas desde DB temporal vacia con `prisma migrate deploy`
- diff final contra `schema.prisma` sin diferencias

## Pendiente

- Aplicar migraciones pendientes en una DB de desarrollo controlada.
- Probar XLSX con archivo real.
- Definir campo dedicado para `Etapa` si el frontend lo requiere.
- Mover evidencias legacy a object storage en Fase 4.
