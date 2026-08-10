# FASE 11 — Analytics Dashboard

**Estado**: ✅ COMPLETADA  
**Fecha**: 2026-08-10  
**Duración estimada**: 2.5-3 horas  
**Idioma**: Español  

## Especificación

FASE 11 introduce un **Analytics Dashboard** interno para visualizar métricas agregadas del trabajo del equipo QA. El dashboard proporciona KPIs en tiempo real, tendencias históricas, y actividad reciente, con filtros configurables por rango de fechas y criterios de búsqueda.

### Objetivo principal

Transformar datos brutos de `Activity`, `Finding`, `FindingStatusHistory`, `Resolution`, y `Validation` en métricas de negocio accionables que permitan:

- Monitorear volumen y estado de hallazgos (abiertos vs. cerrados)
- Cuantificar tiempo de resolución promedio
- Medir tasa de validación (PASS/FAIL)
- Visualizar tendencias de creación y cierre de hallazgos en el tiempo
- Rastrear actividad reciente global del equipo

### Alcance de implementación

✅ **Completado en FASE 11**:
- [x] Backend: `AnalyticsService` con 9 métodos de agregación
- [x] APIs: 2 endpoints (`/api/analytics/summary`, `/api/analytics/activity`) con RBAC
- [x] Frontend: 7 componentes reutilizables (KPI, Charts, Filtros, Actividad)
- [x] Página: `/dashboard/analytics` protegida con sesión y RBAC
- [x] Hook: `useAnalytics` con polling de 60s pausable
- [x] Validación: Schema zod completo con support de filtros

⏭️ **No en alcance para FASE 11** (próximas sesiones):
- [ ] Advanced Search (Elasticsearch)
- [ ] Mobile App (React Native)
- [ ] Webhooks
- [ ] Real-time push (Socket.io)
- [ ] Exportación a formatos (CSV, PDF)

## Arquitectura

```
Frontend (React 19)
├── /dashboard/analytics (Server Component)
│   ├── DateRangeFilter (Client)
│   ├── KPIGrid (Client + useAnalytics hook)
│   ├── TrendChart (Recharts LineChart)
│   ├── StatusBreakdownChart (Recharts BarChart)
│   └── RecentActivityPanel (Client)
│
Backend (Node.js)
├── lib/services/analytics.ts (AnalyticsService estático)
│   ├── getKPIs() → total, abiertos, cerrados, tiempo resolución, tasa validación
│   ├── getStatusBreakdown() → distribution por FindingStatus
│   ├── getTimeSeries() → creados/cerrados por día/semana
│   ├── getResolutionFunnel() → distribution por ResolutionState
│   ├── getValidationRate() → PASS/FAIL/PENDING
│   └── getRecentActivitySummary() → últimas N actividades globales
│
├── app/api/analytics/summary (GET)
│   └── Integra KPIs + breakdowns + serie temporal en 1 respuesta
│
├── app/api/analytics/activity (GET)
│   └── Actividad reciente separada para refresco independiente
│
Database (PostgreSQL)
├── Índices compuestos nuevos:
│   ├── findings (createdAt, status)
│   ├── finding_status_history (toStatus, changedAt)
│   └── validations (result, validatedAt)
└── Reutiliza tablas existentes (Activity, Finding, FindingStatusHistory, Resolution, Validation)
```

## Decisiones técnicas y justificación

### 1. AnalyticsService dedicado vs. extender FindingService
**Decisión**: Servicio nuevo en `lib/services/analytics.ts`  
**Por qué**: Separación de responsabilidades. CRUD y búsqueda viven en `FindingService`; agregaciones complejas de negocio viven aparte. Patrón consistente con otros servicios del proyecto.

### 2. Agregación en memoria (JS) vs. `$queryRaw`
**Decisión**: Agrupar con `date-fns` en memoria, no SQL crudo  
**Por qué**: Prisma `groupBy` no soporta `DATE_TRUNC` directamente. Dado el volumen de un equipo QA interno (cientos/miles de findings, no millones), agrupar en memoria es suficiente y mantiene el patrón 100% Prisma-ORM (sin SQL crudo) como el resto del proyecto. Si el volumen crece, migrar a `$queryRaw` es trivial.

### 3. RBAC: roles autorizados
**Decisión**: `VIEW_ANALYTICS: ["OWNER", "QA_LEAD", "BUSINESS_REVIEWER"]`  
**Por qué**: Métricas agregadas de flujo/desempeño son información de gestión, no operación diaria. `DESIGNER`/`DEVELOPER` ya tienen `VIEW_ALL_FINDINGS` para su trabajo normal; no necesitan dashboard agregado. `VIEWER` (cliente externo) no debe ver métricas internas.

