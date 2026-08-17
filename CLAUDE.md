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
| `/docs/OPERATIONS/` | **Deployment, Production mode, Incidents** ⚠️ |
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

### Production Deployment ⚠️ CRITICAL

**IMPORTANTE**: Leer ANTES de cualquier deployment a producción.

**Quick Start**:
```bash
npm run build          # Verificar build
pm2 start ecosystem.config.js  # START con ecosystem config
pm2 save              # Guardar estado
```

**Verification**:
```bash
# Verificar chunks (CRITICAL CHECK)
#
# Notas (P0-B, 2026-08-17, ver auditoria.md §10-§12):
# - Se usa /login en vez de /findings: /findings ahora exige sesión por diseño
#   (redirect 307 -> /login para anónimos), así que un curl anónimo ya no ve el
#   chunk embebido en esa ruta. /login es pública y estática.
# - Hostname CANÓNICO real de producción: uix.productdesign.mx (único server_name
#   configurado en nginx, único hostname con certificado TLS válido — verificado
#   contra /etc/nginx/sites-enabled y el certificado servido, no asumido de la doc).
#   uix.torrax.cloud resuelve por DNS a este mismo host pero NO tiene vhost ni
#   certificado propios: cualquier cliente TLS estricto (curl sin -k, navegadores)
#   falla ahí con "no alternative certificate subject name matches". No usar ese
#   hostname para verificación — ver hallazgo operativo abajo.
# - La versión anterior de este check tenía un bug de `sed`: extraía el hash del
#   fichero local (`ACTUAL`) pero NO le quitaba el prefijo "page-" al hash servido
#   (`SERVED`), así que comparaba "abc123..." contra "page-abc123..." y SIEMPRE
#   daba MISMATCH, incluso con un deploy perfecto. Corregido abajo: ambos lados se
#   normalizan igual, y el script devuelve exit code != 0 en caso de mismatch real
#   (antes el comando de una sola línea nunca fallaba con código de salida != 0).
bash -c '
set -euo pipefail
HOST="https://uix.productdesign.mx"
LOCAL_FILE=$(ls .next/static/chunks/app/login/page-*.js 2>/dev/null | head -1)
if [ -z "$LOCAL_FILE" ]; then echo "❌ No hay build local (.next/static/chunks/app/login/page-*.js)"; exit 1; fi
ACTUAL=$(basename "$LOCAL_FILE" .js | sed "s/^page-//")
HTML=$(curl -fsS "$HOST/login") || { echo "❌ No se pudo obtener $HOST/login"; exit 1; }
SERVED=$(echo "$HTML" | grep -oE "/_next/static/chunks/app/login/page-[a-f0-9]+\.js" | head -1 | sed -E "s#.*/page-([a-f0-9]+)\.js#\1#")
if [ -z "$SERVED" ]; then echo "❌ No se encontró chunk page-*.js de /login en la respuesta"; exit 1; fi
if [ "$ACTUAL" = "$SERVED" ]; then echo "✅ OK (chunk $ACTUAL)"; exit 0; else echo "❌ MISMATCH (local=$ACTUAL servido=$SERVED)"; exit 1; fi
'
```

**Hallazgo operativo separado (no corregido aquí, requiere decisión de infraestructura)**: `uix.torrax.cloud` — el hostname usado en el nombre del proceso pm2 (`uix-torrax-cloud`), en gran parte de la documentación y en `auditoria.md` — **no tiene vhost ni certificado TLS propio configurado en este host**. Resuelve por DNS a la misma IP que `uix.productdesign.mx`, pero nginx solo tiene `server_name uix.productdesign.mx`, así que cualquier petición TLS a `uix.torrax.cloud` recibe el certificado de `uix.productdesign.mx` (único bloque HTTPS configurado, actúa como default implícito del socket 443) y falla la validación en cualquier cliente estricto. No se ha tocado infraestructura para corregir esto — requiere decidir cuál es el dominio de producto real y, si es `uix.torrax.cloud`, emitir un certificado para él (p. ej. `certbot --nginx -d uix.torrax.cloud`) o renombrar todo lo que asume ese hostname.

**⚠️ CRITICAL RULES**:
- ✅ SIEMPRE usar `ecosystem.config.js` para iniciar
- ❌ NUNCA usar `npm run dev` en producción
- ✅ SIEMPRE verificar chunks match después de restart
- 📖 Ver: [docs/OPERATIONS/DEPLOYMENT_CHECKLIST.md](./docs/OPERATIONS/DEPLOYMENT_CHECKLIST.md)

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

### Session 2 (2026-08-14) — Evidence Loading & Status Sync ✅

**Commits**: `c97abf3`, `06090fb`  
**Status**: DEPLOYED TO PRODUCTION

**Cambios implementados**:
1. ✅ **Extracted 206 real PNG images** from Excel file
2. ✅ **Created 204 Evidence records** (100% coverage)
3. ✅ **Synchronized 83 findings** status from Excel checkmarks (41% completion)
4. ✅ **Mapped URLs** to real images for all findings
5. ✅ **Detected completion status** automatically from Excel Column 1

**Scripts creados** (12 total):
- load-evidence-batch.ts (initial 6 evidence)
- bulk-create-evidence.ts (198 additional)
- extract-images-from-excel.ts (206 PNG extraction)
- sync-evidence-status-from-excel.ts (status sync)
- + 8 support/verification scripts

**Evidence Statistics**:
- Total images: 206 PNG files (~25 MB)
- Evidence coverage: 100% (204/204 findings)
- Validated status: 83/204 (41%)
- Storage: /public/evidence-from-excel/

**Deployment**:
- Build: ✅ Success (23s)
- Lint: ✅ Pass
- Image serving: ✅ HTTP 200
- PM2 Restart: ✅ Online
- Live: https://uix.torrax.cloud/findings ✅

**Documentation**:
- [docs/SESSIONS/SESSION_2_EVIDENCE_LOADING.md](./docs/SESSIONS/SESSION_2_EVIDENCE_LOADING.md) — Full session details
- [docs/GUIDES/EVIDENCE_SCRIPTS_REFERENCE.md](./docs/GUIDES/EVIDENCE_SCRIPTS_REFERENCE.md) — Technical reference
- [CHANGELOG_SESSION2.md](./CHANGELOG_SESSION2.md) — Detailed changes

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

### 🚨 Deployment & Operations (CRITICAL)

- [docs/OPERATIONS/DEPLOYMENT_CHECKLIST.md](./docs/OPERATIONS/DEPLOYMENT_CHECKLIST.md) — ⭐ **LEE ANTES DE DEPLOYEAR**
- [docs/OPERATIONS/PRODUCTION_MODE_DEPLOYMENT.md](./docs/OPERATIONS/PRODUCTION_MODE_DEPLOYMENT.md) — Incident report & prevention
- [ecosystem.config.js](./ecosystem.config.js) — PM2 production config (REQUIRED)

---

**¿Listo para deployear?** → Lee [docs/OPERATIONS/DEPLOYMENT_CHECKLIST.md](./docs/OPERATIONS/DEPLOYMENT_CHECKLIST.md) primero

**¿Primer setup?** → Abre [docs/QUICK_START.md](./docs/QUICK_START.md)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
