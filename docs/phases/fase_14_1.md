# FASE 14.1 — Date Intelligence & Filter UX

**Status**: ✅ **COMPLETADA**  
**Fecha**: 2026-08-13  
**Duración**: ~4 horas (Backend ~1h + Frontend ~2h + Testing ~1h)  
**Build**: ✅ SUCCESS  
**TypeScript**: ✅ CLEAN (0 errors)  
**Lint**: ✅ PASS (no new issues)

---

## 📋 Resumen Ejecutivo

FASE 14.1 introduce **Date Intelligence** al sistema de filtros de Pruebas María 2.0, permitiendo filtrar hallazgos por cuatro tipos de fecha semánticamente distintos:

- **Fecha de creación** (`Finding.createdAt`) — Cuándo se registró el hallazgo
- **Última actualización** (`Finding.updatedAt`) — Cuándo se modificó
- **Fecha de carga** (`ImportBatch.importedAt`) — Cuándo se importó a la plataforma
- **Fecha de prueba** (`TestSession.date`) — A qué sesión pertenece

---

## 🎯 Problemas Resueltos

### Antes (FASE 14)
- ❌ "Rango de fechas" era ambiguo (¿createdAt? ¿updatedAt?)
- ❌ No había forma de filtrar por fecha de carga
- ❌ No había forma de filtrar por fecha de sesión
- ❌ UI con colores inconsistentes (slate vs pm-tokens)
- ❌ Componente createdAt era hardcoded con datos estáticos

### Después (FASE 14.1)
- ✅ Selector explícito de "Tipo de fecha"
- ✅ Filtrado por 4 tipos de fecha semánticamente claros
- ✅ UI homologada con tokens `pm-*`
- ✅ Presets rápidos (Hoy, Ayer, 7 días, 30 días, Personalizado)
- ✅ Componentes modulares y reutilizables

---

## 🏗️ Arquitectura Implementada

### Backend

**SearchQuerySchema** (`lib/validators/search-query.ts`)
```typescript
dateType: z.enum(['created', 'updated', 'imported', 'session']).optional()
```

**buildPostgresWhere()** (`lib/services/search-service.ts`)
```typescript
switch (query.dateType || 'created') {
  case 'created':
    where.createdAt = { gte, lte }
  case 'updated':
    where.updatedAt = { gte, lte }
  case 'imported':
    where.importBatch = { importedAt: { gte, lte } }  // JOIN
  case 'session':
    where.testSession = { date: { gte, lte } }  // JOIN
}
```

**searchElasticsearch()** fallback
```typescript
if (query.dateType === 'imported' || query.dateType === 'session') {
  return this.searchPostgres(query)  // Elasticsearch no tiene estos campos
}
```

### Frontend

**Componentes Nuevos**
1. `DateTypeSelector.tsx` — Radio buttons con iconos para seleccionar tipo
2. `DatePresetButtons.tsx` — Presets rápidos + calculador de rangos

**Componentes Modificados**
1. `AdvancedFilterPanel.tsx` — Integrados nuevos componentes + colores `pm-*`
2. `FilterPreview.tsx` — Muestra `dateType` en chips
3. `SearchFindings.tsx` — Propaga `dateType` en `searchQuery`

**Tipos** (`lib/types/search.ts`)
```typescript
type DateFilterType = 'created' | 'updated' | 'imported' | 'session'
type DatePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom'

interface AdvancedFilterValues {
  dateType?: DateFilterType
  datePreset?: DatePreset
  dateFrom?: string
  dateTo?: string
  // ... otros filtros
}
```

---

## 📊 Cambios Detallados

### Archivos Modificados

| Archivo | Líneas | Cambios |
|---------|--------|---------|
| `AdvancedFilterPanel.tsx` | +206/-85 | Integración DateTypeSelector + DatePresetButtons + colores pm-* |
| `FilterPreview.tsx` | +38/-23 | Muestra dateType en chip de fecha + colores pm-* |
| `SearchFindings.tsx` | +9/-0 | Propaga dateType en searchQuery + activeFilterCount |
| `useSearch.ts` | +2/-0 | Serializa dateType a URL params |
| `search-service.ts` | +44/-0 | Switch por dateType + fallback Elasticsearch |
| `search.ts types` | +6/-0 | Nuevos tipos DateFilterType, DatePreset, actualizado AdvancedFilterValues |
| `search-query.ts` | +7/-0 | Enum dateType, normalización en transform |

