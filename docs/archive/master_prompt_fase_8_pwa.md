# MASTER PROMPT — FASE 8 PWA + Offline Sync (Siguiente Sesión)

**Fecha Creada**: 09 Agosto 2026  
**Fase**: 8 de 9  
**Duración Estimada**: 2-3 horas  
**Skill a Usar**: `/senior-fullstack`  
**Prerequisito**: PostgreSQL disponible + RBAC testing completado

---

## CONTEXTO PREVIO (FASE 7.5 Completada)

### Estado Actual
- ✅ RBAC integrado en 5 endpoints (findings, evidence, resolutions)
- ✅ User tracking funcional (user.id en lugar de 'system')
- ✅ Lucia + Argon2 + PostgreSQL session management
- ✅ 6 usuarios de prueba listos (OWNER, QA_LEAD, DESIGNER, DEVELOPER, BUSINESS_REVIEWER, VIEWER)
- ✅ Build exitoso (Turbopack 68s)
- ✅ Migración lista (schema auth en prisma/)
- ✅ Commit: `043fe5e` — feat(rbac)

### Matriz RBAC (6 Roles)
```
OWNER           — Todo (master)
QA_LEAD         — Editar, eliminar, validar
DESIGNER        — Crear, editar, validar
DEVELOPER       — Crear, editar, validar
BUSINESS_REVIEWER — Validar, ver
VIEWER          — Solo lectura
```

---

## OBJETIVO FASE 8

**Implementar PWA con soporte offline completo:**

### Features Requeridas

1. **Service Worker** (`public/sw.js`)
   - Install: cachear assets críticos
   - Fetch: network-first para API, cache-first para assets
   - Sync: procesar queue cuando vuelva online

2. **Offline Storage (IndexedDB)**
   - `findings_cache` — Lista de findings (lectura offline)
   - `sync_queue` — Cambios pendientes (CRUD offline)
   - `metadata` — Last sync timestamp, connection status

3. **Frontend Components**
   - `lib/hooks/useOfflineSync.ts` — Hook para sync queue
   - `components/ui/OfflineIndicator.tsx` — Indicador conexión
   - `lib/services/offline-sync-service.ts` — Procesar queue

4. **API Changes**
   - Header `Idempotency-Key` en todos los mutations
   - Deduplicación de requests concurrentes
   - Transacciones para consistency

---

## DELIVERABLES ESPERADOS

### Backend (3 servicios)

**1. Idempotency Service** (`lib/services/idempotency-service.ts`)
- Deduplicar requests con misma key
- Almacenar resultados de mutations
- TTL: 24 horas

**2. Sync Queue Processor** (`lib/services/sync-queue-processor.ts`)
- Procesar cambios pendientes cuando online
- Retry logic (exponential backoff)
- Logging de fallos

**3. Offline Session Manager** (`lib/services/offline-session-service.ts`)
- Mantener sesión sin red
- Revalidar cuando vuelva online
- Logout si token expiró

### Frontend (5 componentes)

**1. OfflineIndicator.tsx** (30 líneas)
- Icono de conexión en navbar
- Verde: online | Rojo: offline | Amarillo: syncing

**2. SyncQueueViewer.tsx** (50 líneas)
- Modal mostrando cambios pendientes
- Manual retry button
- Progress bar

**3. useOfflineSync.ts Hook** (100 líneas)
- `useSyncQueue()` — Acceder a pending changes
- `useOfflineStatus()` — Conexión status
- `useManualSync()` — Trigger sync manual

**4. useIndexedDB.ts Hook** (80 líneas)
- `getCachedFindings()` — Leer cache
- `addToSyncQueue()` — Queue un cambio
- `clearCache()` — Limpiar

**5. useServiceWorker.ts Hook** (60 líneas)
- Registrar SW
- Escuchar eventos de sync
- Handle notifications

### Scripts

**1. `public/sw.js` (120 líneas)**
- Install event: cachear /api/findings (primeras 100)
- Fetch event: network-first API, cache-first assets
- Background sync: procesar queue

**2. `lib/services/offline-sync-service.ts` (150 líneas)**
- IndexedDB schema
- Queue operations (add, remove, process)
- Retry logic

### Tests (5 test files)

- `__tests__/offline-sync.test.ts`
- `__tests__/idempotency.test.ts`
- `__tests__/service-worker.test.ts`
- `__tests__/useOfflineSync.test.ts`
- `__tests__/useIndexedDB.test.ts`

---

## ARQUITECTURA TÉCNICA

### IndexedDB Schema
```typescript
// Database: "pruebas-maria-offline"
// Version: 1

// Store: findings_cache
{
  keyPath: "id",
  indexes: [
    { name: "status", unique: false },
    { name: "createdAt", unique: false }
  ]
}

// Store: sync_queue
{
  keyPath: "id",
  indexes: [
    { name: "timestamp", unique: false },
    { name: "status", unique: false }
  ]
}

// Store: metadata
{
  keyPath: "key"
  // lastSync, isOnline, sessionToken
}
```

