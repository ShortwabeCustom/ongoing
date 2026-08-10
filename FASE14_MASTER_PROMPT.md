# FASE 14 — Advanced Filters & Batch Actions
## Master Prompt & Technical Specification

**Fecha Inicio**: 2026-08-10  
**Status**: Backend ✅ COMPLETADO | Frontend 🚀 PRÓXIMA SESIÓN  
**Duración Estimada**: 3-4 horas (Frontend)  
**Idioma**: Español  

---

## 📋 Especificación Ejecutiva

### Objetivo
Ampliar la experiencia de búsqueda de FASE 12/13 con:
1. **Advanced Filters Panel** — Multi-select avanzado (assignee, project, date range, severity, hasEvidence)
2. **Batch Actions Toolbar** — Acciones bulk sobre múltiples findings (cambiar status, asignar, eliminar)
3. **Filter Preview** — Chips removibles mostrando filtros activos
4. **Search History** — Últimas 10 búsquedas guardadas en IndexedDB

### Stack Confirmado
- **Frontend**: React 19, Next.js 16.3, Tailwind v4, Lucide icons, TypeScript strict
- **Backend API**: ✅ IMPLEMENTADO (FASE 14 backend)
  - `GET /api/search/findings?assignee=x,y&project=a,b&dateFrom=ISO&hasEvidence=true`
  - `GET /api/search/lookups?type=assignees|projects&projectId=xxx`
  - `POST /api/findings/bulk-update` con transacciones atómicas
- **Storage**: IndexedDB (SearchHistory, offline sync desde FASE 8)
- **Mobile-First**: Respeta diseño bottom-sheet de FASE 13

---

## 🏗️ Arquitectura Frontend

### Componentes Nuevos (4)

```
components/search/
├─ AdvancedFilterPanel.tsx        (250 líneas) — Modal/panel con multi-select
├─ BatchActionsToolbar.tsx        (200 líneas) — Toolbar sticky con bulk actions
├─ FilterPreview.tsx              (100 líneas) — Chips removibles
└─ SearchHistory.tsx              (150 líneas) — Dropdown histórico
```

### Hooks Nuevos/Actualizados (3)

```
lib/hooks/
├─ useSearch.ts                   (ACTUALIZADO) — Integración con nuevos filters
├─ useBatchActions.ts             (NUEVO) — Selection state + bulk operations
└─ useSearchHistory.ts            (NUEVO) — IndexedDB CRUD
```

### Types Nuevos

```
lib/types/
└─ search.ts                       (NUEVO) — FilterPreset, SearchHistoryEntry, BatchAction
```

### API Integración

**GET /api/search/findings**
```ts
// Query params from AdvancedFilterPanel
?q=bug
&status=OPEN,TRIAGED
&priority=HIGH,CRITICAL
&assignee=user1,user2                // NEW
&project=proj1,proj2                 // NEW
&severity=MAJOR,BLOCKER
&dateFrom=2026-08-01T00:00:00Z      // NEW
&dateTo=2026-08-31T23:59:59Z        // NEW
&hasEvidence=true                    // NEW
&limit=20
&offset=0

// Response includes new facets
{
  total: 42,
  items: [...],
  took_ms: 120,
  facets: {
    status: { OPEN: 15, TRIAGED: 8, ... },
    priority: { HIGH: 12, CRITICAL: 5, ... },
    assignee: [                       // NEW
      { id: 'user1', doc_count: 8 },
      { id: 'user2', doc_count: 6 },
    ],
    project: [                        // NEW
      { id: 'proj1', doc_count: 20 },
    ],
  }
}
```

**GET /api/search/lookups**
```ts
// Get assignees
GET /api/search/lookups?type=assignees&projectId=proj1
→ { assignees: [{ id, name, avatar }] }

// Get projects
GET /api/search/lookups?type=projects&userId=user1
→ { projects: [{ id, name }] }
```

**POST /api/findings/bulk-update**
```ts
{
  ids: ['id1', 'id2', 'id3'],
  updates: {
    status: 'VALIDATED',
    priority: 'MEDIUM',
    assigneeId: 'user2',
    dueDate: '2026-09-15T00:00:00Z'  // NEW
  }
}
→ { updated: 3, failed: 0, results: [...] }  // 207 Multi-Status si hay fallos
```

---

## 🎨 Diseño & Especificación Visual

### AdvancedFilterPanel

