# FASE 14 — Advanced Filters & Batch Actions — Especificación Frontend Definitiva

Esta es la versión corregida del `FASE14_MASTER_PROMPT.md` existente, basada en lectura directa del código real. No se ejecutó ninguna escritura de código — es especificación pura.

---

## ⚠️ HALLAZGO CRÍTICO DE SEGURIDAD IDENTIFICADO

**`app/api/findings/bulk-update/route.ts` NO tiene `checkRBAC()`** — es la única ruta de findings sin control de acceso. **Cualquiera sin sesión puede modificar findings en lote hoy.** Además usa `updatedBy: 'system'` hardcodeado en vez del usuario real. Esto está documentado como Paso 1 (15 min) en §7, pero necesita corrección inmediata como bloqueante de seguridad, independientemente de si se implementa el resto de FASE 14.

---

## 1. Especificación ejecutiva

### Objetivo
Añadir a la búsqueda de FASE 12/13: (a) filtros avanzados multi-select (asignado, proyecto, severidad, rango de fechas, tiene-evidencia), (b) selección múltiple de resultados con acciones en lote (status, prioridad, asignar, exportar CSV), (c) chips de filtros activos removibles, (d) historial de búsquedas recientes + combinaciones de filtros guardadas con nombre.

### Alcance — SÍ incluye
- 4 componentes nuevos en `components/search/`: `AdvancedFilterPanel`, `BatchActionsToolbar`, `FilterPreview`, `SearchHistory` (este último cubre **dos** features: historial reciente automático y "saved filters" con nombre).
- 3 hooks nuevos/actualizados en `lib/hooks/`: `useBatchActions` (nuevo), `useSearchHistory` (nuevo), `useSavedFilters` (nuevo). Más un diff obligatorio sobre `lib/hooks/useSearch.ts` (existente).
- 1 archivo de constantes nuevo: `lib/constants/finding-options.ts` (fuente única de verdad para los 8 status / 4 priority / 4 severity).
- 1 archivo de tipos nuevo: `lib/types/search.ts`.
- 1 helper IndexedDB nuevo: `lib/indexeddb/search-db.ts` (base de datos **independiente** de `useIndexedDB.ts`).
- Fix de seguridad obligatorio (backend, bloqueante): RBAC en `app/api/findings/bulk-update/route.ts` + reemplazo de `updatedBy: 'system'`.
- Fix funcional recomendado (backend, no bloqueante): bug en el filtro `hasEvidence` de `lib/services/search-service.ts`.
- Edición de `components/search/SearchFindings.tsx` y `components/search/SearchResultItem.tsx`.

### Alcance — NO incluye (explícitamente fuera de esta fase)
- **Bulk delete**: el usuario no lo pidió. Si se requiere en el futuro, es un endpoint nuevo (`POST /api/findings/bulk-delete`), no forma parte de FASE 14.
- **Paridad completa de filtros en modo fallback** (cuando Elasticsearch está caído): se degrada con gracia.
- **Endpoint de exportación server-side**: se resuelve 100% client-side con `papaparse` sobre los items ya cargados.
- Tests automatizados como archivos — la spec define los casos pero no los escribe.

---

## 2. Data flow de usuario

### 2.1 Aplicar filtros avanzados

```
Usuario hace click en botón "Filtros avanzados" (desktop: junto a chips
rápidos de Status/Priority | mobile: fila dentro del bottom-sheet existente)
  │
  ├─ AdvancedFilterPanel monta
  │     └─ useLookups() dispara en paralelo:
  │          GET /api/search/lookups?type=assignees
  │          GET /api/search/lookups?type=projects
  │
  ├─ Panel se abre con estado DRAFT clonado del estado COMMITTED actual
  │
  ├─ Usuario marca checkboxes y selecciona filtros
  │     └─ Todo esto solo muta el estado local `draft`, NO dispara fetch
  │
  ├─ Usuario pulsa "Aplicar"
  │     └─ AdvancedFilterPanel normaliza fechas: 'YYYY-MM-DD' → ISO
  │     └─ onApply(draft) → SearchFindings.setFilters()
  │     └─ Panel se cierra
  │
  ├─ useSearch detecta cambio → useDebouncedValue (500ms mobile / 300ms desktop)
  │
  ├─ buildParams() serializa TODOS los campos incl. los nuevos:
  │   assignee=id1,id2 & project=id1 & dateFrom=ISO & dateTo=ISO & hasEvidence=true
  │
  ├─ GET /api/search/findings?...  (o fallback a /api/findings si ES falla)
  │
  └─ SearchFindings re-renderiza: resultados + facets (incl. assignee[]/project[] nuevos)
```

