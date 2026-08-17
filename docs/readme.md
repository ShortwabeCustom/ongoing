# 📚 Pruebas María 2.0 — Documentación Completa

**Última Actualización**: 2026-08-11  
**Versión del Proyecto**: FASE 14 (Advanced Filters & Batch Actions) ✅  
**Status**: PRODUCTION READY 🚀 | Deployment Session 2

---

## 🎯 Acceso Rápido

### 🚀 Para Nuevas Sesiones
👉 **[QUICK_START.md](./quick_start.md)** — Setup en 5 pasos + próximos pasos

### 📖 Documentación por FASE
- **FASE 13** ✅ [Mobile Optimization](./phases/fase_13.md) — Touch-first, responsive debounce, bottom-sheet
- **FASE 14** ✅ [Advanced Filters & Batch](./phases/fase_14.md) — Backend ✅ | Frontend ✅ | Production Ready
- **ROADMAP** 🛣️ [Próximas Fases](./phases/roadmap.md) — FASE 15+ planeado

### 🏛️ Decisiones de Arquitectura (ADR)
- **ADR-001** ✅ Accepted — [Evidence Storage and Authorized File Delivery (P1-B)](./DECISIONS/ADR-001-evidence-storage-and-authorized-file-delivery.md) — diseño aprobado, **no implementado todavía**

### 🔧 Guías Prácticas

**Getting Started (SETUP)**
- **[Quick Start](./SETUP/quick_start.md)** — Setup en 5 pasos (15 min)
- **[Command Reference](./reference/command_reference.md)** — Common commands & patterns
- **[Development Setup](./SETUP/development_setup.md)** — PostgreSQL, env vars, seeds

**Operations (OPERATIONS)**
- **[Deployment Guide](./OPERATIONS/deployment.md)** — Deploy a producción
- **[Production Runbook](./OPERATIONS/production_runbook.md)** — Incident response
- **[RBAC Testing](./OPERATIONS/rbac_testing.md)** — Testing de permisos
- **[Troubleshooting](./OPERATIONS/troubleshooting.md)** — Resolución de problemas

---

## 📊 Tech Stack Actual (FASE 14)

| Categoría | Stack |
|-----------|-------|
| **Frontend** | React 19 + Next.js 16.3 + Tailwind CSS v4 + TypeScript |
| **Backend** | Node.js + Prisma 7.9.1 + Lucia 3.2.2 (auth) |
| **Database** | PostgreSQL (16 tablas) + Elasticsearch 8.11.0 |
| **Storage** | Cloudflare R2 (evidence) + IndexedDB (offline) |
| **Real-time** | Socket.io + Redis (collaboration) |
| **Search** | Elasticsearch (full-text) + boolean queries + aggregations |
| **Notifications** | Web Push API + Service Workers |
| **Auth** | Lucia 3.2.2 + RBAC (6 roles) + Argon2id hashing |

---

## ✅ Estado Actual por FASE

### Completadas ✅

| FASE | Tema | Commit | Fecha |
|------|------|--------|-------|
| 1-4 | Data model + CSV import + CRUD | d9c8b6f | Ago 2 |
| 5-6 | Frontend + Workflows | - | Ago 3 |
| 7 | Auth (Lucia) + RBAC (6 roles) | 043fe5e | Ago 9 |
| 8 | PWA + Offline Sync | e8e9f44 | Ago 9 |
| 9 | Push Notifications (Web Push API) | 7fd221c | Ago 9 |
| 10 | Real-time Collaboration (Socket.io + Redis) | - | Ago 9 |
| 11 | Analytics Dashboard (KPIs, Charts, Filtros) | - | Ago 10 |
| 12 | Advanced Search (Elasticsearch) | 32fa909 | Ago 10 |
| 13 | Mobile Optimization (Touch-first) | 6739ab5 | Ago 10 |

---

## 🗂️ Estructura de Documentación

```
docs/
├── README.md                       # ← Estás aquí (índice maestro)
│
├── SETUP/                          # Getting started & development
│   ├── quick_start.md             # Setup en 5 pasos (15 min)
│   ├── development_setup.md       # Configuración local
│   ├── github_secrets_setup.md    # CI/CD secrets
│   ├── components.md              # Component reference
│   ├── routing.md                 # Next.js routing patterns
│   ├── styling.md                 # Tailwind CSS patterns
│   └── typescript.md              # TypeScript conventions
│
├── OPERATIONS/                     # Running & maintaining
│   ├── deployment.md              # Deploy a producción
│   ├── production_status.md       # Monitor system health
│   ├── production_runbook.md      # Incident response playbook
│   ├── troubleshooting.md         # Troubleshooting guide
│   ├── rbac_testing.md            # RBAC validation
│   └── security_checklist.md      # Pre-deploy security checks
│
├── DECISIONS/                      # Architecture Decision Records (ADR)
│   └── ADR-001-evidence-storage-and-authorized-file-delivery.md
│
├── PHASES/
│   ├── FASE_13.md                 # Mobile Optimization ✅
│   ├── FASE_14.md                 # Advanced Filters ✅
│   └── ROADMAP.md                 # Próximas fases
│
├── backend/                        # Backend technical docs
├── frontend/                       # Frontend technical docs
│
├── ARCHIVE/                        # Historical documentation
│   ├── FASE summaries (FASE_1_SUMMARY, etc)
│   ├── BUGFIX_SUMMARY.md          # Session 4 critical bug fix
│   ├── CHANGELOG_*.md             # Feature changelogs
│   └── session-reports/           # Session deliverables
│       ├── AUDIT_IMPORT_*.md
│       ├── ETL_IMPORT_*.md
│       └── IMPORT_COMPLETION_*.md
│
└── reference/                      # Additional resources
```

