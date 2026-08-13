---
title: Import Audit Phase 1-3
purpose: Audit results of ETL import validation
---

# 🔍 AUDITORÍA DE IMPORTACIÓN: FASE 1-3

**Fecha**: 2026-08-12  
**Status**: 🔴 **REVIEW REQUERIDO** — No proceder sin validación adicional  
**Objetivo**: Importar datos de Pruebas Maria 2.0.xlsx y Pruebas Maria 2.csv → PostgreSQL  

---

## 📊 FASE 1: ARQUITECTURA DEL PROYECTO

### Stack Confirmado
| Componente | Versión | Propósito |
|-----------|---------|----------|
| **Framework** | Next.js 16.3 + React 19 | Frontend + API routes |
| **ORM** | Prisma 7.9.1 | PostgreSQL abstraction |
| **Auth** | Lucia 3.2.2 + @lucia-auth/adapter-prisma | Session management |
| **Database** | PostgreSQL (transactional) | Datos persistentes |
| **Search** | Elasticsearch 8.19.2 | Full-text search |
| **Real-time** | Socket.io + Redis | Collaboration |
| **Storage** | Cloudflare R2 | Evidence files (S3-compatible) |

### Esquema PostgreSQL: Entidad Core `Finding`

**Tabla**: `findings`
- **PK**: `id` (CUID)
- **FK**: projectId, testSessionId, createdBy, assigneeId, importBatchId
- **Status enum**: OPEN, TRIAGED, IN_PROGRESS, READY_FOR_VALIDATION, VALIDATED, CLOSED, BLOCKED, REOPENED
- **Prioridad enum**: LOW, MEDIUM, HIGH, CRITICAL
- **Severidad enum**: COSMETIC, MINOR, MAJOR, BLOCKER
- **Esfuerzo enum**: S, M, L, XL
- **Índices**: createdAt, status, priority, testSessionId, deletedAt, (createdAt, status), sourceFingerprint (UNIQUE)
- **Campos especiales**:
  - `sourceFingerprint` (UNIQUE) — para deduplicación de importes
  - `importBatchId` (FK nullable) — rastreo de lotes
  - `sourceSheet`, `sourceRow` — trazabilidad del archivo origen
  - `observation` — descripción principal del hallazgo

**Relaciones**:
- `Project` (M:1) — proyecto donde ocurre el hallazgo
- `TestSession` (M:1) — sesión de prueba (vinculado a proyecto + versión)
- `User` (createdBy, updatedBy, assignee) — auditoría y asignación
- `FindingIncidenceType` (M:N) — categorías (DESIGN, FUNCTIONALITY, BUSINESS_RULE, COPY)
- `FindingExperienceTag` (M:N) — etiquetas (UI, UX, COPY)
- `Evidence` (1:N) — archivos adjuntos
- `Resolution`, `Validation`, `Comment` — workflow
- `FindingStatusHistory` — auditoría de cambios

---

## 📝 FASE 2: ANÁLISIS DE ARCHIVOS ORIGEN

### CSV: `Pruebas Maria 2.csv`

| Propiedad | Valor |
|-----------|-------|
| **Tamaño** | 10.47 KB |
| **Filas** | 114 |
| **Columnas** | 5 |
| **Encoding** | UTF-8 (probable, con algunos caracteres mal interpretados) |
| **Delimitador** | `,` (coma) |

**Headers**:
```
| [blank] | Observación | Evidencia | Ajuste | Comentarios
```

**Problemas detectados**:
- ❌ Columna sin nombre (`[blank]`) con valores `VERDADERO/false`
- ❌ Campo `Observación` con caracteres dañados (`Observacín` en lugar de `Observación`)
- ❌ `Evidencia`, `Ajuste`, `Comentarios` **completamente vacíos** (0 valores)
- ❌ No contiene `Área`, `Estatus`, `Etapa` ni información de clasificación
- ⚠️  114 filas = potencial duplicidad con XLSX

**Muestra de datos**:
```
Fila 1: [true] | "Punto final en el segundo slide" | "" | "" | ""
Fila 2: [true] | "Degadadado de fondo: background: var(--Color-Fill-Gradient-Button...)" | "" | "" | ""
Fila 3: [true] | "Mantener la proporción entre REMS" | "" | "" | ""
```

**Conclusión CSV**: ⚠️  Fuente potencial válida pero **INCOMPLETA**. Columnas de contexto faltan.

---

### XLSX: `Pruebas Maria 2.0.xlsx`

| Propiedad | Valor |
|-----------|-------|
| **Tamaño** | 31.91 MB (!!) |
| **Filas** | 23 |
| **Columnas** | 4 |
| **Sheets** | 1 (verificar en lectura completa) |

**Headers**:
```
| [blank] | Observación | Pantalla Anterior | Modificación
```

