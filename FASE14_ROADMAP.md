# FASE 14 — Advanced Filters & Batch Actions
## Roadmap & Skill Recommendations

**Fecha**: 2026-08-10  
**Fase Anterior**: FASE 13 ✅ COMPLETADA  
**Estado**: Próxima sesión (planeada)  
**Duración Estimada**: 3-4 horas  
**Idioma**: Español  

---

## 🎯 Objetivo FASE 14

Ampliar la experiencia de búsqueda con:
1. **Advanced Filters Panel** — Multi-select avanzado con assignee, project, date ranges
2. **Batch Actions Toolbar** — Acciones sobre múltiples resultados (status update, assign, delete)
3. **Filter Preview** — Mostrar criterios activos en forma visual (chips removibles)
4. **Search History** — Guardar búsquedas recientes para acceso rápido

---

## 📋 Scope Detallado

### Feature 1: Advanced Filters Panel

**Problema Actual**: FASE 13 tiene filtros básicos (Status, Priority). Usuarios necesitan filtrar por:
- Assignee (usuario responsable)
- Project (proyecto/ronda de pruebas)
- Date range (fechas creación/actualización)
- Severity (COSMETIC, MINOR, MAJOR, BLOCKER)
- Has Evidence (sí/no)

**Solución**:
- Modal "Advanced Filters" con multi-select dropdowns
- Date picker (from/to)
- Checkbox toggles (Has Evidence)
- Respeta diseño mobile-first de FASE 13
- Integra con `useSearch` hook existente

**Archivos a modificar**:
- `components/search/AdvancedFilterPanel.tsx` (nuevo)
- `components/search/SearchFindings.tsx` (integrar panel)
- `lib/hooks/useSearch.ts` (expandir query params)

### Feature 2: Batch Actions Toolbar

**Problema Actual**: Usuarios deben abrir cada resultado para cambiar status. Ineficiente para bulk updates.

**Solución**:
- Checkboxes en cada resultado para seleccionar
- Toolbar sticky con acciones: "Change Status", "Assign to", "Delete"
- Confirmation dialog antes de ejecutar
- Optimistic updates (UI actualiza antes que respuesta API)

**Archivos a modificar**:
- `components/search/SearchResultItem.tsx` (agregar checkbox)
- `components/search/BatchActionsToolbar.tsx` (nuevo)
- `app/api/findings/bulk-update/route.ts` (ya existe, reutilizar)

### Feature 3: Filter Preview

**Problema Actual**: No hay forma visual de ver qué criterios están activos (especialmente en mobile con acordeón collapsed).

**Solución**:
- Chips removibles mostrando cada filtro activo
- Ej: `Status: OPEN` `Priority: HIGH` `Assignee: John` [X] [X] [X]
- Click X en chip remueve ese filtro específico
- "Clear All" button

**Archivos a modificar**:
- `components/search/FilterPreview.tsx` (nuevo)
- `components/search/SearchFindings.tsx` (integrar preview)

### Feature 4: Search History

**Problema Actual**: Usuarios frecuentes repiten la misma búsqueda. Sin historial, pierden tiempo.

**Solución**:
- Guardar últimas 10 búsquedas en IndexedDB (ya disponible desde FASE 8)
- Mostrar dropdown de histórico al enfocar input (vacío/reciente)
- Click en histórico restaura criterios (text, filters)
- Opcional: starred/favorited searches para guardar indefinido

**Archivos a modificar**:
- `lib/services/search-history-service.ts` (nuevo)
- `components/search/SearchHistory.tsx` (nuevo)
- `components/search/SearchFindings.tsx` (integrar dropdown)

---

## 🛠️ Archivos Impactados

### Nuevos Archivos
```
components/search/
├─ AdvancedFilterPanel.tsx          (250 líneas, multi-select UI)
├─ BatchActionsToolbar.tsx          (200 líneas, bulk actions)
├─ FilterPreview.tsx                (100 líneas, active filters chips)
└─ SearchHistory.tsx                (150 líneas, recent searches dropdown)

lib/services/
└─ search-history-service.ts        (80 líneas, IndexedDB + CRUD)
```

### Modificaciones Existentes
```
components/search/
├─ SearchFindings.tsx               (integrar nuevos components)
└─ SearchResultItem.tsx             (agregar checkbox para batch select)

lib/hooks/
├─ useSearch.ts                     (expandir query params)
└─ useBatchActions.ts               (nuevo hook, usar bulk-update API)

lib/types/
└─ search.ts                        (new types: FilterPreset, SearchHistoryEntry)
```

---

## 🎨 Diseño & UX

### Advanced Filters Panel

