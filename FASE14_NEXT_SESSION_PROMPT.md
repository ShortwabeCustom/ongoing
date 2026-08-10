# FASE 14 — Frontend Implementation
## Master Prompt para Próxima Sesión

**Fecha Sesión Anterior**: 2026-08-10 (Especificación completada)  
**Esta Sesión**: Implementación o fixes de seguridad  
**Idioma**: Español  
**Skill Recomendado**: `/frontend-developer` ⭐ (ver abajo)

---

## 🎯 Objetivo de Esta Sesión

Implementar o corregir seguridad de FASE 14 (Advanced Filters & Batch Actions).

**Elige una opción:**

### OPCIÓN A: Implementar FASE 14 Completo (Frontend) — ⭐ RECOMENDADO
**Duración**: ~10 horas (1-2 sesiones de 5-6h cada una)  
**Skill**: `/frontend-developer`  
**Entregable**: 11 archivos nuevos + 5 modificados, FASE 14 lista para producción

**Qué harás:**
1. Leer FASE14_FRONTEND_SPEC.md (~30 min de lectura)
2. Implementar 16 pasos guiados (§7 de la spec)
3. Testing: DevTools emulation (mobile/desktop) + real device checklist
4. Commit + merge a main

**Puntos de entrada:**
- Paso 1-2: Fix RBAC + hasEvidence (25 min) — **bloqueante, hacer primero**
- Paso 3-5: Constantes/tipos/IndexedDB (50 min) — independientes, parallelizable
- Paso 6-15: Hooks + componentes (6.5h) — dependen de 3-5
- Paso 16: Build + smoke test (45 min)

---

### OPCIÓN B: Solo Fixes de Seguridad/Funcionalidad — 🏃 RÁPIDO
**Duración**: ~25 minutos  
**Skill**: `/senior-backend`  
**Entregable**: 2 archivos modificados, seguridad + funcionalidad OK, frontend postponido

**Qué harás:**
1. Fix RBAC en `app/api/findings/bulk-update/route.ts` (15 min)
   - Añadir `checkRBAC()` + `updatedBy: user.id`
   - Ver §5.3 de FASE14_FRONTEND_SPEC.md
2. Fix `hasEvidence` en `lib/services/search-service.ts` (10 min)
   - Reemplazar `exists` con `range { gt: 0 }`
   - Ver §5.4 de FASE14_FRONTEND_SPEC.md
3. Commit + merge

**Por qué**: El fix RBAC es un hallazgo de seguridad crítico identificado hoy. `bulk-update` permite requests sin autenticación. Aunque sea un "quick win", es recomendable corregirlo ya.

---

### OPCIÓN C: Fixes + Frontend en Fases — ⚖️ BALANCEADO
**Sesión esta** (30 min): Fixes RBAC + hasEvidence  
**Sesión próxima** (10h): Frontend con `/frontend-developer`

**Por qué**: Limpia la deuda de seguridad, luego frontend con codebase clean.

---

## 📖 Contexto

### Backend ya completado (FASE 14)
✅ SearchQuerySchema con `assignee[]`, `project[]`, `dateFrom`, `dateTo`, `hasEvidence`  
✅ GET /api/search/findings soporta nuevos parámetros  
✅ GET /api/search/lookups para dropdown data  
✅ POST /api/findings/bulk-update con transacciones Prisma  
✅ Elasticsearch facets para `assignee` y `project`  

**Código backend está en `git status` sin commitear.** Frontend usa estas APIs directamente.

### Frontend spec completada (2026-08-10)
✅ FASE14_FRONTEND_SPEC.md (1,500+ líneas, 100% accionable)  
✅ 4 componentes con mockups (desktop + mobile)  
✅ 3 hooks con TypeScript completo  
✅ 7 brechas del master prompt original resueltas  
✅ 1 hallazgo de seguridad crítico documentado  
✅ 16 pasos de implementación guiados  

**No hay ambigüedades.** La spec es lista para pasar directamente a código.