**Desktop** (≥768px):
```
┌─────────────────────────────────────┐
│  Filtros Avanzados              [X] │
├─────────────────────────────────────┤
│ Asignado a:  [Dropdown v]           │
│              [✓ John] [Jane] [Alex]  │
│                                      │
│ Proyecto:    [Dropdown v]           │
│              [✓ P1] [P2] [P3]        │
│                                      │
│ Severidad:   [Checkbox] COSMETIC    │
│              [✓] MINOR               │
│              [✓] MAJOR               │
│              [ ] BLOCKER             │
│                                      │
│ Fecha desde: [2026-08-01] 📅        │
│ Fecha hasta: [2026-08-31] 📅        │
│                                      │
│ Tiene evidencia:                    │
│              [✓] Sí  [ ] No  [ ] All │
├─────────────────────────────────────┤
│ [Limpiar Filtros]  [Aplicar]        │
└─────────────────────────────────────┘
```

**Mobile** (<768px):
- Mismo componente, pero en modal bottom-sheet fullscreen (85vh)
- Scroll interno si contenido > altura
- Botones "Limpiar" y "Aplicar" sticky en footer del modal

### BatchActionsToolbar

```
┌── 3 resultados seleccionados ──────────────────────────┐
│  [Status ▼]  [Assign ▼]  [Delete]  [Unselect All]    │
└────────────────────────────────────────────────────────┘

Submenus:
[Status ▼] → OPEN, TRIAGED, IN_PROGRESS, READY_FOR_VALIDATION, VALIDATED, CLOSED
[Assign ▼] → Dropdown con assignees
[Delete]   → Confirmation dialog
```

### FilterPreview

```
Status: OPEN [X]  Priority: HIGH [X]  Assignee: John [X]  
Project: P1 [X]  Date: Aug 1-31 [X]  Has Evidence [X]  
[Clear All]
```

### SearchHistory

```
Cuando focus en search input:
┌──────────────────────────┐
│ 📌 Recent Searches      │
├──────────────────────────┤
│ ✓ MAJOR findings (Aug 1) │
│ ✓ John's tasks (Aug 2)   │
│ ✓ Unvalidated (Aug 3)    │
│ ...                      │
└──────────────────────────┘
```

### Touch Targets & Accessibility

- Todos checkboxes: 44x44px (FASE 13 compliance)
- Todos botones: mínimo 44x44px
- Focus rings: `focus-visible:ring-2 ring-indigo-500`
- ARIA labels: `aria-label`, `aria-expanded`, `aria-controls`
- Keyboard nav: Tab → inputs → dropdowns → botones → cierra modal
- Condicional hover: `[@media(hover:hover)]:hover:*` (sin hover en touch)

---

## 🔄 Data Flow

### 1. User abre Advanced Filters

```
AdvancedFilterPanel monta
  ↓
useEffect → GET /api/search/lookups?type=assignees
         → GET /api/search/lookups?type=projects
  ↓
Renderiza dropdowns con datos
  ↓
User selecciona filtros
  ↓
User hace click "Aplicar"
  ↓
Actualiza useSearch state → query params
  ↓
GET /api/search/findings?assignee=x,y&project=a&...
  ↓
SearchFindings re-renderiza con nuevos resultados + facets
```

### 2. User selecciona findings para bulk actions

```
SearchResultItem renderiza checkbox (44x44px)
  ↓
User hace click checkbox (o Cmd+A para select all)
  ↓
useBatchActions actualiza selectedIds
  ↓
BatchActionsToolbar aparece si selectedIds.length > 0
  ↓
User hace click "Status" → dropdown
  ↓
User selecciona nuevo status
  ↓
POST /api/findings/bulk-update { ids, updates: { status } }
  ↓
Optimistic update en UI (selectedIds actualiza)
  ↓
Respuesta llega → actualiza resultados
```

### 3. User guarda búsqueda en historial

```
User hace búsqueda (GET /api/search/findings ejecuta)
  ↓
useSearchHistory.save() → IndexedDB
  ↓
Guardar: { id, text, status[], priority[], assignee, project, dateRange, timestamp }
  ↓
Max 10 items (FIFO, borrar oldest)
  ↓
Next time: focus en input → dropdown muestra últimas 10
  ↓
User click item histórico → restaura criterios completos
```

---

## 📊 Métricas de Éxito

