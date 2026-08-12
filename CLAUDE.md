# 📖 Project Instructions — Pruebas María 2.0

**Última actualización**: 2026-08-12  
**Versión**: FASE 14 ✅ + UI Redesign ✅  
**Status**: 🚀 PRODUCTION LIVE  
**Idioma**: 🇪🇸 Español

---

## 🎯 Resumen del Proyecto

**Pruebas María 2.0** es una plataforma de gestión de hallazgos de seguridad (findings) con:
- ✅ Búsqueda avanzada (Elasticsearch)
- ✅ Filtros multi-select + date range
- ✅ Acciones batch (editar múltiples findings)
- ✅ Mobile-optimized (bottom-sheet, 44x44px targets)
- ✅ RBAC (6 roles con permisos granulares)
- ✅ Real-time collaboration (Socket.io)
- ✅ Push Notifications
- ✅ PWA con offline sync

---

## 📚 Documentación

**IMPORTANTE**: Toda la documentación ha sido reorganizada en `/docs/`

### Acceso Rápido
- **👉 Lee primero**: [docs/QUICK_START.md](./docs/QUICK_START.md) (5 min)
- **📖 Índice maestro**: [docs/README.md](./docs/README.md)
- **📋 FASE actual**: [docs/PHASES/FASE_14.md](./docs/PHASES/FASE_14.md)
- **🔧 Guías prácticas**: [docs/GUIDES/](./docs/GUIDES/)

### Contenidos por Carpeta

| Carpeta | Contenido |
|---------|-----------|
| `/docs/PHASES/` | FASE 13, FASE 14, ROADMAP futuro |
| `/docs/GUIDES/` | RBAC Testing, Setup, Troubleshooting |
| `/docs/ARCHIVE/` | FASE 1-8 (referencia histórica) |

---

## 🛠️ Stack Actual

**Frontend**: React 19 + Next.js 16.3 + Tailwind CSS v4 + TypeScript  
**Backend**: Node.js + Prisma 7.9.1 + Lucia 3.2.2 (auth)  
**Database**: PostgreSQL (transactional) + Elasticsearch 8.11.0 (search)  
**Storage**: Cloudflare R2 (evidence) + IndexedDB (offline)  
**Real-time**: Socket.io + Redis

---

## 🚀 Acciones Comunes

### Iniciar Desarrollo
```bash
npm run dev
# → http://localhost:3001
```

### Build + Verificar
```bash
npm run build     # Compilar
npm run lint      # Linter
npm run test      # Tests (si existen)
```

### Database
```bash
npx prisma migrate dev  # Nueva migración
npx prisma studio      # GUI (localhost:5555)
```

### Git
```bash
git status
git add .
git commit -m "mensaje"
git push
```

---

## 📋 Preferencias de Trabajo

### Idioma
- **Español** (español en español, inglés en código)

### Estilo de Respuesta
- **Terse**: Respuestas cortas y directas
- **Sin trailing summaries**: No resumes al final
- **Acción primero**: Implementa primero, documenta después

### Patrón de Trabajo
1. Lee docs / especificación
2. Entiende scope
3. Activa skill recomendada (`/frontend-developer`, etc)
4. Implementa
5. Test
6. Commit + push

### Commits
- Usar patrón: `feat(module): descripción corta`
- Ej: `feat(search): implement advanced filters UI`
- Incluir: `Co-Authored-By: Claude ...`

---

## 📅 Session History

### Session 3 (2026-08-12) — UI Redesign & Deployment ✅

**Commits**: `bec6e76`  
**Status**: DEPLOYED TO PRODUCTION

**Cambios implementados**:
1. ✅ Finding detail page: 1 giant card → **8 independent cards**
2. ✅ i18n fixes: 13+ English strings → Spanish
3. ✅ Design consistency: All colors → `pm-*` tokens
4. ✅ Typography: Unified headers `text-xl font-bold`
5. ✅ Metadata grid: Added 8 lucide-react icons (MapPin, Flag, AlertTriangle, etc.)
6. ✅ Bug fixes: Removed duplicate description, fixed hardcoded English UI

**Deployment**:
- Build: ✅ Success (exit 0)
- Lint: ✅ Pass (no new errors)
- DB Migrations: ✅ Applied
- PM2 Restart: ✅ Online (PID 2945854)
- Live: https://uix.torrax.cloud/findings ✅

**See**: [CHANGELOG_SESSION3.md](./CHANGELOG_SESSION3.md) for detailed changes

### Previous Sessions
- **Session 1A/1B** (2026-08-10/11): FASE 14 implementation + infrastructure setup
- See `docs/PHASES/` for historical phases

---

## 🎯 Próximas Acciones (Futuro)

**Backlog**:
- [ ] Dark mode support (extend `pm-*` tokens)
- [ ] Screenshot evidence migration completion
- [ ] Batch export feature (PDF download)
- [ ] Mobile testing (375px, 768px viewports)
- [ ] Performance optimization for large finding lists
- [ ] Enhanced search analytics

**Current Phase**: ✅ COMPLETE  
**Next Priority**: Community feedback, monitoring, optimization

---

## 📞 Contacto & Referencias

- **Usuario**: Alexis (alexis.pro_sk8@hotmail.com)
- **Proyecto**: Pruebas María 2.0
- **Rama**: `master` (main branch)
- **Status**: FASE 14 en progreso

---

## 🔗 Links Rápidos

- [docs/README.md](./docs/README.md) — Índice completo
- [docs/QUICK_START.md](./docs/QUICK_START.md) — Setup 5 pasos
- [docs/PHASES/FASE_14.md](./docs/PHASES/FASE_14.md) — FASE actual
- [docs/GUIDES/DEVELOPMENT_SETUP.md](./docs/GUIDES/DEVELOPMENT_SETUP.md) — Setup detallado
- [docs/GUIDES/TROUBLESHOOTING.md](./docs/GUIDES/TROUBLESHOOTING.md) — Resolver problemas

---

**¿Listo?** → Abre [docs/QUICK_START.md](./docs/QUICK_START.md)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
