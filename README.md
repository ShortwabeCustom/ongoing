# 🎯 Pruebas María 2.0

**Plataforma de gestión de hallazgos de seguridad** con búsqueda avanzada, RBAC, real-time collaboration y mobile optimization.

**Status**: FASE 14 (Advanced Filters & Batch Actions) | Backend ✅ | Frontend 🚀

---

## 🚀 Inicio Rápido (5 min)

```bash
# 1. Setup (si es primera vez)
npm install --no-dedupe

# 2. Database
npx prisma migrate dev
npx ts-node scripts/seed-users.ts

# 3. Dev Server
npm run dev
# → http://localhost:3001
```

---

## 📚 Documentación

**👉 [docs/README.md](./docs/README.md)** — Índice completo y estado del proyecto

### Acceso Rápido
- **[QUICK_START.md](./docs/QUICK_START.md)** — Setup en 5 pasos + próximos pasos (⭐ Lee esto primero)
- **[FASE 14](./docs/PHASES/FASE_14.md)** — Especificación actual (backend ✅, frontend próximo)
- **[RBAC Testing](./docs/GUIDES/RBAC_TESTING.md)** — Verificar seguridad en 15 min
- **[Troubleshooting](./docs/GUIDES/TROUBLESHOOTING.md)** — Resolver problemas comunes

### Estructura
```
docs/
├── README.md              # Índice maestro
├── QUICK_START.md         # Setup + próximos pasos
├── PHASES/                # FASE 13, FASE 14, ROADMAP
└── GUIDES/                # RBAC Testing, Setup, Troubleshooting
```

---

## 🛠️ Tecnologías

| Categoría | Stack |
|-----------|-------|
| **Frontend** | React 19 + Next.js 16.3 + Tailwind CSS v4 + TypeScript |
| **Backend** | Node.js + Prisma 7.9.1 + Lucia 3.2.2 (auth) |
| **Database** | PostgreSQL + Elasticsearch 8.11.0 |
| **Storage** | Cloudflare R2 (evidence) + IndexedDB (offline) |
| **Real-time** | Socket.io + Redis |

---

## 💻 Comandos Esenciales

```bash
npm run dev              # Servidor local (localhost:3001)
npm run build            # Build producción
npm run lint             # ESLint

npx prisma migrate dev   # Aplicar/crear migración
npx prisma studio       # GUI base datos (localhost:5555)

npm test                 # Tests (si existen)
```

---

## 📋 Instrucciones del Proyecto

**Lee**: [`CLAUDE.md`](./CLAUDE.md) para reglas, preferencias y bloqueantes actuales.

---

## ✨ Estado Actual

### Completadas ✅
- FASE 1-13: Data model, Auth, PWA, Push Notifications, Search, Mobile Optimization

### En Progreso 🚀
- **FASE 14** (Advanced Filters & Batch Actions)
  - Backend: ✅ Completado
  - Frontend: 📋 Próxima sesión (10h)
  - **Bloqueantes**: Fix RBAC + hasEvidence (25 min)

### Próximas 📅
- FASE 15: Export & Reporting
- FASE 16: Integrations (Slack, GitHub, etc)
- FASE 17: AI-Assisted Analysis

---

## 🔑 Configuración Rápida

### Database (PostgreSQL)
```
URL: postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev
```

### Test Users (6 roles)
```
Email: {owner,qa-lead,designer,developer,business,viewer}@test.local
Password: TestPassword123
```

### Elasticsearch
```
URL: http://localhost:9200
Index: findings-v1
```

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| npm install falla | `npm install --no-dedupe` |
| Database connection error | `npm run dev` corre PostgreSQL? |
| Build falla | `rm -rf .next && npm run build` |
| Port 3001 en uso | `lsof -i :3001` + `kill -9 <PID>` |

**Más**: Ver [docs/GUIDES/TROUBLESHOOTING.md](./docs/GUIDES/TROUBLESHOOTING.md)

---

## 🎯 Próximas Acciones

### Hoy
- [ ] Fix RBAC en bulk-update (15 min)
- [ ] Fix hasEvidence en Elasticsearch (10 min)

### Esta Sesión
- [ ] FASE 14 Frontend (10h)
  - 4 componentes React
  - 3 hooks
  - Testing

---

## 📞 Info & Contacto

- **Usuario**: Alexis (alexis.pro_sk8@hotmail.com)
- **Idioma**: 🇪🇸 Español
- **Última actualización**: 2026-08-10

---

**¿Listo para empezar?** 👉 [docs/QUICK_START.md](./docs/QUICK_START.md)