### Sync Queue Item
```typescript
interface SyncQueueItem {
  id: string;              // nanoid()
  endpoint: string;        // "/api/findings/[id]"
  method: "POST"|"PATCH"|"DELETE";
  payload: Record<string, any>;
  idempotencyKey: string;  // uuidv4()
  timestamp: number;       // Date.now()
  status: "pending"|"processing"|"completed"|"failed";
  retries: number;
  error?: string;
  createdAt: Date;
}
```

### API Changes Required

**Header: Idempotency-Key**
```typescript
curl -X PATCH /api/findings/[id] \
  -H "Idempotency-Key: uuid-v4-here" \
  -d '...'
```

**Response: 409 if duplicate**
```json
{
  "code": "DUPLICATE_REQUEST",
  "message": "Request already processed",
  "data": { "cached_response": {...} }
}
```

---

## FLUJO OFFLINE

### Escenario: Usuario edita finding sin internet

```
1. Usuario hace PATCH /findings/[id]
   └─ Detecta offline
   └─ Crea SyncQueueItem con idempotencyKey
   └─ Guarda en IndexedDB sync_queue
   └─ Muestra OfflineIndicator (amarillo)
   └─ Toast: "Cambio guardado. Se sincronizará cuando vuelva online"

2. IndexedDB guarda: timestamp, endpoint, method, payload

3. Usuario vuelve online
   └─ Service Worker recibe evento 'online'
   └─ Dispara background sync
   └─ Procesa queue item
   └─ POST /api/findings/[id] con Idempotency-Key
   └─ Si éxito (200): marca completed, actualiza findings_cache
   └─ Si fallo (409): usa cached response
   └─ Si fallo (otro): retry con backoff exponencial
   └─ Toast: "Sincronizado" o "Error. Reintentando..."

4. Si llega a 3 reintentos:
   └─ Muestra SyncQueueViewer
   └─ Usuario puede retry manual o descartar
```

---

## PREREQUISITOS

### Base de Datos
```bash
# Migrations aplicadas (FASE 7.5)
✅ users table (passwordHash, role)
✅ sessions table (Lucia)

# Nuevos índices (si es needed):
CREATE INDEX idx_users_online_status ON users(onlineStatus);
```

### Dependencias (Ya instaladas)
```json
{
  "lucia": "^3.2.2",
  "@lucia-auth/adapter-prisma": "^4.0.1",
  "@node-rs/argon2": "^2.0.2",
  "oslo": "^1.2.1",
  "cookie": "^1.1.1"
}
```

### Nuevas dependencias (Si necesitas)
```bash
npm install idb uuid nanoid
# idb — Wrapper simplificado para IndexedDB
# uuid — ID único para idempotencyKey
# nanoid — ID compacto para sync queue items
```

---

## DECISIONES ARQUITECTÓNICAS

### 1. IndexedDB vs LocalStorage
**Decisión**: IndexedDB
- ✅ Mejor para datos complejos/grandes
- ✅ Transacciones atómicas
- ✅ Índices para queries rápidas
- ❌ LocalStorage: límite 5-10MB

### 2. Service Worker Scope
**Decisión**: `/` (raíz)
- ✅ Cubre toda la app
- ✅ Puede interceptar /api/
- ✅ Puede cachear /assets/

### 3. Cache Strategy
**Decisión**: Hybrid
- API: network-first (prioritiza actualización)
- Assets: cache-first (rápido + fallback)
- Findings list: network-first con timeout

### 4. Idempotency Key
**Decisión**: Generar en client (uuidv4)
- ✅ Client controls retry
- ✅ DB puede deduplicar
- ✅ Safe para concurrency

### 5. Session Sync
**Decisión**: Revalidar al conectar
- ✅ Si sesión expiró: logout
- ✅ Si sesión válida: continuar
- ✅ No perder datos offline

---

## TESTING

### Test Cases

**1. Offline Caching**
- [ ] Findings list se cachea al cargar
- [ ] Buscar en findings_cache si offline
- [ ] Timestamp de cache mostrado

**2. Offline Sync Queue**
- [ ] PATCH finding → queue item creado
- [ ] DELETE finding → queue item creado
- [ ] Queue muestra en SyncQueueViewer

**3. Online Sync**
- [ ] Cuando vuelve online → procesa queue
- [ ] Idempotency-Key enviado
- [ ] Retry con backoff
- [ ] Toast de success/error

**4. Error Handling**
- [ ] 409 Duplicate → usar cached response
- [ ] 401 Unauthorized → logout
- [ ] 500 Server error → retry
- [ ] 3 retries → manual retry UI

**5. Service Worker**
- [ ] Install cachea assets
- [ ] Fetch intercepta network
- [ ] Background sync procesa queue
- [ ] Uninstall limpia cache

---

