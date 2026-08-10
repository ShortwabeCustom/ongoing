# 🗺️ ROADMAP — Pruebas María 2.0

**Status**: FASE 14 en progreso | **Horizonte**: FASE 15+

---

## 📊 Visión General

```
FASE 1-4  ✅ Data model + CRUD
FASE 5-6  ✅ Frontend + Workflows
FASE 7    ✅ Auth + RBAC (6 roles)
FASE 8    ✅ PWA + Offline Sync
FASE 9    ✅ Push Notifications
FASE 10   ✅ Real-time Collaboration (Socket.io)
FASE 11   ✅ Analytics Dashboard
FASE 12   ✅ Advanced Search (Elasticsearch)
FASE 13   ✅ Mobile Optimization (Touch-first)
FASE 14   🚀 Advanced Filters & Batch Actions (Backend ✅, Frontend next)
FASE 15   📅 (En planeación)
FASE 16   📅 (En planeación)
```

---

## 🚀 FASE 14 — Advanced Filters & Batch Actions

**Status**: Backend ✅ | Frontend 📋  
**Duración Esperada**: 10 horas (frontend)  
**Próxima Sesión**: Implementar UI

### Scope Backend ✅
- [x] SearchQuerySchema expandido (multi-select, date range, hasEvidence)
- [x] Elasticsearch aggregations (facets)
- [x] Lookup API
- [x] Bulk-update con transacciones
- [x] evidenceCount field

### Scope Frontend 📋
- [ ] AdvancedFilterPanel (multi-select, date picker, checkboxes)
- [ ] BatchActionsToolbar (bulk edit UI)
- [ ] FilterPreview (renderizar criterios activos)
- [ ] SearchHistory (IndexedDB)
- [ ] 3 hooks (useBatchActions, useSearchHistory, useSavedFilters)
- [ ] Integración en SearchFindings + SearchResultItem

### Bloqueantes
- ⚠️ Fix RBAC en `bulk-update/route.ts` (15 min)
- ⚠️ Fix `hasEvidence` sync en Elasticsearch (10 min)

---

## 📅 FASE 15 — Export & Reporting (Propuesto)

**Duración Estimada**: 6-8 horas

### Scope
- Export findings (CSV, JSON, PDF)
- Reportes personalizables (resumen por status, severity, etc)
- Scheduled reports via email
- Dashboard de reportes históricos

### Componentes Nuevos
- `ExportDialog.tsx` (formato + filtros)
- `ReportBuilder.tsx` (editor visual)
- `ReportScheduler.tsx` (cron jobs)
- `ReportHistory.tsx` (histórico)

### APIs Nuevas
- `POST /api/findings/export`
- `POST /api/reports`
- `GET /api/reports` (histórico)

### Decisiones de Diseño
- Usar `sheetjs` para Excel
- `pdfkit` para PDF
- Cron jobs en `node-schedule`
- Respetar RBAC en exports

---

## 📅 FASE 16 — Integration & External APIs (Propuesto)

**Duración Estimada**: 8-10 horas

### Scope
- Webhook integrations (Slack, Teams, GitHub)
- API REST pública con API keys
- Bi-directional sync (recibir updates de sistemas externos)
- GraphQL API option

### Componentes Nuevos
- `WebhookConfig.tsx` (UI para webhooks)
- `IntegrationMarketplace.tsx` (catálogo)

### APIs Nuevas
- `POST /api/webhooks`
- `GET /api/integrations`
- `POST /api/api-keys`

### Decisiones de Diseño
- Usar `node-cron` para retry logic
- Signed webhooks (HMAC-SHA256)
- Rate limiting (100 req/min)
- Audit log en BD

---

## 📅 FASE 17 — AI-Assisted Analysis (Propuesto)

**Duración Estimada**: 12-15 horas

### Scope
- Clasificación automática de severity (ML)
- Generador de recomendaciones (AI)
- Búsqueda semántica (embeddings)
- Resumen automático de findings

### Integración
- OpenAI API (GPT-4)
- Hugging Face (clasificación local)
- Chromadb (vector search)

### Componentes Nuevos
- `AIAnalysisPanel.tsx` (UI)
- `RecommendationCard.tsx`
- `SemanticSearch.tsx`

### APIs Nuevas
- `POST /api/ai/classify`
- `POST /api/ai/recommend`
- `GET /api/ai/search-semantic`

---

## 🎯 Priorización

### Critical Path (Blocker)
1. **FASE 14 Frontend** — Depende de backend ya hecho
2. **RBAC fixes** — Bloqueante de seguridad

