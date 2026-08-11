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

### 🔧 Guías Prácticas
- **[RBAC Testing Guide](./guides/rbac_testing.md)** — 5 endpoints + checklist de seguridad
- **[Development Setup](./guides/development_setup.md)** — PostgreSQL, env vars, seeds
- **[Troubleshooting](./guides/troubleshooting.md)** — npm, build, database issues

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

### Session 2: Deployment 🚀

**Objetivo**: Desplegar a producción

**Documentación**: Ver [doc./session_2/](./session_2/)
- `MASTER_PROMPT_SESSION_2.md` — Plan de deployment 4 fases
- `NEXT_SESSION_CHECKLIST.md` — Checklist pre-deploy

---

## 🗂️ Estructura de Documentación

```
docs/
├── README.md                    # ← Estás aquí (índice maestro)
├── QUICK_START.md              # Setup 5 pasos + desarrollo
├── FINAL_DEPLOYMENT_GUIDE.md   # Guía completa deployment
├── ARCHITECTURE.md             # Arquitectura del sistema
├── SECURITY_CHECKLIST.md       # Checklist de seguridad
├── PRODUCTION_RUNBOOK.md       # Playbook incident response
├── PRODUCTION_STATUS.md        # Status de producción
├── RESUMEN_AVANCES_2026-08-11.md # Estado actual (completo)
├── SESSION_2/
│   ├── MASTER_PROMPT_SESSION_2.md
│   └── NEXT_SESSION_CHECKLIST.md
├── PHASES/
│   ├── FASE_13.md             # Mobile Optimization ✅
│   ├── FASE_14.md             # Advanced Filters ✅
│   └── ROADMAP.md             # Próximas fases
├── GUIDES/
│   ├── RBAC_TESTING.md        # Testing con 5 roles
│   ├── DEVELOPMENT_SETUP.md   # Setup local
│   └── TROUBLESHOOTING.md     # Resolución de problemas
└── ARCHIVE/                   # Histórico (FASE 1-13, etc)
```

---

## 🔑 Datos de Configuración

### PostgreSQL
```bash
BD: pruebas_maria_dev
User: torrax_user
Password: TorraxDev123!
Host: localhost:5432
DATABASE_URL=postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev?schema=public
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
- doc./quick_start.md           (5 min)
- doc./phases/fase_14.md        (10 min si es FASE 14)
```

### 2️⃣ Verifica Setup
```bash
# PostgreSQL corriendo
psql postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev -c "SELECT COUNT(*) FROM users;"

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

Los documentos de FASE 1-8 se encuentran en **[ARCHIVE/](./archive/)**:
- `FASE_1_SUMMARY.md`
- `FASE4_COMPLETE.md`
- `FASE7_COMPLETION.md`
- `FASE8_IMPLEMENTATION_GUIDE.md`
- `SESSION_2026_08_09_SUMMARY.md`
- y más...

**Acceso**: Solo consulta si necesitas referencia histórica o contexto de decisiones antiguas.

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

## ✨ Session 2: Deployment

**FASE 14 está COMPLETA. Próximo paso: Desplegar a producción.**

**Pasos**:
1. Obtener credenciales Cloudflare R2
2. Actualizar GitHub Secrets (3-5 valores)
3. Ejecutar deployment (Docker/PM2/Vercel)
4. Verificar en producción

**Duración estimada**: 90 min

**Documentos clave**:
- [MASTER_PROMPT_SESSION_2.md](./session_2/MASTER_PROMPT_SESSION_2.md) — Plan 4 fases
- [FINAL_DEPLOYMENT_GUIDE.md](./final_deployment_guide.md) — Guía paso a paso

---

## 📝 Notas

- **Cambio de idioma**: Todo en **Español** (persistido en memory)
- **Estilo de trabajo**: Terse responses, sin trailing summaries
- **Patrón**: Leer docs → entender scope → `/skill` → implementar → test → commit

---

**Documentación optimizada**: 2026-08-11  
**Última revisión**: 2026-08-11  
**Estado**: FASE 14 ✅ | Production Ready 🚀