**Problemas detectados**:
- ❌ Columna sin nombre (`[blank]`) con valores booleanos o URLs
- ❌ **TAMAÑO DESPROPORCIONADO (31 MB para 23 filas)** → **IMÁGENES/VÍDEOS EMBEBIDOS**
- ❌ Headers son `Pantalla Anterior` y `Modificación` (NO `Ajuste`)
- ⚠️  Solo 23 filas vs 114 en CSV — **NO son los mismos datos**

**Muestra de datos** (truncado por tamaño):
```
Fila 1: [false] | "Se reemplazó la promesa de tiempo por un beneficio real del flujo..." | [datos complejos] | []
Fila 2: [false] | "Hogar: Engloba mejor esta y otras subcategorías..." | [datos] | []
Fila 3: [false] | "Hagámoslo posible" funciona tanto para..." | [datos] | []
```

**Conclusión XLSX**: ⚠️ Fuente parcial y **POTENCIALMENTE MULTIMEDIA**. Requiere análisis de contenido embebido.

---

## 🔍 FASE 3: COMPARACIÓN XLSX vs CSV

### Estadísticas

| Métrica | CSV | XLSX | Conclusión |
|---------|-----|------|-----------|
| **Filas** | 114 | 23 | ❌ Diferentes (91 diferencia) |
| **Columnas comunes** | 0/5 | 0/4 | ❌ NINGÚN MAPEO DIRECTO |
| **Headers coincidentes** | - | - | ❌ Solo "Observación" podría mapear |
| **Mismo source_of_truth** | ❌ | ❌ | ⚠️ **VERSIONES DIFERENTES** |

### Análisis de Headers

```
CSV:
  - [blank] (desconocido)
  - Observación ← PODRÍA SER COMÚN
  - Evidencia (vacía)
  - Ajuste (vacía)
  - Comentarios (vacía)

XLSX:
  - [blank] (desconocido)
  - Observación ← PODRÍA SER COMÚN
  - Pantalla Anterior (no en CSV)
  - Modificación (similar a Ajuste del CSV pero estructura diferente)
```

### Hipótesis

1. **XLSX es la versión actualizada** (más reciente, con multimedia)
2. **CSV es un export anterior** (más datos, pero incompleto)
3. **No son duplicados directos** — probablemente conjuntos de observaciones de fases diferentes

### CRÍTICO: Determinación de Source of Truth

**❌ CRITERIO FALLIDO**: Sin información temporal (fechas, versiones), es IMPOSIBLE determinar cuál es más reciente o válida.

**Necesario verificar**:
- [ ] Fechas de modificación de archivos (filesystem)
- [ ] Metadatos de Excel (autor, fecha creación)
- [ ] Cualquier contexto de negocio (si el usuario los proporciona)

---

## 🎯 MODELO DE IMPORTACIÓN: ESPERADO vs REALIDAD

### Columnas Conocidas por `import-service.ts`

El sistema espera mapear desde archivos a `Finding` usando:

```typescript
const KNOWN_COLUMNS = [
  'ID',
  'Ronda',
  'Fila fuente',
  'Observación',
  'Ajuste',
  'Comentarios',
  'Estatus',
  'Estado',
  'Área',
  'Area',
  'Etapa',
  'Evidencias',
  'Evidencia',
]
```

**Mapeo esperado**:
- `Observación` → `Finding.observation` (requerido)
- `Área` → determina `incidenceTypes` y `experienceTags`
- `Estatus`/`Estado` → normaliza a `Finding.status` enum
- `Ajuste` → `Finding.adjustment`
- `Comentarios` → `Finding.comments`
- `Evidencias`/`Evidencia` → referencias a archivos → `Evidence` M:1
- `Ronda`, `Etapa` → metadata
- `ID` → `sourceId` para deduplicación

### Realidad de Datos

| Campo esperado | CSV | XLSX | Disponible |
|---|---|---|---|
| **Observación** | ✅ | ✅ | ✅ |
| **Área** | ❌ | ❌ | ❌ |
| **Estatus** | ❌ | ❌ | ❌ |
| **Ajuste** | ✅ (vacío) | ✅ (`Modificación`) | ⚠️ Parcial |
| **Comentarios** | ✅ (vacío) | ❌ | ❌ |
| **Evidencia** | ✅ (vacío) | ❌ | ⚠️ Embebida en XLSX |
| **Ronda/Etapa** | ❌ | ❌ | ❌ |
| **ID** | ❌ | ❌ | ❌ |

---

## ⚠️ PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. Falta de Información de Contexto

- ❌ **No hay `Área`** → Los hallazgos no pueden clasificarse en DESIGN/FUNCTIONALITY/BUSINESS_RULE/COPY
- ❌ **No hay `Estatus`** → Todos entrarían como OPEN por defecto
- ❌ **No hay `Project`** → ¿En qué proyecto importar? Requiere selección manual
- ❌ **No hay `TestSession`** → ¿A qué sesión de prueba pertenecen?

### 2. Inconsistencia de Estructura

- ❌ CSV y XLSX tienen **distinto número de filas y columnas**
- ❌ No hay campo común de `ID` o `sourceId` para deduplicación confiable
- ❌ Encoding y formateo inconsistentes (especialmente CSV)