```
┌─────────────────────────────────────┐
│  Filtros Avanzados              [X] │
├─────────────────────────────────────┤
│ Asignado a:  [Dropdown: John, Jane] │
│ Proyecto:    [Dropdown: P1, P2, P3] │
│ Severidad:   [Multi: MINOR, MAJOR]  │
│ Fecha desde: [Date picker]          │
│ Fecha hasta: [Date picker]          │
│ Tiene evidencia: [✓] Sí [  ] No    │
├─────────────────────────────────────┤
│ [Limpiar]          [Aplicar]        │
└─────────────────────────────────────┘
```

### Batch Actions Toolbar

```
┌─ 3 resultados seleccionados ─────────────────────┐
│  [Change Status ▼] [Assign ▼] [Delete]          │
└────────────────────────────────────────────────────┘
```

### Filter Preview

```
Status: OPEN [X]  Priority: HIGH [X]  Assignee: John [X]  [Clear All]
```

---

## 📊 Metrics & KPIs

| Métrica | Target |
|---------|--------|
| Build time | <50s |
| Type errors | 0 |
| New components | 4 |
| Lines added | ~800 |
| Touch targets mobile | 44x44px |
| Lighthouse score | ≥90 mobile, ≥95 desktop |
| Batch action latency | <500ms |

---

## 🧪 Testing Strategy

### Unit Tests (Recomendado)
- AdvancedFilterPanel: multi-select logic, date range validation
- BatchActionsToolbar: selection state, bulk action submission
- SearchHistoryService: IndexedDB CRUD, max 10 items

### Integration Tests (DevTools)
- Advanced filters + search: verificar query params correctos
- Batch select: checkbox state, counter, toolbar visibility
- Filter preview: removable chips funcionan, "Clear All" limpia todo
- Search history: guardar/restaurar criterios

### Regression Tests
- FASE 13 mobile: advanced filters panel respeta bottom-sheet modal
- FASE 12 search API: new query params se pasan correctamente
- Elasticsearch: aggregations para assignee/project facets

---

## 🎓 Skill Recommendations

### Para Próxima Sesión (FASE 14):

#### **Primera Opción: `/senior-backend`** ⭐ RECOMENDADO

**Por qué**: FASE 14 es 60% backend (API params, bulk-update, aggregations) y 40% frontend (UI components).

**Tareas que cubre**:
- ✅ Expandir SearchQuery validator con assignee, project, dateRange, hasEvidence
- ✅ Actualizar GET /api/search/findings para soportar nuevos params
- ✅ Optimizar Elasticsearch aggregations para new facets
- ✅ Implementar/optimizar bulk-update endpoint
- ✅ Database queries para assignee list, project list (lookup data)
- ✅ Transaction handling para batch updates (no partial failures)
- ✅ Error handling: validation, permission checks, race conditions

**Comando**:
```bash
/senior-backend
```

**Prompt Recomendado**:
```
Necesito extender la búsqueda de FASE 12/13 para FASE 14.

Tareas backend:
1. Expandir SearchQuery validator: agregar assignee, project, dateRange, hasEvidence
2. Actualizar GET /api/search/findings para soportar estos parámetros
3. Elasticsearch aggregations: facets por assignee, project, date
4. Implementar batch-update endpoint (o refactor /api/findings/bulk-update)
5. Database: queries eficientes para assignee/project lookups
6. Transaccional: batch updates sin partial failures
7. Testing: integration test con nuevos query params

Stack actual: Next.js 16.3, Prisma 7.9.1, Elasticsearch 8.11.0, PostgreSQL

Archivos modificar:
- lib/validators/search-query.ts (nuevo schema)
- app/api/search/findings/route.ts (nuevos params)
- lib/services/search-service.ts (nuevas queries)
- app/api/findings/bulk-update/route.ts (mejorar si existe)
```

---

#### **Segunda Opción: `/frontend-developer`** (si prefieres UI-first)

**Por qué**: Si la prioridad es UI/UX antes que backend.

**Tareas que cubre**:
- ✅ Componentes React: AdvancedFilterPanel, BatchActionsToolbar, FilterPreview
- ✅ Form handling: multi-select, date pickers, validation
- ✅ State management: tracking selection, filter state
- ✅ Mobile responsiveness: advanced filters modal mobile vs desktop
- ✅ Search history: IndexedDB integration, recent searches dropdown
- ✅ Accessibility: ARIA labels, keyboard nav, focus management
- ✅ Testing: component tests con Testing Library

**Comando**:
```bash
/frontend-developer
```