| KPI | Target | Verificación |
|-----|--------|--------------|
| Build time | <50s | `npm run build` |
| Type errors | 0 | `npx tsc --noEmit` |
| Components | 4 nuevos | AdvancedFilterPanel, BatchActionsToolbar, FilterPreview, SearchHistory |
| Hooks | 1-2 nuevos | useBatchActions, useSearchHistory |
| Touch targets | 44x44px | DevTools Accessibility panel |
| Mobile bottom-sheet | 85vh fullscreen | DevTools emulation <768px |
| Batch latency | <500ms | Network throttling test |
| Search history | Max 10 items | IndexedDB quota |
| Lighthouse mobile | ≥90 | PageSpeed Insights |
| Type coverage | 100% TypeScript | No `any` types |
| Breaking changes | 0 | FASE 12/13 backward compatible |

---

## 🧪 Testing Strategy

### Unit Tests (Recomendado)
```bash
# useBatchActions hook
✓ toggleSelect(id) actualiza selectedIds
✓ selectAll() selecciona todos los IDs
✓ clearSelection() limpia state
✓ getSelected() retorna array correctamente

# useSearchHistory hook
✓ save() guarda en IndexedDB
✓ max 10 items (FIFO)
✓ restore(historyId) retorna criterios completos
✓ delete(historyId) remueve item

# AdvancedFilterPanel
✓ Renderiza dropdowns correctamente
✓ Valores se sincronizan con props
✓ Click "Aplicar" llama onApply(filters)
✓ Click "Limpiar" resetea todos los campos
```

### Integration Tests (DevTools)

**Mobile (<768px)**
- [ ] AdvancedFilterPanel en modal bottom-sheet
- [ ] Scroll funciona si contenido > 85vh
- [ ] Keyboard: Tab → inputs → botones → cierra modal (Escape)
- [ ] 44x44px touch targets en checkboxes
- [ ] Hover desaparece (prefers-hover: none)

**Desktop (≥768px)**
- [ ] AdvancedFilterPanel como side panel/modal centrado
- [ ] Dropdown hover states visibles
- [ ] Click-outside cierra modal
- [ ] Keyboard nav: Tab fluido

**Batch Actions**
- [ ] Checkbox aparece en cada SearchResultItem
- [ ] BatchActionsToolbar aparece cuando selectedIds.length > 0
- [ ] Cmd/Ctrl+A selecciona todos en página actual
- [ ] Status dropdown muestra todos los estados
- [ ] POST /api/findings/bulk-update ejecuta con IDs correctos
- [ ] Optimistic update: UI actualiza antes de respuesta

**Search History**
- [ ] Focus en input → dropdown histórico
- [ ] Max 10 items guardados en IndexedDB
- [ ] Click item → restaura criterios completos
- [ ] Timestamp mostrado ("Aug 3 2pm")

**Regression (FASE 12/13)**
- [ ] SearchFindings sigue funcionando sin Advanced Filters
- [ ] Bottom-sheet mobile de FASE 13 intacta
- [ ] Debounce 500ms mobile, 300ms desktop aún funciona
- [ ] Facets básicas (status, priority, severity) siguen apareciendo

---

## 🚀 Implementación Step-by-Step

### Paso 1: Types & Interfaces (30 min)
Crear `lib/types/search.ts`:
```ts
export interface AdvancedFilters {
  assignee?: string[]
  project?: string[]
  severity?: string[]
  dateFrom?: Date
  dateTo?: Date
  hasEvidence?: boolean
}

export interface SearchHistoryEntry {
  id: string
  text: string
  filters: AdvancedFilters
  timestamp: Date
}

export interface BatchActionUpdate {
  status?: string
  priority?: string
  assigneeId?: string | null
  dueDate?: Date | null
}
```

### Paso 2: Hooks (1 hora)
Crear `lib/hooks/useBatchActions.ts`:
```ts
export function useBatchActions() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  return {
    selectedIds,
    toggleSelect: (id: string) => { /* */ },
    selectAll: (ids: string[]) => { /* */ },
    clearSelection: () => { /* */ },
    performAction: async (action: BatchActionUpdate) => { /* */ },
  }
}
```

Crear `lib/hooks/useSearchHistory.ts`:
```ts
export function useSearchHistory() {
  return {
    save: (entry: SearchHistoryEntry) => { /* IndexedDB */ },
    getRecent: () => { /* */ },
    restore: (entryId: string) => { /* */ },
    delete: (entryId: string) => { /* */ },
  }
}
```

### Paso 3: Components (2 horas)

