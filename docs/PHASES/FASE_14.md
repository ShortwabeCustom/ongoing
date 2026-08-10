# FASE 14 — Advanced Filters & Batch Actions

**Status**: Backend ✅ | Frontend 📋 | **Fecha**: 2026-08-10

---

## 🎯 Resumen

Implementar filtros avanzados (multi-select, date range, evidence check) y acciones batch en findings:

### Backend ✅ (Completado)
- SearchQuerySchema expandido (assignee[], project[], dateRange, hasEvidence)
- Elasticsearch aggregations (facets para assignee, project)
- Lookup API (`/api/search/lookups`)
- Bulk-update con transacciones Prisma
- evidenceCount en Elasticsearch

### Frontend 📋 (Próxima Sesión)
- 4 componentes React (AdvancedFilterPanel, BatchActionsToolbar, FilterPreview, SearchHistory)
- 3 hooks (useBatchActions, useSearchHistory, useSavedFilters)
- Integración en SearchFindings + SearchResultItem
- **Duración**: ~10 horas

---

## 🔧 Backend Completado

### Archivos Nuevos (3)

#### `lib/services/lookup-service.ts`
```ts
class LookupService {
  static async getAssignees(projectId?: string): Promise<AssigneeOption[]>
  static async getProjects(userId?: string): Promise<ProjectOption[]>
  static async getAssigneesByIds(userIds: string[]): Promise<Map<string, string>>
  static async getProjectsByIds(projectIds: string[]): Promise<Map<string, string>>
}
```

#### `app/api/search/lookups/route.ts`
```
GET /api/search/lookups?type=assignees|projects
→ { assignees?: [...], projects?: [...] }
```

### Archivos Modificados (6)

#### `lib/validators/search-query.ts`
```ts
// Nuevos parámetros
assignee[]    // Array multi-select
project[]     // Array multi-select
dateFrom      // ISO datetime
dateTo        // ISO datetime
hasEvidence   // boolean

// Backward compatible
assigneeId → assignee[0]
projectId → project[0]
```

#### `lib/services/search-service.ts`
```ts
// Nuevas facetas
facets: {
  assignee: [{ id: string, doc_count: number }]
  project: [{ id: string, doc_count: number }]
}

// Nuevos filtros
if (query.assignee?.length) → terms query
if (query.hasEvidence) → exists query
if (query.dateFrom/dateTo) → range query
```

#### `lib/elasticsearch/findings-index.ts`
```ts
evidenceCount: { type: 'integer' }
```

#### `app/api/findings/bulk-update/route.ts`
```ts
// Nuevos campos en updates
dueDate: string (ISO datetime)

// Transacción atómica
$transaction(async tx => { ... })

// Response 207 Multi-Status si partial success
```

#### `lib/services/finding-service.ts` + `import-service.ts`
```ts
evidenceCount: finding.evidence?.length || 0
```

---

## 🔌 API Contracts

### GET /api/search/findings

**Query Params** (nuevos):
```
assignee=id1,id2              // Multi-select
project=proj1,proj2           // Multi-select
dateFrom=2026-08-01T00:00Z   // ISO datetime
dateTo=2026-08-31T23:59Z     // ISO datetime
hasEvidence=true|false        // Boolean
severity=COSMETIC,MINOR       // Existing
```

**Response** (nuevas facetas):
```json
{
  "total": 42,
  "items": [...],
  "facets": {
    "assignee": [{"id": "user1", "doc_count": 8}],
    "project": [{"id": "proj1", "doc_count": 20}]
  }
}
```

### GET /api/search/lookups

```
?type=assignees&projectId=xxx
→ { assignees: [{id, name, avatar}] }

?type=projects&userId=yyy
→ { projects: [{id, name}] }
```

### POST /api/findings/bulk-update

**Request**:
```json
{
  "ids": ["id1", "id2"],
  "updates": {
    "status": "VALIDATED",
    "assigneeId": "user2",
    "dueDate": "2026-09-15T00:00:00Z"
  }
}
```

**Response** (200 o 207):
```json
{
  "updated": 2,
  "failed": 0,
  "results": [...]
}
```

---

## ⚠️ Bloqueantes (Fix Primero)

### 1️⃣ RBAC en bulk-update (15 min)
**Archivo**: `app/api/findings/bulk-update/route.ts`  
**Problema**: Sin `checkRBAC()` — cualquier usuario puede modificar  
**Fix**: Agregar validación RBAC antes de updateMany

### 2️⃣ hasEvidence no synced (10 min)
**Archivo**: Elasticsearch index  
**Problema**: Campo nuevo, índices antiguos no tienen el valor  
**Fix**: Regenerar índice o agregar default en queries