Si `isFallback === true` Y el usuario tiene filtros avanzados, muestra aviso: *"Modo sin Elasticsearch: los filtros de Asignado múltiple, Proyecto múltiple y 'Tiene evidencia' no están disponibles."*

### 2.2 Selección de resultados + acción en lote

```
Precondición: useAuth().user.role ∈ ['OWNER','QA_LEAD']
  → si no, SearchResultItem NO renderiza checkbox

SearchResultItem renderiza checkbox 44×44px
  │
  ├─ Usuario hace click en checkbox
  │     └─ onToggleSelect(id) → useBatchActions.toggleSelect(id)
  │
  ├─ selectedIds.length > 0
  │     └─ BatchActionsToolbar monta (sticky arriba en desktop, abajo en mobile)
  │
  ├─ Usuario abre dropdown "Estado" → selecciona nuevo valor
  │     └─ useBatchActions.bulkUpdateStatus('VALIDATED')
  │     └─ POST /api/findings/bulk-update { ids, updates: { status: 'VALIDATED' } }
  │
  ├─ Respuesta 200 (todo ok) → toast "N actualizados" → clearSelection() → refetch()
  │ 
  ├─ Respuesta 207 (parcial) → banner "X actualizados, Y fallaron"
  │                          → solo quedan seleccionados los fallidos
  │
  └─ Respuesta 401/403 → banner "No tienes permiso" → selección intacta
```

Exportar CSV es 100% client-side: toma `data.items` de `selectedIds`, usa `Papa.unparse()`, descarga.

### 2.3 Guardar/restaurar historial y saved filters

```
Historial automático (useSearchHistory):
Usuario ejecuta búsqueda real (q.length >= 2 O al menos 1 filtro activo)
  │
  ├─ Trigger de guardado: al cerrar la búsqueda
  │   (blur / Escape / click-resultado)
  │     └─ useSearchHistory.addEntry({ q, filters, resultCount })
  │     └─ IndexedDB store 'search_history', cap FIFO 10
  │
  └─ Próxima apertura del input (onFocus con searchTerm === '')
      → SearchHistory (tab "Recientes") lista los 10 ordenados desc

Saved filters (manual, useSavedFilters):
Usuario configura filtros y pulsa ⭐ "Guardar esta búsqueda"
  │
  ├─ Mini form inline: input "Nombre del filtro" + botón "Guardar"
  │     └─ useSavedFilters.saveFilter(name, filters, q)
  │     └─ IndexedDB store 'saved_filters', cap defensivo 20
  │
  └─ SearchHistory (tab "Guardados") lista los guardados
      → nombre, botones "Aplicar"/"Renombrar"/"Eliminar"
```

**Diferencia:** Historial es automático, sin nombre, efímero (FIFO 10). Saved Filters es manual, con nombre, persistente (cap 20). Son dos stores en la misma DB nueva (`pruebas-maria-search`).

---

## 3. Componentes nuevos

Todos siguen: `hidden md:block` + `md:hidden`, Tailwind directo (sin `components/ui/button.tsx`), iconos Lucide, `focus-visible:ring-2 focus-visible:ring-indigo-500`, `min-h-[44px] min-w-[44px]` en todo interactivo, `[@media(hover:hover)]:hover:*`.

### 3.1 `AdvancedFilterPanel`

**Ubicación:** `components/search/AdvancedFilterPanel.tsx`

**Desktop:** dropdown flotante `absolute top-full right-0 mt-2 w-96`, NO modal centrado.

**Mobile:** bottom-sheet propio `fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] z-[60]`, con acordeones para cada filtro, header/footer sticky.

**Mockup desktop:**
```
┌──────────────────────────────────────┐
│  Filtros avanzados              [X]  │
├──────────────────────────────────────┤
│ Asignado a            🔍 buscar...   │
│  [ ] John Pérez            (8)       │
│  [x] Jane García           (6)       │
│                                       │
│ Proyecto                             │
│  [x] App Móvil             (20)      │
│                                       │
│ Severidad (checkboxes 2×2)           │
│ Rango de fechas ([date] a [date])   │
│ Evidencia (radio: Cualquiera/Con/Sin)│
├──────────────────────────────────────┤
│ [⭐ Guardar]  [Limpiar]  [Aplicar]   │
└──────────────────────────────────────┘
```