**AdvancedFilterPanel.tsx** (250 líneas)
- Multi-select dropdowns (React.useState)
- Date pickers (shadcn/ui o custom)
- Checkboxes para severity, hasEvidence
- Botones Limpiar/Aplicar
- Mobile modal vs desktop panel

**BatchActionsToolbar.tsx** (200 líneas)
- Sticky positioning (bottom en mobile, top en desktop)
- Contador de seleccionados
- Dropdown menus para acciones
- Confirmation dialogs

**FilterPreview.tsx** (100 líneas)
- Map sobre filtros activos
- Chips con close button [X]
- "Clear All" button

**SearchHistory.tsx** (150 líneas)
- Dropdown al enfocar input
- Renderizar items históricos
- Click → restaura criterios

### Paso 4: Integración (1 hora)

Actualizar `SearchFindings.tsx`:
```tsx
// Agregar:
const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
const { selectedIds, toggleSelect, clearSelection } = useBatchActions()
const { recent: searchHistory } = useSearchHistory()

// Renderizar:
<AdvancedFilterPanel open={showAdvancedFilters} onClose onApply />
<BatchActionsToolbar selectedIds={selectedIds} onAction={handleBulkUpdate} />
<FilterPreview filters={query} />
<SearchHistory recent={searchHistory} />

// SearchResultItem: agregar checkbox
```

### Paso 5: Testing & Polish (1 hora)

- DevTools mobile emulation
- Type checking: `npx tsc --noEmit`
- Lighthouse audit
- Real device testing (opcional)

---

## 📝 Archivos a Crear/Modificar

### Nuevos Archivos (7)
```
lib/types/search.ts
lib/hooks/useBatchActions.ts
lib/hooks/useSearchHistory.ts
components/search/AdvancedFilterPanel.tsx
components/search/BatchActionsToolbar.tsx
components/search/FilterPreview.tsx
components/search/SearchHistory.tsx
```

### Modificados (2)
```
components/search/SearchFindings.tsx        (integrar nuevos componentes)
components/search/SearchResultItem.tsx      (agregar checkbox)
```

---

## 🔗 Referencias Backend (Ya Completado ✅)

- `lib/validators/search-query.ts` — Query schema con nuevos params
- `lib/services/search-service.ts` — Aggregations para assignee/project
- `lib/services/lookup-service.ts` — getAssignees(), getProjects()
- `app/api/search/findings/route.ts` — GET endpoint actualizado
- `app/api/search/lookups/route.ts` — Lookup API
- `app/api/findings/bulk-update/route.ts` — Transacciones atómicas

---

## 🎓 Skill Recomendado

**`/frontend-developer`** ⭐ RECOMENDADO

Este prompt está diseñado para ser usado con:
```bash
/frontend-developer
```

El skill frontend-developer tiene herramientas para:
- React component architecture
- State management (hooks)
- Form handling (multi-select, date pickers)
- Mobile responsiveness
- Accessibility (ARIA, keyboard nav)
- Testing (Vitest + Testing Library)

---

## 📅 Próxima Sesión

**Entradilla**:
```
Necesito implementar FASE 14 frontend (Advanced Filters & Batch Actions).

Datos importantes:
- Backend COMPLETADO: /api/search/findings, /api/search/lookups, /api/findings/bulk-update
- Stack: React 19, Next.js 16.3, Tailwind v4, TypeScript strict
- Mobile-first: respeta bottom-sheet de FASE 13
- 4 componentes nuevos, 2 hooks nuevos
- Testing: DevTools emulation + real device checklist

Archivos clave:
- SearchFindings.tsx (integración)
- SearchResultItem.tsx (checkbox)
- AdvancedFilterPanel.tsx (nuevo)
- BatchActionsToolbar.tsx (nuevo)
- FilterPreview.tsx (nuevo)
- SearchHistory.tsx (nuevo)

Duración: 3-4 horas
```

---

## 💾 Build & Deploy

```bash
# Verificar que compila
npm run build

# Type check
npx tsc --noEmit

# Tests
npm run test

# Commit
git add .
git commit -m "feat(search): implement FASE 14 — Advanced Filters & Batch Actions"

# Push
git push origin master
```

---

**Status**: ✅ Backend completado | 🚀 Frontend ready to start  
**Próxima Sesión**: `/frontend-developer` para FASE 14 frontend  
**Documentación**: FASE14_ROADMAP.md, FASE14_MASTER_PROMPT.md (este archivo)