---

## 📋 Frontend Spec (Próxima Sesión)

### 4 Componentes Nuevos

#### 1. `components/search/AdvancedFilterPanel.tsx`
```tsx
interface AdvancedFilterPanelProps {
  onApply: (filters: AdvancedFilters) => void
  defaultFilters?: AdvancedFilters
}

// Estados
- Multi-select dropdowns (assignee, project) → /api/search/lookups
- Date pickers (from/to)
- Checkboxes (severity, hasEvidence)
- Reset button
- Apply button
```

#### 2. `components/search/BatchActionsToolbar.tsx`
```tsx
interface BatchActionsToolbarProps {
  selectedCount: number
  onActionChange: (action: BatchAction) => void
  onExecute: () => void
}

// Acciones
- Status change (dropdown)
- Assign to (user dropdown)
- Set due date
- Add to project
- Export selected
- Delete selected
```

#### 3. `components/search/FilterPreview.tsx`
```tsx
// Renderizar facetas activas
- Assignee: ["Alice", "Bob"] + count
- Project: ["Backend", "Frontend"] + count
- Date range: "Aug 1 - Aug 31"
- Evidence: "Has evidence only"
- Click X → remove filtro
```

#### 4. `components/search/SearchHistory.tsx`
```tsx
// IndexedDB CRUD
- Guardar búsquedas frecuentes
- Listar últimas 10 búsquedas
- Restaurar criterios completos
- Delete historia
```

### 3 Hooks Nuevos

#### `lib/hooks/useBatchActions.ts`
```ts
interface UseBatchActionsReturn {
  selected: Set<string>
  toggleSelect: (id: string) => void
  selectAll: () => void
  deselectAll: () => void
  executeAction: (action: BatchAction) => Promise<BulkUpdateResult>
}

function useBatchActions()
```

#### `lib/hooks/useSearchHistory.ts`
```ts
function useSearchHistory()
// Leer/guardar en IndexedDB
// Retornar historial + métodos
```

#### `lib/hooks/useSavedFilters.ts`
```ts
function useSavedFilters()
// Guardar filtros frecuentes
// Aplicar rápidamente
```

### Tipos Nuevos

**`lib/types/search.ts`**:
```ts
interface AdvancedFilters {
  assignee?: string[]
  project?: string[]
  dateFrom?: string
  dateTo?: string
  hasEvidence?: boolean
  severity?: string[]
}

interface BatchAction {
  type: 'status' | 'assign' | 'dueDate' | 'project' | 'export' | 'delete'
  value?: string | boolean
}

interface FilterFacet {
  id: string
  doc_count: number
}
```

### Cambios en Componentes Existentes

#### `components/search/SearchFindings.tsx`
- Agregar AdvancedFilterPanel (toggle button)
- Pasar nuevos parámetros a /api/search/findings
- Renderizar FilterPreview
- Integrar SearchHistory dropdown

#### `components/search/SearchResultItem.tsx`
- Agregar checkbox para batch selection
- Callback `onSelectChange`
- Responsive (touch-friendly en mobile)

---

## 📊 Validaciones

### Seguridad
- [ ] RBAC en bulk-update
- [ ] hasEvidence synced en Elasticsearch
- [ ] Date range: dateFrom ≤ dateTo
- [ ] Max 100 IDs per bulk request

### Performance
- [ ] Lookup API cache (1 min)
- [ ] Bulk-update batch size (100 max)
- [ ] Elasticsearch aggregations paginadas (size: 50)
- [ ] SearchHistory limitado a 50 items en IndexedDB

### Accesibilidad
- [ ] Keyboard navigation: Tab, Enter, Escape
- [ ] ARIA labels en checkboxes/dropdowns
- [ ] Focus rings visibles
- [ ] Screen reader announcements (selection count)

---

## 🚀 Próxima Sesión

**Skill Recomendada**: `/frontend-developer`

**Bloqueantes primero** (25 min):
1. Fix RBAC en bulk-update
2. Fix hasEvidence en Elasticsearch

**Después** (10h):
1. Crear tipos en `lib/types/search.ts`
2. Crear 3 hooks
3. Crear 4 componentes
4. Integrar en SearchFindings + SearchResultItem
5. Testing completo

**Master Prompt**: `FASE14_MASTER_PROMPT.md` + `FASE14_FRONTEND_SPEC.md`

---

## 📈 Métricas

| Métrica | Target |
|---------|--------|
| Componentes nuevos | 4 |
| Hooks nuevos | 3 |
| Archivos a modificar | 2 |
| Duración estimada | 10h |
| Build status | ✅ (backend only) |

---

**Status**: Backend ✅ READY | Frontend 📋 NEXT