**Props:**
```ts
export interface AdvancedFilterPanelProps {
  open: boolean
  onClose: () => void
  value: AdvancedFilterValues
  onApply: (values: AdvancedFilterValues) => void
  onSaveAsNamedFilter: (name: string, values: AdvancedFilterValues) => Promise<void>
  assigneeOptions: LookupOption[]
  projectOptions: LookupOption[]
  lookupsLoading: boolean
  lookupsError: string | null
  disableExtendedFilters: boolean      // true cuando isFallback === true
  activeCount: number
}
```

**Lógica:**
- Estado local `draft` inicializado en cada apertura (no pierde cambios si `value` cambia externamente).
- "Limpiar" resetea y llama `onApply` inmediatamente.
- "Aplicar" normaliza fechas y cierra.
- Filtro de texto sobre assignees/projects es 100% client-side.
- `disableExtendedFilters`: secciones multi-select con `opacity-50 pointer-events-none` + texto "No disponible sin Elasticsearch".

**A11y:** `<fieldset>`+`<legend>` para agrupación, `<input type="date">` nativo, `role="dialog"` en mobile, foco inicial en primer checkbox.

### 3.2 `BatchActionsToolbar`

**Ubicación:** `components/search/BatchActionsToolbar.tsx`

Solo se renderiza si `user.role` ∈ `['OWNER','QA_LEAD']` (envuelto en `<PermissionGuard>`).

**Desktop:** `sticky top-0 z-30` dentro del contenedor scrollable.

**Mobile:** `sticky bottom-0 z-10` justo arriba del footer Limpiar/Aplicar del bottom-sheet.

**Mockup desktop:**
```
┌──────────────────────────────────────────────────────────────┐
│ 3 seleccionados   [Estado ▾] [Prioridad ▾] [Asignar ▾]        │
│                   [⬇ Exportar CSV]         [Cancelar]         │
└──────────────────────────────────────────────────────────────┘
```

**Props:**
```ts
export interface BatchActionsToolbarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkStatus: (status: string) => void
  onBulkPriority: (priority: string) => void
  onBulkAssign: (assigneeId: string | null) => void
  onExportCsv: () => void
  assigneeOptions: LookupOption[]
  isProcessing: boolean
  error: string | null
  maxBatchSize: number
}
```

**Lógica:**
- Dropdowns son `<select>` nativos estilizados (no custom listbox).
- El cambio de valor dispara la acción inmediatamente (no hay botón "Aplicar" adicional).
- "Asignar" incluye opción `<option value="">Sin asignar</option>` → `null`.
- Si `selectedCount > maxBatchSize`: dropdowns deshabilitados, mensaje inline.
- Sin modal de confirmación (status/priority/assign son reversibles).

**A11y:** `role="toolbar"`, `aria-live="polite"` para contador, `<label className="sr-only">` en cada `<select>`.

### 3.3 `FilterPreview`

**Ubicación:** `components/search/FilterPreview.tsx`

Se renderiza siempre que `activeFilterCount > 0`. Posición: inmediatamente debajo del input de búsqueda, **visible incluso con dropdown/bottom-sheet cerrado** — barra de contexto persistente.

**Mockup desktop:** `flex flex-wrap gap-2`
```
Estado: OPEN [×]  Estado: TRIAGED [×]  Prioridad: HIGH [×]
Asignado: Jane García [×]  Fecha: 1–31 ago [×]  Con evidencia [×]
[Limpiar todo]
```

**Mockup mobile:** `flex overflow-x-auto gap-2` (scroll horizontal)
```
[ Estado: OPEN × ] [ Prioridad: HIGH × ] [ +2 más ▸ ]   [Limpiar todo]
```

**Props:** callbacks granulares (onRemoveStatus, onRemovePriority, etc.) en vez de genérico.

**Lógica:** cada valor genera **un chip por valor** (no agregado). `dateFrom`/`dateTo` colapsan en chip "Fecha: {d/MMM}–{d/MMM}".

**A11y:** cada chip es `<button>` con `aria-label`, `min-h-[24px]` (inline elements), "Limpiar todo" es `min-h-[44px]` (acción primaria).

### 3.4 `SearchHistory` (cubre historial reciente + saved filters)

**Ubicación:** `components/search/SearchHistory.tsx`

**Dos tabs internos:** "Recientes" (automático) y "Guardados" (manual).