### 3. Datos Incompletos

- ❌ CSV: `Evidencia`, `Ajuste`, `Comentarios` están **100% vacíos**
- ❌ XLSX: `Modificación` tiene datos pero formato desconocido (potencialmente HTML/markup)
- ❌ XLSX: Multimedia embebida (31 MB) → requiere extracción y carga a R2

### 4. Deduplicación Incierta

- ⚠️ CSV + XLSX podrían tener **observaciones duplicadas** pero en diferente contexto
- ⚠️ Sin `sourceId` único, el sistema usará `fingerprint(projectId, testSessionId, sourceSheet, sourceRow, observation)`
- ⚠️ Si importo con `sourceSheet="CSV"` y `sourceSheet="XLSX"`, la MISMA observación se considerará distinta

---

## 🔐 ESTADO ACTUAL DE POSTGRESQL

### Comando Verificación (NO EJECUTADO)

```bash
psql $DATABASE_URL -c "
  SELECT COUNT(*) as total_findings,
         COUNT(DISTINCT importBatchId) as batches,
         COUNT(DISTINCT sourceFingerprint) as fingerprints
  FROM findings WHERE deletedAt IS NULL;
"
```

**Status**: ⏳ Pendiente ejecución hasta confirmación de usuario

---

## ✅ NEXT STEPS: FASE 4-15

### Fase 4: Auditoría de Calidad (PENDIENTE)

- [ ] Detectar valores categóricos anómalos
- [ ] Normalizar nulls/vacíos
- [ ] Validar fechas
- [ ] Identificar duplicados semánticos

### Fase 5-6: Normalización y Mapping (PENDIENTE)

- [ ] Proponer `Área` canónica (si no disponible, usar default)
- [ ] Proponer `Estatus` default o normalizado
- [ ] Crear tabla mapping origen → destino

### Fase 7-9: ETL y Dry-Run (PENDIENTE)

- [ ] Crear scripts de importación reproducibles
- [ ] Soportar flag `--dry-run`
- [ ] Validar transaccionalidad

### Fase 10-13: Backup, Rollback, Validación (PENDIENTE)

- [ ] Crear backup pre-importación
- [ ] Ejecutar importación segura
- [ ] Validar integridad post-importación

---

## 🚨 RECOMENDACIÓN FINAL

**⛔ NO PROCEDER CON IMPORTACIÓN HASTA QUE SE RESPONDA**:

1. **¿Cuál es el `projectId` destino?** (ej: UUID del proyecto)
2. **¿Cuál es el `testSessionId` destino?** (ej: UUID de la sesión de prueba)
3. **¿Cuál es el `Área` predeterminada?** (DESIGN, FUNCTIONALITY, BUSINESS_RULE, COPY)
4. **¿Cuál archivo es source of truth?** (CSV, XLSX, ambos)
5. **¿Cómo se han de deduplicar si ambos contienen la misma observación?**
6. **¿Requieren carga los datos multimedia embebidos en XLSX?** ¿A dónde (R2)?
7. **¿Quién es el `createdBy` usuario?** (ej: UUID del usuario que importa)

---

## 📋 CRITERIOS DE ACEPTACIÓN (Estado)

- [ ] XLSX fue analizado ✅
- [ ] CSV fue analizado ✅
- [ ] Se compararon ambas fuentes ✅
- [ ] Se identificó el source of truth ⏳ (PENDIENTE VALIDACIÓN DEL USUARIO)
- [ ] Se auditó PostgreSQL ⏳ (PENDIENTE)
- [ ] Se auditó el modelo `/findings` ✅
- [ ] Existe mapping origen → destino ⏳ (PENDIENTE)
- [ ] Los datos fueron normalizados ⏳ (PENDIENTE)
- [ ] Los duplicados fueron detectados ⏳ (PENDIENTE)
- [ ] El proceso es idempotente ⏳ (PENDIENTE)
- [ ] Existe dry-run ⏳ (PENDIENTE)
- [ ] Existe backup ⏳ (PENDIENTE)
- [ ] Existe rollback ⏳ (PENDIENTE)
- [ ] La importación utiliza transacción ⏳ (PENDIENTE)
- [ ] Se validaron PK/FK/UNIQUE/CHECK ⏳ (PENDIENTE)
- [ ] No quedaron relaciones huérfanas ⏳ (PENDIENTE)
- [ ] `/findings` lista correctamente ⏳ (PENDIENTE)
- [ ] `/findings/[id]` carga correctamente ⏳ (PENDIENTE)
- [ ] No se generaron HTTP 500 ⏳ (PENDIENTE)
- [ ] Se documentaron cambios ⏳ (PENDIENTE)

---

## 🔗 Referencias

- [import-service.ts](./lib/services/import-service.ts) — Lógica de importación
- [normalization-service.ts](./lib/services/normalization-service.ts) — Normalización de datos
- [prisma/schema.prisma](./prisma/schema.prisma) — Schema PostgreSQL
- [.env.production](./.env.production) — Configuración (secrets enmascarados)
