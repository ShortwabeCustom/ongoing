# Session: Reconciliation — Evidence / Chat / Cards vs New Filters (2026-08-25 → 2026-08-26)

## Contexto

El usuario reportó que "el incremental de los filtros" había quitado funcionalidad
ya iterada, resuelta y estable en la zona de evidencias del detalle de un
finding — específicamente el chat/comentarios y la organización en tarjetas
("cards") del detalle.

## Problema raíz

No fue un bug de código ni una pérdida real de trabajo. Fue **divergencia de
ramas**: dos líneas de trabajo distintas partieron del mismo commit
`6a93715` (`chore(infra): remove legacy torrax hostname`, 2026-08-19):

- **Línea A** (`release/findings-delete-2026-08-19` → `release/findings-filter-prod-8d1414f`):
  evolucionó el detalle del finding — comentarios colaborativos ("el chat"),
  borrado de comentarios, reorganización de tarjetas/acciones, consolidación
  del historial de actividad, borrado de finding, fixes de lightbox, y
  también su propio (viejo) rediseño de filtros.
- **Línea B** (`main` → `fix/date-picker-unification-2026-08-19`, la rama de
  trabajo activa): recibió solo 2 commits de la Línea A por cherry-pick, y
  luego construyó **desde cero** un sistema de filtros nuevo
  (`release: findings filters and daily workflow`, `e07a690`) que nunca
  incorporó el resto de la Línea A.

`git merge-base --is-ancestor release/findings-delete-2026-08-19 main` confirmó
que esa rama nunca fue ancestro de `main`: los 12+ commits de evidencias/chat/
cards simplemente nunca llegaron a la línea donde se hizo el incremental de
filtros. Todo seguía vivo en ramas locales/remotas, nada se perdió por reset
o `push --force`.

## Ramas involucradas

| Rama | Rol |
|---|---|
| `fix/date-picker-unification-2026-08-19` | Rama de trabajo activa (filtros nuevos + date picker unificado) |
| `restore/evidence-chat-cards-2026-08-25` | Rama de reconciliación (creada 2026-08-25, cherry-picks selectivos) |
| `release/findings-delete-2026-08-19` / `release/findings-filter-prod-8d1414f` | Línea histórica fuente de las capacidades recuperadas |
| `release/finding-completion-2026-08-19` | Snapshot intermedio de la misma línea (19:26), estrictamente anterior — sin contenido único relevante |
| `backup/pre-evidence-restore-2026-08-25` | Referencia de respaldo apuntando al HEAD anterior al fast-forward |

## Merge base

`6a93715a56f05b98d699dc6c3b6ebc17eeabb21c` — `chore(infra): remove legacy torrax hostname`

## Commits recuperados (cherry-pick selectivo, orden cronológico)

1. `f0e1585` ← `bdd963e` fix(evidence): make image lightbox closable across views
2. `31c8a75` ← `896c887` fix(evidence): isolate lightbox above page layers
3. `b5ba641` ← `1d3e4fa` feat(findings): add delete action to detail (solo `DeleteFindingButton.tsx` + wiring en `page.tsx`; la parte de bulk-select en la lista de búsqueda se descartó, ver abajo)
4. `65af2c8` ← `39e6410` fix(public-report): align evidence KPI with findings
5. `a2107c0` ← `3b3afc9` feat(public-report): open evidence in inline viewer
6. `5ecfb6a` ← `25396fa` fix(findings): clarify status action labels
7. `9cbfe1a` ← `0f8a0e1` refactor(findings): consolidate activity history
8. `6e18251` ← `bf77594` feat(findings): add collaborative comments card (**el chat**)
9. `8b03749` ← `0351c8e` feat(findings): allow deleting comments
10. `4048f7b` ← `a459a5f` refine finding detail action hierarchy (**organización de cards**)
11. `f86054a` — fix local: mock de test usa `EvidenceType` válido (`IMAGE` en vez de `SCREENSHOT`, valor que no existe en el enum actual)
12. `8b08484` — tests nuevos: cobertura para `deleteFinding` (servicio + RBAC de ruta) y `FindingComments` (ver "Tests" abajo)