Se abre con `onFocus` del input cuando `searchTerm === ''` (si hay texto, muestra resultados de búsqueda, no historial).

**Mockup desktop** (dentro del dropdown `absolute top-full`):
```
┌──────────────────────────────────────┐
│ [Recientes]  [Guardados]             │
├──────────────────────────────────────┤
│ 🕐 MAJOR findings          hace 2h [×]│
│ 🕐 Jane's tasks             ayer  [×]│
├──────────────────────────────────────┤
│ [Borrar historial]                   │
└──────────────────────────────────────┘
```

**Tab "Guardados":**
```
⭐ Bugs críticos abiertos        [✎][×]
⭐ Pendientes de Jane            [✎][×]
```

**A11y:** WAI-ARIA Tabs pattern (`role="tablist"`, `role="tab"`, navegación con flechas), cada item es `<button>` completo con botones secundarios anidados + `stopPropagation`, rename inline (`<input>` con autoFocus, Enter confirma, Escape cancela).

---

## 4. Hooks nuevos

### 4.1 `useBatchActions` — `lib/hooks/useBatchActions.ts`

```ts
'use client'

export interface BulkUpdateApiResult {
  updated: number
  failed: number
  results: Array<{ id: string; status?; priority?; severity?; assigneeId?; version?; error? }>
}

export function useBatchActions(options = {}): {
  selectedIds: string[]
  isSelected: (id: string) => boolean
  toggleSelect: (id: string) => void
  selectMany: (ids: string[]) => void
  clearSelection: () => void
  bulkUpdateStatus: (status: string) => Promise<void>
  bulkUpdatePriority: (priority: string) => Promise<void>
  bulkAssign: (assigneeId: string | null) => Promise<void>
  isProcessing: boolean
  error: string | null
  lastResult: BulkUpdateApiResult | null
}
```

**Lógica:**
- `toggleSelect(id)`: añade/quita del array.
- `clearSelection()`: vacía array + resetea `error`/`lastResult`.
- `performUpdate(updates)`: guard si `selectedIds.length > maxBatchSize` (100), hace `POST /api/findings/bulk-update`.
- Respuesta 207: deja solo los ids con `error: true` seleccionados (para reintento).
- Respuesta 401/403: mantiene `selectedIds` intacto, setea error con mensaje permiso.
- **Sin optimistic update** (decisión: respuesta 207 requeriría rollback complejo; se espera respuesta real <500ms).

### 4.2 `useSearchHistory` — `lib/hooks/useSearchHistory.ts`

```ts
export interface SearchHistoryEntry {
  id: string
  q: string
  status: string[]
  priority: string[]
  filters: AdvancedFilterValues
  timestamp: number
  resultCount?: number
}

export function useSearchHistory(): {
  recent: SearchHistoryEntry[]
  isReady: boolean
  addEntry: (entry) => Promise<void>
  removeEntry: (id: string) => Promise<void>
  clearAll: () => Promise<void>
}
```

**Lógica:**
- `addEntry()`: genera UUID + timestamp, abre IndexedDB, pone en store, FIFO evict si > 10.
- `removeEntry(id)`: borra por id.
- `clearAll()`: vacía store.
- Load en `useEffect`, estado `isReady` para saber si está listo.

### 4.3 `useSavedFilters` — `lib/hooks/useSavedFilters.ts`

Misma forma que `useSearchHistory` pero:
- Store: `'saved_filters'` en vez de `'search_history'`.
- Cap: 20 en vez de 10 (no FIFO agresivo, evict por `createdAt` más antiguo).
- Métodos adicionales: `renameFilter(id, newName)`, `deleteFilter(id)`.

```ts
export interface SavedFilterEntry {
  id: string
  name: string
  q?: string
  status: string[]
  priority: string[]
  filters: AdvancedFilterValues
  createdAt: number
  updatedAt: number
}
```

### 4.4 Helper compartido — `lib/indexeddb/search-db.ts`

```ts
const SEARCH_DB_NAME = 'pruebas-maria-search'
const SEARCH_DB_VERSION = 1

export function openSearchDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SEARCH_DB_NAME, SEARCH_DB_VERSION)

    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('search_history')) {
        const store = db.createObjectStore('search_history', { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
      if (!db.objectStoreNames.contains('saved_filters')) {
        const store = db.createObjectStore('saved_filters', { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
```