### 4. Real-time: Polling vs. Socket.io
**Decisión**: Polling de 60s con pausa en `visibilitychange`, NO Socket.io push  
**Por qué**: Valor bajo de latencia sub-segundo para dashboard de tendencias. El costo de instrumentar `RealtimeService` en cada mutación de Finding/Activity/Resolution/Validation sería invasivo para FASE 11. Carga inicial vía Server Component (Prisma directo, sin fetch), refrescos posteriores vía hook con fetch polling. Puerta abierta: si fase futura necesita push, agregar evento `analytics:update` sin rediseño.

### 5. Librería de charts
**Decisión**: Recharts  
**Por qué**: React 19 compatible, 100% declarativo sobre SVG, curva de aprendizaje baja, estándar de facto. Alternativas descartadas: visx (bajo nivel), nivo (pesado), Chart.js (imperativo/canvas), tremor (wrapper innecesario).

### 6. Ruta del dashboard
**Decisión**: `/dashboard/analytics`, no `/analytics`  
**Por qué**: La raíz `/` está tomada por rewrite a `public/app.html` (PWA offline). Dashboard vive en App Router real. Patrón: páginas admin/internas en `/dashboard/*`.

## KPIs & Métricas

| Métrica | Fuente | Lógica |
|---------|--------|--------|
| **Total** | `Finding.count()` | Hallazgos activos (no deleted) en rango de fechas |
| **Abiertos** | `FindingStatus NOT IN (CLOSED, VALIDATED)` | Total - Cerrados |
| **Cerrados** | `FindingStatusHistory.count(toStatus IN [CLOSED, VALIDATED])` | Con transición a estado cerrado registrada |
| **Tiempo resolución (días)** | `(toStatus_changedAt - Finding.createdAt) / 86400000` | Promedio de días entre creación y cierre; calculado en memoria |
| **Tasa validación** | `Validation.count(PASS) / (PASS + FAIL) * 100` | Excluyendo PENDING |
| **Creados (serie)** | `Finding.createdAt` agrupado por día/semana | Volumen de intake |
| **Cerrados (serie)** | `FindingStatusHistory.changedAt (toStatus cerrado)` agrupado | Volumen de resolución |
| **Funnel resolución** | `Resolution.count() by state` | Progresión de OPEN → CLOSED |

## Datos de prueba

Para probar localmente, después de hacer `/test-import`, usar URL como:

```
GET /dashboard/analytics?from=2026-07-01T00:00:00Z&to=2026-08-10T23:59:59Z&status=OPEN,IN_PROGRESS
```

O simplemente navegar a `/dashboard/analytics` (último 30 días por defecto del DateRangeFilter).

## Próximos pasos (FASE 12+)

1. **Advanced Search** (Elasticsearch): Indexar findings para full-text search con facetas
2. **Mobile App** (React Native): Sincronización con API existente + offline + push
3. **Webhooks**: Emitir eventos en ciclo de vida de findings para integraciones 3rd-party
4. **Real-time push** (Socket.io): Refrescar dashboard instantáneamente en vez de polling 60s
5. **Exportación**: CSV/PDF de métricas con rango de fechas
6. **Dashboards avanzados**: Comparativas multi-proyecto, proyecciones de cierre, SLA tracking

## Cambios en schema

Se agregaron 3 índices compuestos en `prisma/schema.prisma`:
- `Finding@@index([createdAt, status])` — optimiza agregaciones por rango de fecha + status
- `FindingStatusHistory@@index([toStatus, changedAt])` — optimiza cálculo de lead time
- `Validation@@index([result, validatedAt])` — optimiza tasa de validación

Migración: `npx prisma migrate dev --name add_analytics_indexes`

## Bug fix colateral

Se corrigió un bug preexistente en `FindingService.getStatistics()`: la desestructuración `[byStatus, byPriority, bySeverity, byArea, total, unassigned]` no coincidía con la cantidad de promesas en `Promise.all` (6 nombres para 5 elementos), causando que `byArea` reciba el valor de `total` real. Se corrigió renombrando a `[byStatus, byPriority, bySeverity, unassigned, total]` (5 nombres, orden correcto); `byArea` se calcula aparte y correctamente.

## Build & Deploy

**Compilación**: ✅ `npm run build` — 42s, sin errores  
**Dev server**: ✅ `npm run dev` — inicia en puerto 3001, Turbopack activo  
**Dependencias nuevas**: `recharts@^2.12.7`, `date-fns@^3.6.0`  
**Compatibilidad**: React 19, Next.js 16.3, Prisma 7.9.1

---

**Autor**: Claude Code (asistente IA)  
**Última actualización**: 2026-08-10  
**Estado de FASE 11**: ✅ COMPLETADA