### Archivos Nuevos

| Archivo | Líneas | Descripción |
|---------|--------|------------|
| `DateTypeSelector.tsx` | 68 | Radio selector para elegir tipo de fecha |
| `DatePresetButtons.tsx` | 76 | Presets + calculador de rangos `getDateRangeForPreset()` |

---

## 📈 Datos Verificados

### createdAt Distribution (8 fechas)
```
2026-08-12: 29 hallazgos
2026-08-11: 187 hallazgos ← Mayoría (ETL Session 7)
2026-08-10: 17 hallazgos
2026-08-06: 3 hallazgos
2026-08-04: 48 hallazgos ← Test Session
2026-08-03: 1 hallazgo
2026-07-31: 15 hallazgos
2026-07-30: 100 hallazgos ← Earliest
```

### updatedAt Distribution (3 fechas)
```
2026-08-13: 205 hallazgos (ETL Session 7 update)
2026-08-12: 21 hallazgos
2026-08-11: 174 hallazgos
```

### ImportBatch.importedAt (3 importaciones)
```
2026-08-13: 205 hallazgos (última importación)
2026-08-12: 19 hallazgos
2026-08-11: 176 hallazgos
```

### TestSession.date (1 sesión)
```
2026-08-11: 400 hallazgos (todas están en la misma sesión)
```

---

## 🔄 Frontend Data Flow

### 1. Usuario selecciona filtro de fecha

```
User clicks AdvancedFilterPanel
  ↓
DateTypeSelector: User picks 'imported'
  ↓
DatePresetButtons: User picks 'last7days'
  ↓
getDateRangeForPreset() calcula [from, to]
  ↓
State: { dateType: 'imported', dateFrom, dateTo }
```

### 2. Aplicar filtro

```
User clicks "Aplicar"
  ↓
SearchFindings: setAdvancedFilters(draft)
  ↓
useMemo(searchQuery) recompute con dateType
  ↓
useSearch(query) → buildParams() serializa
  ↓
GET /api/search/findings?dateType=imported&dateFrom=...&dateTo=...
```

### 3. Backend responde

```
SearchService.search(query)
  ├─ if dateType=imported|session → searchPostgres()
  └─ else → try Elasticsearch, fallback PostgreSQL
```

### 4. Resultados

```
FilterPreview muestra:
  [Importado: 10 ago–16 ago ×]
  
SearchFindings.tsx:
  activeFilterCount++ (dateType !== 'created')
  resultSummary = "42 hallazgos"
```

---

## ✅ Checklist de Validación

### Backend
- ✅ SearchQuerySchema: `dateType` enum validado
- ✅ buildPostgresWhere(): Switch logic implementado
  - ✅ case 'created': WHERE createdAt
  - ✅ case 'updated': WHERE updatedAt
  - ✅ case 'imported': WHERE importBatch.importedAt (JOIN)
  - ✅ case 'session': WHERE testSession.date (JOIN)
- ✅ searchElasticsearch(): Fallback para imported/session
- ✅ Prisma: Relaciones ya existen (no required migración)
- ✅ PostgreSQL: Datos verificados (8 fechas para createdAt, etc)

### Frontend
- ✅ DateTypeSelector: Component funcional
- ✅ DatePresetButtons: Presets + getDateRangeForPreset()
- ✅ AdvancedFilterPanel: Integración + colores pm-*
- ✅ FilterPreview: Muestra dateType + colores pm-*
- ✅ SearchFindings: Propaga dateType en searchQuery
- ✅ useSearch: Serializa dateType a params
- ✅ Colores: Todos actualizados a tokens pm-* (no hardcoded)