**Decisión explícita:** DB **independiente** (`pruebas-maria-search`, no `pruebas-maria-offline`). Razones: (1) `pruebas-maria-offline` es crítico de FASE 8 (offline sync); tocarla introduce riesgo de regresión. (2) Ciclos de vida distintos: historial es descartable, sync es crítico. (3) Costo marginal de segunda conexión IndexedDB.

### 4.5 Diff obligatorio sobre `lib/hooks/useSearch.ts`

**`UseSearchResult['data']` — items y facets ampliados:**
```ts
data: {
  total: number
  items: Array<{
    id: string
    observation: string
    highlightedObservation?: string
    status: string
    priority: string
    severity: string
    projectId: string
    assigneeId?: string     // NUEVO
    createdAt?: string      // NUEVO
  }>
  facets?: {
    status?: Record<string, number>
    priority?: Record<string, number>
    severity?: Record<string, number>
    assignee?: Array<{ id: string; doc_count: number }>  // NUEVO
    project?: Array<{ id: string; doc_count: number }>   // NUEVO
  }
} | null
```

**`buildParams()` — serializar los 5 campos faltantes:**
```ts
if (q.assignee?.length) params.append('assignee', q.assignee.join(','))
if (q.project?.length) params.append('project', q.project.join(','))
if (q.dateFrom) params.append('dateFrom', q.dateFrom)
if (q.dateTo) params.append('dateTo', q.dateTo)
if (q.hasEvidence !== undefined) params.append('hasEvidence', String(q.hasEvidence))
```

**Guard clause — ampliar a nuevos campos:**
```ts
const hasFilters = Boolean(
  debouncedQuery.status?.length ||
  debouncedQuery.priority?.length ||
  debouncedQuery.severity?.length ||
  debouncedQuery.assignee?.length ||      // NUEVO
  debouncedQuery.project?.length ||       // NUEVO
  debouncedQuery.dateFrom ||              // NUEVO
  debouncedQuery.dateTo ||                // NUEVO
  debouncedQuery.hasEvidence !== undefined // NUEVO
)
```

**Fallback a `/api/findings` — mapeo degradado:**
```ts
// En catch(esError), mapear solo el primer valor:
if (debouncedQuery.assignee?.[0]) fallbackParams.append('assigneeId', debouncedQuery.assignee[0])
if (debouncedQuery.project?.[0]) fallbackParams.append('projectId', debouncedQuery.project[0])
if (debouncedQuery.dateFrom) fallbackParams.append('createdAfter', debouncedQuery.dateFrom)
if (debouncedQuery.dateTo) fallbackParams.append('createdBefore', debouncedQuery.dateTo)
// hasEvidence: omit (sin equivalente en FindingsQuerySchema)
```

---

## 5. API contracts

### 5.1 `GET /api/search/findings` (existente, sin cambios)

```
GET /api/search/findings?q=&status=&priority=&severity=&assignee=id1,id2&project=id1,id2
                        &dateFrom=ISO&dateTo=ISO&hasEvidence=true|false&limit=&offset=

RBAC: checkRBAC(VIEW_ALL_FINDINGS) ✓ ya implementado correctamente

Response 200:
{
  total: number,
  items: Array<{ id, observation, highlightedObservation?, status, priority, severity, assigneeId?, projectId, createdAt }>,
  took_ms: number,
  facets: {
    status?: Record<string, number>,
    priority?: Record<string, number>,
    severity?: Record<string, number>,
    assignee?: Array<{ id: string; doc_count: number }>,
    project?: Array<{ id: string; doc_count: number }>
  }
}
```

### 5.2 `GET /api/search/lookups` (existente, sin cambios)

```
GET /api/search/lookups?type=assignees&projectId=xxx  → { assignees: [{id,name,avatar}] }
GET /api/search/lookups?type=projects&userId=xxx      → { projects: [{id,name}] }

RBAC: checkRBAC(VIEW_ALL_FINDINGS) ✓ ya implementado correctamente
```

### 5.3 `POST /api/findings/bulk-update` — ⚠️ FIX DE SEGURIDAD OBLIGATORIO

**Contrato (sin cambios):**
```
POST /api/findings/bulk-update
Body: { ids: string[] (max 100), updates: { status?, priority?, severity?, assigneeId?, dueDate? } }
→ 200 { updated, failed: 0, results } | 207 { updated, failed>0, results } | 400 | 401/403
```