## ESTIMACIÓN DE TIEMPO

| Tarea | Tiempo |
|-------|--------|
| Setup inicial + DB verification | 10 min |
| Service Worker (`public/sw.js`) | 30 min |
| IndexedDB service + hooks | 40 min |
| Frontend components (5) | 35 min |
| API idempotency middleware | 20 min |
| Testing + debugging | 40 min |
| **Total** | **2.5-3 horas** |

---

## QUICK START COMANDOS

```bash
# 1. Setup (si no está hecho)
export DATABASE_URL="postgresql://..."
npx prisma migrate dev
npx ts-node scripts/seed-users.ts
npm run dev

# 2. RBAC Testing (si no está hecho)
# Ver RBAC_TESTING_GUIDE.md

# 3. Comenzar FASE 8
# Usar /senior-fullstack skill (ver abajo)
```

---

## SKILL A USAR: `/senior-fullstack`

### Por Qué Este Skill

El `/senior-fullstack` es ideal para FASE 8 porque:

✅ **Arquitectura completa**
- Diseña Service Worker + IndexedDB juntos
- Entiende interacciones offline
- Optimiza performance PWA

✅ **Frontend + Backend integrados**
- Idempotency middleware en API
- Hooks en React para sync
- Components offline-aware

✅ **Testing y best practices**
- Test coverage para offline scenarios
- Cache invalidation strategy
- Error recovery patterns

✅ **Documentación automática**
- Explica architecture decisions
- Guías de deployment
- Troubleshooting offline

### Prompt Recomendado para Siguiente Sesión

```
Lee: /var/www/uix.torrax.cloud/MASTER_PROMPT_FASE_8_PWA.md

[Tu pregunta]: Implementa FASE 8 (PWA + Offline Sync)

Contexto:
- FASE 7.5 ✅ RBAC integrado, Build exitoso
- PostgreSQL disponible, RBAC testing completado
- 6 usuarios de prueba creados
- Stack: Next.js 16.3 + React 19 + Lucia + Prisma 7.9.1

Objetivo:
- Service Worker + IndexedDB offline cache
- Sync queue para cambios offline
- Offline indicators
- 5 frontend components
- API idempotency middleware
- Full test coverage

Deliverables:
1. public/sw.js (120 líneas)
2. lib/services/offline-sync-service.ts (150 líneas)
3. lib/services/idempotency-service.ts (100 líneas)
4. 5 components + hooks (300 líneas total)
5. Test suite (5 archivos)
6. Documentación

Usa /senior-fullstack skill para arquitectura completa.
```

---

## REFERENCIAS

- **Previo**: `SESSION_2026_08_09_SUMMARY.md` (FASE 7.5 resumido)
- **Auth**: `docs/backend/09-fase7-auth-guide.md` (4000+ palabras)
- **RBAC**: `lib/middleware/rbac.ts` (matriz de permisos)
- **Testing**: `RBAC_TESTING_GUIDE.md` (casos de testing)

---

## CHECKLIST ANTES DE COMEÇAR FASE 8

**BD**:
- [ ] PostgreSQL conectado (DATABASE_URL set)
- [ ] Migración aplicada (`npx prisma migrate dev`)
- [ ] Test users creados (`npx ts-node scripts/seed-users.ts`)

**RBAC**:
- [ ] Login funciona (curl -X POST /api/auth/login)
- [ ] RBAC enforcement funciona (403 para VIEWER)
- [ ] User tracking en BD (user.id, no 'system')

**Build**:
- [ ] `npm run build` exitoso
- [ ] Dev server inicia sin errores
- [ ] No faltan dependencias

**Documentación**:
- [ ] Leíste MASTER_PROMPT_FASE_8_PWa.md
- [ ] Tienes referencia de RBAC_TESTING_GUIDe.md
- [ ] Entiendes arquitectura offline

---

## NOTAS IMPORTANTES

1. **Idempotency es crítico**
   - Sin Idempotency-Key → duplicados en offline/retry
   - Genera UUID en client antes de PATCH/POST

2. **IndexedDB es por origin**
   - localhost:3000 ≠ localhost:5000
   - Datos no se sincronizan entre tabs (por diseño)

3. **Service Worker es global**
   - Una vez registrado, afecta toda la app
   - Cambios requieren new registration o skipWaiting()

4. **Battery/Data**
   - No hagas background sync si usuario está offline hace >1 hora
   - Muestra UI: "Cambios pendientes. Sincronizar ahora?"

5. **Testing offline**
   - DevTools → Network → Throttling → Offline
   - O: DevTools → Application → Service Workers → Offline

---

**Siguiente Sesión**: PWA Offline + Testing  
**Tiempo**: 2-3 horas  
**Skill**: `/senior-fullstack`  
**Status**: Listo para comenzar cuando PostgreSQL esté disponible

---

*Creado: 09 Agosto 2026 — Contexto completo para siguiente sesión*