### Compilación
- ✅ TypeScript: 0 errores
- ✅ Lint: 0 errores nuevos
- ✅ Build: ✅ SUCCESS (2 intentos exitosos)

### Datos
- ✅ createdAt: 8 fechas, 400 total
- ✅ updatedAt: 3 fechas, 400 total
- ✅ ImportBatch.importedAt: 3 importaciones, 400 total
- ✅ TestSession.date: 1 sesión, 400 total

---

## 🎨 Cambios Visuales

### Colores Actualizados (pm-tokens)

| Elemento | Antes | Después |
|----------|-------|---------|
| Border | `slate-200` (#e2e8f0) | `pm-line` (#dbe4dd) |
| Background | `slate-50` (#f9fafb) | `pm-surface` (#f3f5ef) |
| Texto primario | `slate-900` (#111827) | `pm-ink` (#17251f) |
| Texto secundario | `slate-600` (#475569) | `pm-deep`/`pm-ink` |
| Botón primario | `indigo-600` (#4f46e5) | `pm-green` (#00a85a) |
| Chip hover | `slate-100` (#f3f4f6) | `pm-surface` (#f3f5ef) |

### Componentes Nuevos (Pantallas)

#### Desktop
```
AdvancedFilterPanel (dropdown 396px)
├─ DateTypeSelector (radio buttons 4)
├─ [Si dateRange activo] DatePresetButtons
├─ Date inputs (Desde/Hasta)
└─ Botones: Limpiar | Aplicar
```

#### Mobile
```
AdvancedFilterPanel (bottom-sheet 85vh)
├─ Mismo layout
└─ Touch-optimized (min-h-[44px] targets)
```

---

## 🔒 Security & Performance

### Security
- ✅ RBAC: No cambios (inherited from FASE 14)
- ✅ Input validation: dateType enum en Zod
- ✅ Date normalization: ISO datetime, server-side conversion
- ✅ No N+1: Prisma includes relations implícitamente

### Performance
- ✅ Search debounce: 300ms desktop, 500ms mobile (unchanged)
- ✅ Elasticsearch fallback: Smart fallback para imported/session
- ✅ Frontend: No new subscriptions or watchers
- ✅ Bundle: +~3KB gzipped (2 componentes pequeños)

---

## 🚀 Próximos Pasos (FASE 14.2 ideas)

- [ ] Agregar más presets (por trimestre, mes específico)
- [ ] Analytics: Rastrear qué dateType se usa más
- [ ] Date range picker visual (calendario)
- [ ] Agregar `importedAt` y `sessionDate` a Elasticsearch index para mejor perf
- [ ] Saved filters: Guardar dateType con el filtro
- [ ] URL sync: Guardar dateType en URL searchParams

---

## 📖 Referencia Rápida

### Query Params
```
GET /api/search/findings?
  dateType=created|updated|imported|session
  &dateFrom=2026-08-12T00:00Z
  &dateTo=2026-08-12T23:59Z
```

### Frontend Usage
```tsx
<DateTypeSelector 
  value={dateType}
  onChange={setDateType}
/>

<DatePresetButtons
  onSelectPreset={preset => {
    const [from, to] = getDateRangeForPreset(preset)
    setDateRange({ from, to })
  }}
/>
```

### Backend Logic
```typescript
// En buildPostgresWhere()
const dateType = query.dateType || 'created'
const dateRange = { gte: query.dateFrom, lte: query.dateTo }

switch (dateType) {
  case 'imported':
    where.importBatch = { importedAt: dateRange }
    break
  // ...
}
```

---

## 📚 Archivos Relacionados

- [FASE_14.md](./fase_14.md) — Advanced Filters & Batch Actions (predecesor)
- [ROADMAP.md](./roadmap.md) — Próximas fases
- `/docs/backend/02-data-model.md` — Relaciones Prisma
- `/docs/backend/05-api.md` — API endpoints

---

**Versión**: FASE 14.1 ✅ COMPLETA  
**Próximo**: FASE 14.2 (optimización Elasticsearch) o FASE 15 (Export & Reporting)