**PROBLEMA ACTUAL:** NO tiene `checkRBAC()`. Cualquiera sin sesión puede modificar findings en lote. Además usa `updatedBy: 'system'` hardcodeado en vez del usuario real.

**FIX REQUERIDO (15 min):**

Archivo: `app/api/findings/bulk-update/route.ts`

```ts
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export async function POST(request: NextRequest) {
  try {
    // NUEVO — mismo patrón que PATCH /api/findings/[id]
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.EDIT_FINDING_ANY,   // ["OWNER", "QA_LEAD"]
    })
    if (!valid) return error

    const body = await request.json()
    // ... validación sin cambios ...

    const updateData = {
      ...updates,
      version: { increment: 1 },
      updatedAt: new Date(),
      updatedBy: user.id,   // CAMBIO — antes: 'system'
    }
    // ... resto sin cambios ...
  } catch (error) {
    return apiError(error)
  }
}
```

**Permiso reutilizado:** `RBAC_PERMISSIONS.EDIT_FINDING_ANY` (`["OWNER", "QA_LEAD"]`) — mismo set que protege `PATCH /api/findings/[id]`. No se crea permiso dedicado porque el efecto es idéntico (N updates ≈ N PATCH individuales).

### 5.4 Fix funcional recomendado — filtro `hasEvidence` es un no-op

**Problema:** `lib/elasticsearch/findings-index.ts` mapea `evidenceCount: { type: 'integer' }`, y **todo** documento siempre setea ese campo (`evidenceCount: finding.evidence?.length || 0` — nunca `undefined`). El filtro actual en `lib/services/search-service.ts`:

```ts
if (query.hasEvidence) {
  filters.push({ exists: { field: 'evidenceCount' } })       // SIEMPRE true
} else {
  filters.push({ bool: { must_not: { exists: { field: 'evidenceCount' } } } })  // NUNCA true
}
```

No distingue "tiene evidencia" de "no tiene". **Fix (4 líneas):**

```ts
if (query.hasEvidence) {
  filters.push({ range: { evidenceCount: { gt: 0 } } })
} else {
  filters.push({ term: { evidenceCount: 0 } })
}
```

**Marcar como requerido** para que el checkbox funcione de verdad. Se puede entregar en commit separado del fix RBAC, pero debe estar en el mismo PR/fase.

### 5.5 Exportar CSV — decisión explícita (sin endpoint nuevo)

**Decisión:** 100% client-side usando `papaparse` (`Papa.unparse`, ya es dependencia) sobre `useSearch().data.items` filtrados por `selectedIds`. **No se crea** `GET /api/findings/export`.

**Justificación:** flujo esperado es "selecciono lo que veo en pantalla (máx. 10–20) y exporto eso", no exportación masiva de miles.

**Limitación UI:** tooltip junto a botón "Exportar CSV" — *"Exporta solo los elementos seleccionados que están cargados en pantalla."*

**Columnas CSV:** `ID, Observación, Estado, Prioridad, Severidad, Proyecto, Asignado a, Creado`
- `Observación`: texto plano (no tags `<em>`).
- `Proyecto`/`Asignado a`: resolvemos vía `projectLabels`/`assigneeLabels` con fallback a ID.
- `Creado`: `format(new Date(createdAt), 'dd/MM/yyyy HH:mm')` (date-fns).

### 5.6 Constantes nuevas — `lib/constants/finding-options.ts`

```ts
export const FINDING_STATUS_OPTIONS = [
  'OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION',
  'VALIDATED', 'CLOSED', 'BLOCKED', 'REOPENED',
] as const

export const FINDING_PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export const FINDING_SEVERITY_OPTIONS = ['COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER'] as const

export const STATUS_LABELS_ES: Record<string, string> = {
  OPEN: 'Abierto', TRIAGED: 'Triado', IN_PROGRESS: 'En progreso',
  READY_FOR_VALIDATION: 'Listo para validar', VALIDATED: 'Validado',
  CLOSED: 'Cerrado', BLOCKED: 'Bloqueado', REOPENED: 'Reabierto',
}
export const PRIORITY_LABELS_ES = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' }
export const SEVERITY_LABELS_ES = { COSMETIC: 'Cosmético', MINOR: 'Menor', MAJOR: 'Mayor', BLOCKER: 'Bloqueante' }

// Colores (movidos desde SearchResultItem.tsx — única fuente de verdad)
export const STATUS_COLORS: Record<string, string> = { /* ... */ }
export const PRIORITY_COLORS: Record<string, string> = { /* ... */ }
export const SEVERITY_COLORS: Record<string, string> = { /* ... */ }
```