### High Priority (1-2 semanas)
1. **FASE 15 Export** — Usuarios piden poder exportar
2. **Dark Mode** — FASE 13/14 sin dark classes, bajo costo

### Medium Priority (1 mes)
1. **FASE 16 Integrations** — Conectar con sistemas externos
2. **Mobile App** — React Native mirror de web

### Nice to Have (2+ meses)
1. **FASE 17 AI** — Análisis inteligente
2. **Multi-tenant** — Soportar múltiples organizaciones

---

## 🔄 Ciclo Iterativo

Cada FASE sigue este patrón:

1. **Master Prompt** — Especificación detallada
2. **Backend** — APIs, validación, seguridad
3. **Frontend** — UI, hooks, integración
4. **Testing** — Manual + automated
5. **Documentation** — README + guides
6. **Commit** — Feature complete + merge

**Tiempo promedio por FASE**: 3-5 horas

---

## 📊 Tech Debt

### Known Issues
- [ ] Dark mode no aplicada en SearchFindings
- [ ] Elasticsearch índices sin reindex strategy
- [ ] No hay rate limiting en APIs públicas
- [ ] Test coverage <70% (meta: 85%)

### Future Refactoring
- [ ] Consolidar SearchService + LookupService
- [ ] Extraer validation schemas a package
- [ ] Mejorar error handling en API routes
- [ ] Añadir middleware de logging

---

## 🏆 Success Criteria por FASE

### FASE 14 ✅
- [ ] Backend 100% implementado
- [ ] Frontend: 4 componentes + 3 hooks
- [ ] Build sin errores
- [ ] Manual testing completo
- [ ] Documentation actualizada

### FASE 15 📅
- [ ] Export CSV/JSON/PDF funcional
- [ ] Reports schedulable
- [ ] RBAC enforced en exports
- [ ] Performance: export <5s para 1000 records

### FASE 16 📅
- [ ] Webhooks enviando payloads
- [ ] API pública documentada
- [ ] API keys con rate limiting
- [ ] Integración con Slack/Teams verificada

---

## 🔗 Dependencias Externas

| Dependencia | Versión | Uso | Status |
|-------------|---------|-----|--------|
| Elasticsearch | 8.11.0 | Full-text search | ✅ |
| PostgreSQL | 14+ | Data persistence | ✅ |
| Lucia | 3.2.2 | Authentication | ✅ |
| Socket.io | Latest | Real-time | ✅ |
| Prisma | 7.9.1 | ORM | ✅ |
| Next.js | 16.3 | Framework | ✅ |
| React | 19 | UI | ✅ |
| Tailwind CSS | v4 | Styling | ✅ |

**Nuevas en futuro**:
- [ ] OpenAI API (FASE 17)
- [ ] Hugging Face (FASE 17)
- [ ] Chromadb (FASE 17)
- [ ] node-schedule (FASE 15)
- [ ] sheetjs (FASE 15)

---

## 📈 Métricas Proyectadas

| Métrica | Actual | Meta |
|---------|--------|------|
| Lines of Code | ~8,000 | 15,000 |
| Test Coverage | 70% | 85% |
| Build Time | 46s | <60s |
| API Endpoints | 25+ | 40+ |
| Components | 40+ | 60+ |
| Hooks | 25+ | 35+ |

---

## 🎓 Lecciones Aprendidas

### Éxitos
- ✅ Documentación exhaustiva acelera próximas fases
- ✅ Master prompts reutilizables
- ✅ Arquitectura modular facilita agregación de features
- ✅ RBAC desde early phases evita refactoring

### Mejoras
- ⚠️ Agregar dark mode desde inicio
- ⚠️ Escribir tests mientras codificas
- ⚠️ Usar feature branches para FASEs grandes
- ⚠️ Communicar bloqueantes temprano

---

## 🚀 Próximas Acciones

### Inmediato (Hoy)
- [x] Documentación FASE 14 consolidada
- [ ] Fix RBAC en bulk-update
- [ ] Fix hasEvidence en ES

### Corto Plazo (Esta semana)
- [ ] FASE 14 Frontend (10h)
- [ ] Testing completo
- [ ] Merge + documentación

### Mediano Plazo (Próximas 2 semanas)
- [ ] Planificar FASE 15
- [ ] Design mockups si aplica
- [ ] Crear master prompt

---

**Última actualización**: 2026-08-10  
**Próxima revisión**: Post FASE 14 completion