---

## 🔑 Datos de Configuración

### PostgreSQL
```bash
BD: pruebas_maria_dev
User: torrax_user
Password: <DEV_DB_PASSWORD>
Host: localhost:5432
DATABASE_URL=postgresql://torrax_user:<DEV_DB_PASSWORD>@localhost:5432/pruebas_maria_dev?schema=public
```

### Test Users (6 roles)
```
owner@test.local           → OWNER
qa-lead@test.local         → QA_LEAD
designer@test.local        → DESIGNER
developer@test.local       → DEVELOPER
business@test.local        → BUSINESS_REVIEWER
viewer@test.local          → VIEWER

Password: TestPassword123
```

### Elasticsearch
```bash
URL: http://localhost:9200
Index: findings-v1
Status: docker-compose ps
```

### Development Server
```bash
npm run dev
# → http://localhost:3001
# → Turbopack enabled (46s build)
```

---

## 📋 Matriz de Permisos RBAC

| Rol | Acciones |
|-----|----------|
| **OWNER** | Todas las acciones + administración |
| **QA_LEAD** | Editar/eliminar findings, confirmar importes, cambiar estado resoluciones |
| **DESIGNER** | Crear findings, ver analytics |
| **DEVELOPER** | Crear findings, subir evidencia |
| **BUSINESS_REVIEWER** | Ver todos findings, ver analytics |
| **VIEWER** | Ver findings asignados únicamente |

---

## 🚀 Para Comenzar Nueva Sesión

### 1️⃣ Lee Primero
```markdown
- SETUP/quick_start.md           (15 min)
- phases/fase_14.md              (10 min si es FASE 14)
```

### 2️⃣ Verifica Setup
```bash
# PostgreSQL corriendo
psql postgresql://torrax_user:<DEV_DB_PASSWORD>@localhost:5432/pruebas_maria_dev -c "SELECT COUNT(*) FROM users;"

# Elasticsearch corriendo
curl http://localhost:9200/_cluster/health

# Dev server
npm run dev
# → http://localhost:3001
```

### 3️⃣ Activa Skill Recomendada
```
/frontend-developer     # Para FASE 14 Frontend
/senior-fullstack       # Para features completas
```

### 4️⃣ Revisa Blockers & PRs
```bash
git status
git log --oneline -10
# Verificar si hay cambios sin commitear
```

---

## 📚 Documentación Antigua (Archivada)

**FASE 1-12 historical docs**: [ARCHIVE/](./archive/)
- FASE summaries, implementation guides, session summaries
- Consulta solo si necesitas contexto histórico

**Session Reports**: [ARCHIVE/session-reports/](./archive/session-reports/)
- `AUDIT_IMPORT_PHASE_1_3.md` — Import validation audit
- `ETL_IMPORT_REPORT_2026-08-13.md` — Session 6 ETL import (205 findings)
- `IMPORT_COMPLETION_REPORT.md` — Import operations final status

**Technical History**: [ARCHIVE/](./archive/)
- `BUGFIX_SUMMARY.md` — Session 4 critical bug fix (React #441)
- `CHANGELOG_DYNAMIC_REPORT.md` — Session 5 public report feature
- `CHANGELOG_FASE_3_4.md` — FASE 3-4 changes

**Acceso**: Consulta solo si necesitas referencia histórica o contexto de decisiones antiguas.

---

## 📈 Métricas de Proyecto

| Métrica | Valor |
|---------|-------|
| **Líneas de código** | ~8,000+ |
| **Archivos de componentes** | 40+ |
| **Endpoints API** | 25+ |
| **Test coverage** | 70%+ (objetivo) |
| **Build time** | 46s (Turbopack) |
| **Database tables** | 16 |
| **Elasticsearch indices** | 1 (findings-v1) |

---

## 🔗 Referencias Cruzadas

- **Memory**: Revisar `/root/.claude/projects/-var-www-uix-torrax-cloud/memor./memory.md`
- **Git history**: `git log --oneline | head -20`
- **Current branch**: `git branch -v`
- **Status**: `git status`

---

## 🚀 Próximas Acciones

**FASE 14 está COMPLETA ✅**

**Para desplegar cambios**:
- Revisa: [OPERATIONS/deployment.md](./OPERATIONS/deployment.md)
- Validate: [OPERATIONS/security_checklist.md](./OPERATIONS/security_checklist.md)
- Monitor: [OPERATIONS/production_status.md](./OPERATIONS/production_status.md)

---

## 📝 Notas

- **Cambio de idioma**: Todo en **Español** (persistido en memory)
- **Estilo de trabajo**: Terse responses, sin trailing summaries
- **Patrón**: Leer docs → entender scope → `/skill` → implementar → test → commit

---

**Documentación reorganizada**: 2026-08-13 (Option A: DDD-based structure)
**Última revisión**: 2026-08-13  
**Estado**: FASE 14 ✅ | Production Ready 🚀 | Documentation refactored