**Prompt Recomendado**:
```
Necesito agregar 4 componentes nuevos para FASE 14 (Advanced Filters & Batch Actions).

Componentes a crear:
1. AdvancedFilterPanel: modal/panel con assignee, project, date range, severity, hasEvidence
2. BatchActionsToolbar: toolbar sticky con acciones bulk (status, assign, delete)
3. FilterPreview: chips removibles mostrando filtros activos
4. SearchHistory: dropdown con últimas 10 búsquedas (IndexedDB)

Requisitos:
- Mobile-first (respeta FASE 13 bottom-sheet)
- Accesibilidad: focus rings, ARIA labels, keyboard nav
- Touch-friendly: 44x44px targets, no hovers
- Estado compartido con useSearch hook (FASE 12/13)
- IndexedDB para historial (ya disponible desde FASE 8)
- Typescript strict mode

Stack: React 19, Next.js 16.3, Tailwind v4, Lucide icons

Archivos:
- components/search/AdvancedFilterPanel.tsx (nuevo, 250 líneas)
- components/search/BatchActionsToolbar.tsx (nuevo, 200 líneas)
- components/search/FilterPreview.tsx (nuevo, 100 líneas)
- components/search/SearchHistory.tsx (nuevo, 150 líneas)
- components/search/SearchFindings.tsx (integrar nuevos componentes)
- components/search/SearchResultItem.tsx (agregar checkbox)
```

---

#### **Tercera Opción: Plan + Arquitectura (si hay incertidumbre)**

**Cuándo usar**: Si no está claro si hacer frontend o backend primero, o cómo estructurar estado compartido.

**Comando**:
```bash
/Plan
```

**Beneficio**: Designer del equipo analiza el problema, propone arquitectura (data flow, component hierarchy, API contract), luego tú eliges si delegar a `/senior-backend` o `/frontend-developer`.

---

## ⚙️ Technical Decisions (Pre-Implementation)

### State Management
- **Opción 1** (Recomendada): Extender `useSearch` hook con batch selection state
  ```ts
  useSearch(query) → { data, isLoading, selectedIds, setSelectedIds, ... }
  ```
- **Opción 2**: Custom `useBatchSelect` hook separado
  ```ts
  useBatchSelect() → { selectedIds, toggleSelect, selectAll, clearSelection }
  ```

### Advanced Filters: Modal vs Panel
- **Mobile**: Modal overlay (reutiliza patrón FASE 13 bottom-sheet)
- **Desktop**: Side panel (1/4 ancho) o modal centered
- **Ambos**: Mismo componente, diferente layout via `hidden md:block` / `md:hidden`

### Search History Storage
- **IndexedDB** (elegido): Offline-first, async, no límite de espacio
- Data: `{ id, text, status[], priority[], assignee, project, dateFrom, dateTo, timestamp }`
- Max 10 items (FIFO, borrar más viejo al agregar nuevo)
- Optional: allow user to star for permanent save

### Bulk Update API
- **Use existing**: `POST /api/findings/bulk-update` (reutilizar de FASE 12 si existe)
- **Payload**: `{ ids: string[], updates: { status?, assignee?, ... } }`
- **Response**: `{ updated: number, failed: number, errors: [] }`
- **Optimistic**: UI actualiza inmediatamente, rollback si falla

---

## 📅 Next Steps

1. **Esta sesión (FASE 13)**: ✅ COMPLETADA
2. **Próxima sesión (FASE 14)**: 
   - Invocar skill recomendado arriba
   - Usar prompt master + FASE13_MASTER_PROMPT.md como contexto
   - Crear archivos nuevos, modificar existentes
   - Testing: DevTools emulation + real device
   - Commit + merge a main
3. **FASE 15+**: Export/Analytics, Mobile app native, Dark mode expansion

---

## 🔗 Referencias

- **FASE 13 MASTER_PROMPT.md** — Contexto técnico de búsqueda actual
- **FASE13_COMPLETION.md** — Testing strategy ya documentado
- **Elasticsearch Aggregations** — facet para assignee, project, date histogram
- **Prisma Bulk Operations** — updateMany para batch updates eficiente
- **React Hooks** — useCallback, useMemo para optimizar re-renders

---

## 💾 Memory Update (Para próxima sesión)

Guardar en `/root/.claude/projects/-var-www-uix-torrax-cloud/memory/`:

```markdown
# FASE 14 Roadmap

**Status**: Planeada para próxima sesión  
**Skill Recomendado**: /senior-backend (backend-first) o /frontend-developer (UI-first)  
**Duración**: 3-4 horas  
**Features**: Advanced Filters, Batch Actions, Filter Preview, Search History

**Pre-requisitos**: FASE 13 ✅ completada, `useSearch` hook estable, `/api/search/findings` funcionando

Archivos nuevos: 4 componentes React + 1 service IndexedDB
Modificaciones: SearchFindings.tsx, SearchResultItem.tsx, search validators, bulk-update API

Skill choice depends on priorities:
- Backend-heavy: /senior-backend (API params, aggregations, bulk-update)
- UI-heavy: /frontend-developer (components, state, mobile-first)
- Uncertain: /Plan primero para arquitectura
```

---

**Próxima Sesión Ready** ✅  
**Documentación**: FASE13_MASTER_PROMPT.md + FASE14_ROADMAP.md  
**Recomendación Skill**: `/senior-backend` ⭐
