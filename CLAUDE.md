# 📖 Project Instructions — Pruebas María 2.0

**Última actualización**: 2026-08-10  
**Versión**: FASE 14 (Advanced Filters & Batch Actions)  
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

## ⚠️ Bloqueantes Actuales (FASE 14)

1. **RBAC en bulk-update** (15 min)
   - Archivo: `app/api/findings/bulk-update/route.ts`
   - Problema: Sin `checkRBAC()` — cualquiera puede modificar
   - Fix: Agregar validación RBAC

2. **hasEvidence no synced** (10 min)
   - Problema: Field nuevo en Elasticsearch, índices antiguos sin valor
   - Fix: Regenerar índice

---

## 🎯 FASE 14 Próximas Acciones

**Bloqueantes primero** (25 min):
1. Fix RBAC + hasEvidence
2. Build + verify

**Después** (10h):
- Implementar 4 componentes React
- Crear 3 hooks
- Integrar en SearchFindings
- Testing completo

**Master Prompt**: Seguir `FASE14_MASTER_PROMPT.md`  
**Skill**: `/frontend-developer`

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