**Cambio en `SearchFindings.tsx`:** reemplazar array local `STATUS_OPTIONS = [...]` por import desde aquí. Esto también corrige brecha #3 (expandir de 4 a 8 valores del enum).

### 5.7 `SearchResultItem` — nueva interfaz

```ts
'use client'   // NUEVO — pasa a ser interactivo

export interface SearchResultItemProps {
  id: string                       // NUEVO
  observation: string
  highlightedObservation?: string
  status: string
  priority: string
  severity: string
  projectId: string
  assigneeId?: string              // NUEVO (opcional)
  selected: boolean                // NUEVO
  onToggleSelect: (id: string) => void   // NUEVO
  showCheckbox: boolean            // NUEVO — false si user no tiene EDIT_FINDING_ANY
}
```

**Checkbox (solo si `showCheckbox`):**
```tsx
<label
  className="flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer shrink-0"
  onClick={(e) => e.stopPropagation()}
>
  <input
    type="checkbox"
    checked={selected}
    onChange={() => onToggleSelect(id)}
    aria-label={`Seleccionar hallazgo ${id}`}
    className="w-5 h-5 rounded border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
  />
</label>
```

**Layout:** `<div className="flex items-start gap-2">{showCheckbox && <Checkbox/>}<div className="flex-1 ...">{contenido existente}</div></div>`.

---

## 6. Testing strategy

### 6.1 Unit (Vitest + Testing Library)
- `useBatchActions`: toggleSelect añade/quita; clearSelection resetea error; performUpdate > 100 ids no hace fetch; 207 parcial deja solo fallidos seleccionados; 401 mantiene selección intacta.
- `useSearchHistory`: addEntry respeta cap 10 (FIFO evict); removeEntry borra; clearAll vacía.
- `useSavedFilters`: saveFilter respeta cap 20; renameFilter actualiza name+updatedAt; deleteFilter elimina.
- `useSearch`: buildParams serializa nuevos campos correctamente; guard clause NO dispara si filtros vacíos; `false` no se omite por ser falsy.
- `AdvancedFilterPanel`: draft = value al abrir; "Limpiar" llama onApply inmediatamente; "Aplicar" normaliza fechas.
- `FilterPreview`: no renderiza si activeCount = 0; un chip por valor en arrays.
- `SearchResultItem`: no renderiza checkbox si showCheckbox = false; click NO propaga.

### 6.2 Integration (DevTools emulation, mobile <768px y desktop ≥768px)

**Mobile:**
- [ ] Botón "Filtros avanzados" abre segundo sheet (z-60), header con "←".
- [ ] Scroll interno funciona si contenido > 85vh.
- [ ] `BatchActionsToolbar` sticky arriba del footer sin tapar.
- [ ] `FilterPreview` scroll horizontal no rompe layout.
- [ ] Scroll lock (`overflow: hidden`) correcto con 2 sheets apilados.
- [ ] Touch targets 44×44px (DevTools Accessibility panel).

**Desktop:**
- [ ] `AdvancedFilterPanel` dropdown `absolute`, click-outside lo cierra.
- [ ] `BatchActionsToolbar` sticky top-0, visible al scroll.
- [ ] Hover states (`[@media(hover:hover)]`) presentes.

**Batch actions:**
- [ ] Checkbox NO aparece para roles `VIEWER`/`DESIGNER`.
- [ ] `POST /api/findings/bulk-update` body exacto esperado.
- [ ] Respuesta 207 deja fallidos seleccionados + banner.
- [ ] Exportar CSV descarga archivo con columnas correctas.

**Search History / Saved Filters:**
- [ ] Historial guarda al cerrar búsqueda (blur/Escape/click-resultado), no en keystroke.
- [ ] Cap 10/20 verificado con IndexedDB DevTools.
- [ ] Click "Guardados" restaura `q` + todos los filtros exactamente.
- [ ] Rename persiste tras reload (IndexedDB).

### 6.3 Regresión FASE 12/13 (obligatoria)
- [ ] `SearchFindings` funciona con cero filtros avanzados.
- [ ] Debounce 500ms mobile / 300ms desktop intacto.
- [ ] Facets básicas siguen mostrándose.
- [ ] Bottom-sheet original intacto (solo se agregó fila "Filtros avanzados").
- [ ] Highlighting `<em>` Elasticsearch sigue funcionando.