### Convenciones establecidas (FASE 13)
- Tailwind directo (sin shadcn/ui button wrapper)
- Dual layout: `hidden md:block` + `md:hidden` (no dos componentes)
- Touch targets: `min-h-[44px] min-w-[44px]`
- Hover condicional: `[@media(hover:hover)]:hover:*`
- Focus: `focus-visible:ring-2 focus-visible:ring-indigo-500`
- Debounce: 300ms desktop, 500ms mobile (ya en `useDebouncedValue`)
- Iconos: Lucide React (no emojis)

---

## 🚀 Cómo Proceder (si elijes OPCIÓN A)

### 1. Lectura (30 min)
- Abre [FASE14_FRONTEND_SPEC.md](file:///var/www/uix.torrax.cloud/FASE14_FRONTEND_SPEC.md)
- Secciones a leer PRIMERO:
  - §1 (Ejecutiva) + §7 (Guía paso a paso)
  - Luego §2 (Data flow) para entender qué hace cada componente
  - Luego §3-4 (Componentes + Hooks) para detalles de implementación
  - Luego §6 (Testing) para checklist

### 2. Fix RBAC (15 min) — BLOQUEANTE
**Archivo**: `app/api/findings/bulk-update/route.ts`  
**Referencia**: §5.3 de FASE14_FRONTEND_SPEC.md

Copia el patrón de `PATCH /api/findings/[id]`:
```ts
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

const { valid, user, error } = await checkRBAC(request, {
  allowedRoles: RBAC_PERMISSIONS.EDIT_FINDING_ANY,  // ["OWNER", "QA_LEAD"]
})
if (!valid) return error

// ... cambiar updatedBy: 'system' a updatedBy: user.id
```

### 3. Fix hasEvidence (10 min)
**Archivo**: `lib/services/search-service.ts`  
**Referencia**: §5.4 de FASE14_FRONTEND_SPEC.md

Reemplazar:
```ts
if (query.hasEvidence) {
  filters.push({ range: { evidenceCount: { gt: 0 } } })
} else {
  filters.push({ term: { evidenceCount: 0 } })
}
```

### 4. Implementación (16 pasos, ~9h 45 min)
Sigue la tabla en §7 de FASE14_FRONTEND_SPEC.md:

| Paso | Archivo | Tiempo |
|------|---------|--------|
| 1 | Fix RBAC (ya hecho) | 15 min |
| 2 | Fix hasEvidence (ya hecho) | 10 min |
| 3 | `lib/constants/finding-options.ts` | 20 min |
| 4 | `lib/types/search.ts` | 15 min |
| 5 | `lib/indexeddb/search-db.ts` | 15 min |
| 6 | `lib/hooks/useSearch.ts` (diff) | 30 min |
| 7 | `lib/hooks/useLookups.ts` | 20 min |
| 8 | `lib/hooks/useBatchActions.ts` | 45 min |
| 9 | `lib/hooks/useSearchHistory.ts` + `useSavedFilters.ts` | 1h |
| 10 | `components/search/SearchResultItem.tsx` | 30 min |
| 11 | `components/search/AdvancedFilterPanel.tsx` | 1.5h |
| 12 | `components/search/BatchActionsToolbar.tsx` | 1h |
| 13 | `components/search/FilterPreview.tsx` | 45 min |
| 14 | `components/search/SearchHistory.tsx` | 1h |
| 15 | `components/search/SearchFindings.tsx` (integración) | 1.5h |
| 16 | Build + smoke test | 45 min |

**Parallelizable**: Pasos 3-5 son independientes. Pasos 6-15 pueden dividirse entre N desarrolladores una vez 3-5 estén hechos.

### 5. Testing (included en paso 16, plus DevTools)
Checklist en §6.2-6.4 de FASE14_FRONTEND_SPEC.md

Mobile DevTools emulation (<768px):
- [ ] Bottom-sheet segundo nivel (z-60 sobre z-50)
- [ ] Scroll lock correcto con 2 sheets apilados
- [ ] Touch targets 44×44px
- [ ] Batch actions toolbar visible, no superpone footer

Desktop (≥768px):
- [ ] AdvancedFilterPanel dropdown click-outside
- [ ] BatchActionsToolbar sticky top
- [ ] Hover states presentes

Batch actions:
- [ ] RBAC enforced (no checkbox para roles sin EDIT_FINDING_ANY)
- [ ] POST /api/findings/bulk-update con body exacto
- [ ] Respuesta 207 parcial deja fallidos seleccionados
- [ ] Exportar CSV genera archivo correcto

### 6. Commit + Merge
```bash
git add .
git commit -m "feat(search): implement FASE 14 — Advanced Filters & Batch Actions

- 4 new components: AdvancedFilterPanel, BatchActionsToolbar, FilterPreview, SearchHistory
- 3 new hooks: useBatchActions, useSearchHistory, useSavedFilters
- Shared constants + types + IndexedDB helper
- Updated useSearch.ts for new filters (assignee, project, dateRange, hasEvidence)
- SearchResultItem checkbox + multi-select support
- Batch update actions: status, priority, assign, export CSV
- Save search criteria + history (IndexedDB, FIFO 10 + manual 20)
- RBAC enforcement, touch-friendly (44×44px), responsive mobile/desktop
- Fix: bulk-update endpoint now requires authentication
- Fix: hasEvidence filter now correctly filters by evidenceCount > 0"

git push origin BRANCH_NAME
# Create PR to main
```

---

## 🛠️ Skill Recomendado

### `/frontend-developer` — Para Implementación Completa ⭐

**Por qué este skill:**
- ✅ React 19 component architecture (4 componentes nuevos + estado compartido)
- ✅ Form handling (multi-select dropdowns, date pickers, checkboxes)
- ✅ State management (hooks con IndexedDB, batch selection, filtro state)
- ✅ Mobile responsiveness (bottom-sheet, accordion, scroll lock, 44×44px targets)
- ✅ Accessibility (ARIA labels, keyboard nav, focus management)
- ✅ Testing (Vitest + Testing Library, DevTools emulation)

**Invocación:**
```
/frontend-developer

Necesito implementar FASE 14 — Advanced Filters & Batch Actions (Frontend).

Contexto:
- Proyecto: Pruebas María (Next.js 16.3 + React 19 + Elasticsearch 8.11.0)
- Backend: YA COMPLETADO (SearchQuerySchema, GET /api/search/findings, POST /api/findings/bulk-update, GET /api/search/lookups)
- Especificación: FASE14_FRONTEND_SPEC.md (1,500 líneas, 100% accionable, 16 pasos)
- Status: Backend fixes pendientes (RBAC + hasEvidence, 25 min)

Deliverables:
1. 4 componentes nuevos (AdvancedFilterPanel, BatchActionsToolbar, FilterPreview, SearchHistory)
2. 3 hooks nuevos (useBatchActions, useSearchHistory, useSavedFilters) + diff de useSearch.ts
3. Constantes centralizadas + tipos + helper IndexedDB
4. Integración en SearchFindings.tsx
5. Testing: DevTools mobile/desktop + regression FASE 12/13

Requisitos:
- Mobile-first: respeta bottom-sheet de FASE 13, 44×44px targets, scroll lock con sheets apilados
- Accesibilidad: ARIA labels, keyboard nav (Tab/Arrow/Escape), focus management
- Tailwind directo (sin shadcn/ui Button), iconos Lucide
- TypeScript strict, 0 `any` types
- No breaking changes a FASE 12/13

Tiempo: ~10 horas (16 pasos parallelizable)
Referencia: FASE14_FRONTEND_SPEC.md (§3-4 componentes/hooks, §6 testing)

Empieza: Leer especificación → Fix RBAC/hasEvidence → Pasos 3-5 (constants/types/indexeddb) → Pasos 6-15 (hooks/componentes/integración) → Paso 16 (build + smoke test)
```

### `/senior-backend` — Para Solo Fixes (si elijes OPCIÓN B)

**Invocación:**
```
/senior-backend

Necesito dos fixes críticos en las APIs de bulk-update y búsqueda.

Tareas:
1. Agregar RBAC a POST /api/findings/bulk-update (15 min)
   - Archivo: app/api/findings/bulk-update/route.ts
   - Pattern: copiar de PATCH /api/findings/[id] (ya tiene checkRBAC correcto)
   - Permiso: RBAC_PERMISSIONS.EDIT_FINDING_ANY (["OWNER","QA_LEAD"])
   - Cambio: updatedBy: 'system' → updatedBy: user.id
   - Referencia: FASE14_FRONTEND_SPEC.md §5.3

2. Corregir filtro hasEvidence en Elasticsearch (10 min)
   - Archivo: lib/services/search-service.ts
   - Problema: campo evidenceCount siempre existe, filtro "exists" no distingue nada
   - Fix: usar range { gt: 0 } para "con evidencia", term { evidenceCount: 0 } para "sin"
   - Referencia: FASE14_FRONTEND_SPEC.md §5.4

Stack: Next.js 16.3, Prisma 7.9.1, Elasticsearch 8.11.0
Commit message: "fix: add RBAC to bulk-update endpoint + fix hasEvidence filter"
```

---

## 📚 Documentación de Referencia

- **FASE14_FRONTEND_SPEC.md** — Especificación completa (1,500+ líneas)
- **FASE14_BACKEND_COMPLETION.md** — Resumen backend (ya completado)
- **FASE14_ROADMAP.md** — Decisiones arquitectónicas previas
- **FASE13_DESIGN_GUIDE.md** — Sistema de diseño (convenciones a mantener)
- **FASE13_COMPLETION.md** — Testing patterns de sesión anterior

---

## 🎯 KPIs de Éxito

| Métrica | Target |
|---------|--------|
| Build time | <50s (`npm run build`) |
| Type errors | 0 (`npx tsc --noEmit`) |
| Components created | 4/4 |
| Hooks created | 3/3 |
| Touch targets | 44×44px (DevTools Accessibility) |
| RBAC enforcement | ✓ 401/403 on unauthorized |
| Search history cap | 10 (FIFO) verified IndexedDB |
| Batch action latency | <500ms (expected) |
| Mobile bottom-sheet | z-60 stacked over z-50 |
| Zero breaking changes | FASE 12/13 regression free |
| Lighthouse mobile | ≥90 |
| Lighthouse desktop | ≥95 |

---

## ❓ Preguntas Frecuentes

**P: ¿Qué pasa si no hago el fix RBAC primero?**  
R: `/api/findings/bulk-update` seguirá siendo accesible sin autenticación. El fix es bloqueante de seguridad. Hazlo primero (15 min).

**P: ¿Puedo dividir los 16 pasos entre varios desarrolladores?**  
R: Sí. Pasos 1-5 son prerequisitos. Luego Pasos 6-15 son independientes (si cada uno tira de 1-5 al inicio).

**P: ¿Necesito real device testing o DevTools es suficiente?**  
R: DevTools emulation (<768px) es suficiente para FASE 14. Real device testing es recomendable pero no bloqueante.

**P: ¿Se espera que el código sea perfecto a la primera?**  
R: No. Testing (§6.2-6.4) revelará gaps. Iter ative: implementa, testa en DevTools, arregla.

**P: ¿Cuánta cache de prompt necesito para esta sesión?**  
R: Poca. Leer FASE14_FRONTEND_SPEC.md (~1500 líneas) es suficiente como entrada. La spec es self-contained.

---

## 📝 Resumen de Entrada

**Archivos a leer ANTES de empezar:**
1. FASE14_FRONTEND_SPEC.md (especificación accionable)
2. FASE14_FRONTEND_COMPLETION.md (resumen esta sesión)

**Comando para iniciar:**
```
/frontend-developer
```

**Prompt a pasar (arriba, sección "Skill Recomendado").**

**Tiempo esperado:** 1-2 sesiones (según paralelización)  
**Bloqueante:** Fix RBAC (15 min) — hacer primero  
**Siguiente fase:** FASE 15 (export/analytics/mobile app)

---

**Buena suerte.** La especificación es sólida y accionable. No hay ambigüedades. Solo implementa los 16 pasos en orden.