`7c0f69a` (fix de lookups) se intentó pero resultó en un cherry-pick vacío —
el fix ya está cubierto de otra forma en la arquitectura actual; se hizo
`--skip`.

## Funcionalidades recuperadas

- **Chat / comentarios colaborativos** — `components/finding/FindingComments.tsx`
- **Borrado de comentarios** — `app/api/findings/[id]/comments/[commentId]/route.ts` + `FindingService.deleteComment` (ownership server-side: autor o OWNER/QA_LEAD)
- **Borrado de finding con RBAC** — `components/finding/DeleteFindingButton.tsx` + `FindingService.deleteFinding` (soft delete, RBAC `DELETE_FINDING = [OWNER, QA_LEAD]` en la ruta `DELETE /api/findings/[id]`)
- **Historial de actividad consolidado** — `components/finding/ActivityLog.tsx` (con `ErrorBoundary` local, tarjeta única)
- **Jerarquía de acciones / organización en cards** — `app/findings/[id]/page.tsx`, `FindingDetailWithEvidence.tsx`, `FindingStatusActions.tsx` (incluye prop `appearance` dark/light no presente en versiones más antiguas de otras ramas)
- **Lightbox estable** — `components/evidence/ImageLightbox.tsx` (cerrable, aislado por encima de otras capas)
- **Evidencia inline en reporte público + KPI alineado** — `public/app.html`, `public/sw.js`, `app/api/public/report/route.ts`

## Funcionalidades ya presentes (no requerían recuperación)

Confirmado por `git merge-base --is-ancestor <commit> fix/date-picker-unification-2026-08-19`:

- Reestructuración original en 8 cards (`bec6e76`)
- Fixes de serialización React #418/#441 (`634e5c1`, `78abddc`, `4093bcf`, `b2a66ca`, `074c47d`, `112adb6`, `a4739f3`)

## Funcionalidades descartadas

### `da25e32` — `feat(findings): improve filters and add bulk delete`

**Clasificación: `PENDIENTE_FEATURE_V2`**

No se hizo cherry-pick ni merge. El commit mezcla en un solo diff:
bulk-delete (backend limpio, reutilizable) con cambios profundos a
`components/search/AdvancedFilterPanel.tsx`, `SearchFindings.tsx`,
`lib/hooks/useSearch.ts`, `useUrlSync.ts`, `lib/services/search-service.ts` —
todos archivos que el sistema de filtros nuevo (`e07a690`) ya reemplazó o
reescribió por completo. Se intentó el cherry-pick como verificación: produjo
conflictos de fondo (`AdvancedFilterPanel.tsx` borrado en HEAD vs modificado
en `da25e32`, y cientos de líneas de conflicto en `SearchFindings.tsx` entre
la UI vieja de selección múltiple y la nueva). Traerlo habría significado
reimplementar bulk-delete contra la arquitectura nueva desde cero, no un
merge mecánico — exactamente el tipo de decisión de arquitectura que debía
documentarse antes de ejecutar, no adivinarse.

Piezas reutilizables identificadas para la v2 (no implementadas en esta sesión):
`POST /api/findings/bulk-delete`, `BulkDeleteSchema`,
`FindingService.bulkDeleteFindings()`, RBAC `DELETE_FINDING`, tests de
bulk-delete existentes en `da25e32`/`release/findings-filter-prod-8d1414f`.

### `4b382c3` — `fix(public-report): keep runtime evidence private`

**Clasificación: `DESCARTAR_OBSOLETO`**

Vive en `release/finding-completion-2026-08-19` / `release/lightbox-close-2026-08-19`,
un snapshot de las 08:47 del 2026-08-19 — anterior a toda la línea de
comentarios/cards que sí se recuperó. Endurecía una regla pública que
restringía el reporte público a evidencia `legacy/` únicamente, ocultando
la evidencia de runtime por completo, y tocaba `public/report-runtime.js`.