### 6.4 Casos específicos de las brechas (regresión de bugs)
- [ ] **RBAC bulk-update**: `POST /api/findings/bulk-update` sin sesión → **401** (hoy responde 200 → prueba que fix quedó).
- [ ] **`updatedBy`**: tras bulk-update como usuario X, audit log debe ser `X.id`, no `'system'`.
- [ ] **`hasEvidence` no-op**: con fix aplicado, `hasEvidence=true` excluye `evidenceCount: 0`; sin fix, test falla (documenta bug).
- [ ] **STATUS_OPTIONS completo**: filtro status debe ofrecer 8 valores (snapshot/render count).
- [ ] **`buildParams`**: dado `{assignee: ['u1'], hasEvidence: false}`, querystring incluye `assignee=u1&hasEvidence=false` (`false` NO se omite).

---

## 7. Guía de implementación paso a paso

| # | Paso | Archivos | Depende de | Tiempo |
|---|------|----------|-------------|--------|
| 1 | ⚠️ Fix RBAC + `updatedBy` | `app/api/findings/bulk-update/route.ts` | — (bloqueante seguridad) | 15 min |
| 2 | Fix `hasEvidence` Elasticsearch | `lib/services/search-service.ts` | — | 10 min |
| 3 | Constantes compartidas | `lib/constants/finding-options.ts` | — | 20 min |
| 4 | Tipos compartidos | `lib/types/search.ts` | Paso 3 | 15 min |
| 5 | Helper IndexedDB | `lib/indexeddb/search-db.ts` | — | 15 min |
| 6 | Diff `useSearch.ts` | `lib/hooks/useSearch.ts` | Paso 4 | 30 min |
| 7 | `useLookups` (fetch simple) | `lib/hooks/useLookups.ts` | — | 20 min |
| 8 | `useBatchActions` | `lib/hooks/useBatchActions.ts` | Paso 1 | 45 min |
| 9 | `useSearchHistory` + `useSavedFilters` | `lib/hooks/{useSearchHistory,useSavedFilters}.ts` | Paso 5 | 1h |
| 10 | `SearchResultItem` checkbox | `components/search/SearchResultItem.tsx` | Pasos 3, 4 | 30 min |
| 11 | `AdvancedFilterPanel` | `components/search/AdvancedFilterPanel.tsx` | Pasos 3, 4, 7 | 1.5h |
| 12 | `BatchActionsToolbar` | `components/search/BatchActionsToolbar.tsx` | Pasos 3, 8 | 1h |
| 13 | `FilterPreview` | `components/search/FilterPreview.tsx` | Pasos 3, 4, 7 | 45 min |
| 14 | `SearchHistory` | `components/search/SearchHistory.tsx` | Paso 9 | 1h |
| 15 | Integración `SearchFindings.tsx` | `components/search/SearchFindings.tsx` | Pasos 6, 10–14 | 1.5h |
| 16 | Build + smoke test | `npm run build`, DevTools | Todos | 45 min |

**Total: ~10 horas** (mayor que 3-4h original: fix RBAC + hasEvidence, refactor estado unificado, 3 hooks con IndexedDB, constantes compartidas).

**Orden crítico:** Pasos 1–2 (backend) primero. Paso 15 es el único punto de sincronización (todo lo demás puede ir en paralelo tras Pasos 3–5).

---

## Archivos finales a crear/modificar

**Nuevos (11):**
```
lib/constants/finding-options.ts
lib/types/search.ts
lib/indexeddb/search-db.ts
lib/hooks/useLookups.ts
lib/hooks/useBatchActions.ts
lib/hooks/useSearchHistory.ts
lib/hooks/useSavedFilters.ts
components/search/AdvancedFilterPanel.tsx
components/search/BatchActionsToolbar.tsx
components/search/FilterPreview.tsx
components/search/SearchHistory.tsx
```

**Modificados (5):**
```
lib/hooks/useSearch.ts                          (§4.5)
components/search/SearchFindings.tsx             (§7 paso 15)
components/search/SearchResultItem.tsx           (§5.7)
app/api/findings/bulk-update/route.ts            (§5.3 — FIX RBAC)
lib/services/search-service.ts                   (§5.4 — fix hasEvidence)
```

---

**Especificación completada:** basada en lectura directa del código fuente. Las 7 brechas encontradas en el master prompt anterior fueron resueltas con decisiones explícitas (no dejadas abiertas).