Ese archivo **ya no existe** en la rama actual: fue reemplazado por el
render inline en `public/app.html` (traído por `3b3afc9`/`a2107c0` en esta
misma reconciliación). Además, la regla de privacidad que `4b382c3` intentaba
imponer fue superada por un diseño posterior y más deliberado, ya presente en
`fix/date-picker-unification-2026-08-19` antes de esta sesión (heredado de
`1c0f299`): el reporte público ahora *sí* enumera evidencia de runtime, pero
nunca expone `storageKey` ni el `id` crudo — construye
`/api/evidence/{id}/file`, una ruta que exige `checkRBAC` **antes** de
cualquier lookup (fail-closed, ver `app/api/evidence/[id]/file/route.ts`,
ADR-001 P1-B D2/D7/D14). Aplicar `4b382c3` habría revertido una decisión de
producto posterior e intencional. Se verificó en código, no se adivinó.

### Filtros legacy

No se tocaron ni restauraron `components/search/AdvancedFilterPanel.tsx`
(permanece borrado), `SearchFindings.tsx` legacy, `useSearch.ts` legacy,
`FilterPreview.tsx`, `DatePresetButtons.tsx`, `CreatedDateFilter.tsx`. El
sistema nuevo (`components/filters/*`, `AnalyticsFilterBar`,
`useAnalyticsFilters`, etc.) es la única fuente de verdad y no fue
modificado por esta reconciliación (confirmado por `git diff --stat` entre
`fix/date-picker-unification-2026-08-19` y la rama de restauración antes del
merge: cero archivos de `components/search|filters`, `lib/hooks/useSearch*`,
`lib/hooks/useUrlSync.ts`, `lib/services/search-service.ts`,
`lib/validators/search-query.ts` tocados).

## Archivos afectados (resumen)

23 archivos, +1211/-137 líneas. Ver el diffstat completo del fast-forward
merge en el historial de git (`git show 8b08484 --stat` no aplica porque es
fast-forward sin commit de merge; ver rango
`d621034..8b08484`).

## Seguridad

- **Borrado de comentarios**: server-side, scoping por `findingId` +
  `commentId` (`findFirst({ where: { id, findingId } })`), autorización
  autor-o-`OWNER/QA_LEAD` en `FindingService.deleteComment` — no depende del
  frontend. Verificado con test dedicado (`finding-comments-delete.test.ts`,
  ya existente).
- **Borrado de finding**: RBAC server-side vía `checkRBAC` con
  `RBAC_PERMISSIONS.DELETE_FINDING = ["OWNER", "QA_LEAD"]` en
  `DELETE /api/findings/[id]`, coincide exactamente con la restricción del
  botón en frontend (defensa en profundidad, no dependencia única). Soft
  delete transaccional con auditoría. **Sin test previo en todo el
  historial del repo** — se agregó `finding-delete.test.ts` (servicio) y
  `delete-rbac.test.ts` (matriz de roles a nivel de ruta HTTP) en esta
  sesión.
- **Reporte público**: no expone comentarios, `storageKey`, ni `id` crudo de
  evidencia; la evidencia de runtime se enumera solo como URL autenticada
  (`/api/evidence/{id}/file`), protegida por RBAC fail-closed. Verificado en
  código (`app/api/public/report/route.ts`, `app/api/evidence/[id]/file/route.ts`)
  y por los tests existentes de `public-evidence.test.ts`.

## Tests

- Suite completa antes de esta sesión (baseline, `fix/date-picker-unification-2026-08-19`): 57 archivos / 660 tests, 132 líneas de `tsc --noEmit` (ruido preexistente, no relacionado con esta reconciliación).
- Gaps encontrados (Fase 11): `FindingService.deleteFinding` y la ruta `DELETE /api/findings/[id]` no tenían ningún test en ninguna rama del historial; `FindingComments.tsx` (el chat) tampoco.
- Tests agregados en esta sesión:
  - `lib/services/__tests__/finding-delete.test.ts` (4 casos: soft delete + auditoría, `NOT_FOUND`, `ALREADY_DELETED`, carrera lookup/update)
  - `app/api/findings/[id]/__tests__/delete-rbac.test.ts` (matriz RBAC: 401 anónimo, 403 para cada rol sin `DELETE_FINDING`, 204 para OWNER/QA_LEAD, passthrough 404/410)
  - `components/finding/__tests__/FindingComments.test.tsx` (7 casos: estado vacío, visibilidad de borrado por ownership, OWNER override, VIEWER sin formulario, crear/borrar felices, error de API)
  - Fix de un mock de test heredado (`ImageLightbox.test.tsx`) que usaba un valor de enum obsoleto.
- Estado final: **60 archivos / 680 tests, 100% verde**, `tsc --noEmit` con exactamente el mismo output que el baseline (0 errores nuevos).

## Build

`npm run build` (webpack) exitoso antes y después del merge — compilación,
typecheck interno de Next y generación de las 16 páginas estáticas/dinámicas
sin errores, incluyendo la nueva ruta `/api/findings/[id]/comments/[commentId]`.

## Smoke test

**No se ejecutó un smoke test manual/en navegador contra producción.**
Motivo explícito: el proceso pm2 en producción sirve el código previamente
desplegado, no esta rama — validar en navegador habría exigido desplegar
(prohibido en Fase 17 de esta sesión) o correr un servidor local que, dado
que `.env` solo define `DATABASE_URL` apuntando a la única base Postgres
existente (sin staging), habría tocado datos reales sin verificar código
nuevo. Se sustituyó por verificación equivalente controlada: suite
automatizada (jsdom + Testing Library) que ejercita exactamente los flujos
de la lista de Fase 12 que dependen de esta reconciliación (crear/listar/
borrar comentario, visibilidad por rol, borrar finding con confirmación y
redirect, RBAC 401/403/204/404/410, lightbox, evidencia pública) más
build/typecheck en verde. Los flujos de filtros/date-picker no se tocaron en
esta sesión (ver "Filtros legacy" arriba) y ya contaban con su propia
cobertura previa a esta reconciliación.

## Riesgos

- No hay verificación en navegador real de la interacción visual (solo
  jsdom). Riesgo bajo dado que los componentes recuperados son los mismos
  que ya estaban probados en su línea histórica original, sin reescritura.
- `da25e32` (bulk delete) sigue sin implementarse contra la arquitectura
  nueva — pendiente explícito, no bloqueante para esta reconciliación.
- El proceso de producción sigue corriendo el código previo al merge de
  esta sesión hasta que alguien decida desplegar (fuera de alcance aquí).

## Estado final

- Rama integrada: `fix/date-picker-unification-2026-08-19`
- Método de integración: `git merge --ff-only` (fast-forward puro, sin commit de merge)
- SHA final: `8b08484e81a8591471a61d04f0e2d5e5cc0f407c`
- Working tree: CLEAN
- Backup de referencia: `backup/pre-evidence-restore-2026-08-25` → `d6210345689d0c6f17cf78208a355c174a45eed8`

## Pendientes

PENDIENTE: Reimplementar Bulk Delete v2 sobre la arquitectura actual de filtros.

- No implementado en esta sesión (clasificado `PENDIENTE_FEATURE_V2`, ver arriba).
- Reutilizar del histórico `da25e32`: `POST /api/findings/bulk-delete`, `BulkDeleteSchema`, `FindingService.bulkDeleteFindings()`, RBAC `DELETE_FINDING`, sus tests existentes — pero re-cablear la UI de selección múltiple contra `components/search/*` y `lib/hooks/*` **actuales**, no los legacy.
- Smoke test real en navegador pendiente de que se decida un despliegue (fuera de alcance de esta sesión, prohibido explícitamente).
