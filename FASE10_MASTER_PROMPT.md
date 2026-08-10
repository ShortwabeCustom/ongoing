# FASE 10: Real-time Collaboration — Master Prompt

**Fecha**: 2026-08-10  
**Stack**: Next.js 16.3 + React 19 + Prisma 7.9.1 + PostgreSQL + Socket.io + Redis  
**Idioma**: Español  
**Duración Estimada**: 2-2.5 horas

---

## 🎯 Objetivo

Implementar un sistema completo de **colaboración en tiempo real** (Real-time Collaboration) con:
- Backend: Socket.io server + Redis adapter + activity tracking
- Frontend: Real-time UI updates, presence indicators, activity log
- Sync: Optimistic locking + conflict resolution
- Testing: Integration tests para WebSockets

---

## 📋 Prerequisitos

✅ **Ya Completado**:
- PostgreSQL configurado con 13 tablas (+ push_subscriptions, notifications)
- Auth + Lucia sessions + RBAC enforcement
- 6 test users con roles (OWNER, QA_LEAD, DESIGNER, DEVELOPER, BUSINESS_REVIEWER, VIEWER)
- Service Worker + Offline Sync (FASE 8)
- Push Notifications (FASE 9)

**Setup Requerido**:
```bash
export DATABASE_URL="postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev"
export REDIS_URL="redis://localhost:6379"  # Nuevo
npm run dev  # Inicia en puerto 3001
```

---

## 🏗️ Arquitectura

### Backend (3 Servicios + 2 Endpoints)

#### 1. **RealtimeService** (`lib/services/realtime.ts`)
```typescript
// Maneja conexiones, rooms y eventos
- initializeSocket(server): void
- joinFinding(userId, findingId): void
- leaveFinding(userId, findingId): void
- broadcastFindingUpdate(findingId, data): void
- trackUserActivity(userId, action, resourceId): void
- getActiveUsers(findingId): User[]
- getActivityLog(findingId, limit=50): Activity[]
```

#### 2. **ConflictResolutionService** (`lib/services/conflict-resolution.ts`)
```typescript
// Detecta y resuelve conflictos de escritura
- detectConflict(clientVersion, serverVersion): ConflictInfo
- applyOperationalTransform(ops: Operation[]): Result
- resolveConflict(conflict, strategy): ResolvedData
- validateUpdate(userId, resourceId, version): boolean
```

#### 3. **ActivityService** (`lib/services/activity.ts`)
```typescript
// Registra y expone actividad de usuarios
- logActivity(userId, action, resourceId, details): void
- getRecentActivity(findingId, limit): Activity[]
- getActivityByUser(userId, limit): Activity[]
- getUserPresence(userId): PresenceInfo
- updatePresence(userId, status): void
```

#### 4. **API Endpoints** (`app/api/realtime/*`)
```
GET /api/realtime/activity/[findingId]
- Obtener historial de actividad
- Parámetros: limit, offset, filter

GET /api/realtime/presence/[findingId]
- Obtener usuarios activos ahora
- Respuesta: [{ userId, userName, role, lastSeen }]
```

### Frontend (5 Componentes + 3 Hooks)

#### Componentes
1. **PresenceIndicator** (`components/realtime/PresenceIndicator.tsx`)
   - Avatar con estado online/offline
   - Tooltip con hora de última actividad
   - Animación pulse para usuarios activos

2. **ActivityFeed** (`components/realtime/ActivityFeed.tsx`)
   - Lista de eventos recientes
   - Filtros por tipo de actividad
   - Timeline visual

3. **CollaborationBanner** (`components/realtime/CollaborationBanner.tsx`)
   - Muestra "X usuarios editando"
   - Aviso de conflictos no resueltos
   - Botón para refresh

4. **PresenceList** (`components/realtime/PresenceList.tsx`)
   - Sidebar con usuarios activos
   - Estados: editing, viewing, idle
   - Click para seguir al usuario

5. **ConflictResolver** (`components/realtime/ConflictResolver.tsx`)
   - Modal para resolver conflictos
   - Muestra cambios en paralelo (diff view)
   - Botones: Accept Mine / Accept Theirs / Merge

#### Hooks
1. **useRealtime** (`lib/hooks/useRealtime.ts`)
   - Conectar a Socket.io
   - Join/leave rooms
   - Emitir eventos

2. **usePresence** (`lib/hooks/usePresence.ts`)
   - Trackear usuarios activos
   - Actualizar presencia local
   - Detectar desconexiones

3. **useActivity** (`lib/hooks/useActivity.ts`)
   - Fetch historial
   - Escuchar eventos en tiempo real
   - Actualizar UI automáticamente

### Socket.io Events

**Client → Server**:
```
'finding:join' → findingId
'finding:leave' → findingId
'finding:update' → { findingId, data, version }
'presence:update' → { status, resourceId }
'activity:log' → { action, resourceId, details }
```

**Server → Client**:
```
'finding:updated' ← { userId, data, version, timestamp }
'finding:conflict' ← { conflict, resolution }
'presence:changed' ← { userId, status, resourceId }
'activity:new' ← { userId, action, resourceId, timestamp }
'users:active' ← [{ userId, status }]
```

---

## 📊 Modelo de Datos

### Nueva Tabla: `activities`

```sql
CREATE TABLE "activities" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "details" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "activities_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "activities_userId_idx" ON "activities"("userId");
CREATE INDEX "activities_resourceId_idx" ON "activities"("resourceId");
CREATE INDEX "activities_action_idx" ON "activities"("action");
CREATE INDEX "activities_createdAt_idx" ON "activities"("createdAt");
```

### Nuevas Enums

```typescript
enum ActivityAction {
  FINDING_CREATED
  FINDING_UPDATED
  FINDING_DELETED
  FINDING_VIEWED
  RESOLUTION_ADDED
  RESOLUTION_UPDATED
  VALIDATION_COMPLETED
  COMMENT_ADDED
  STATUS_CHANGED
  ASSIGNED
}

enum UserStatus {
  ONLINE
  EDITING
  IDLE
  OFFLINE
}
```

---

## 🧪 Testing

**4+ Test Files**:

1. **`lib/services/__tests__/realtime.test.ts`** — Socket.io events
   - Join/leave rooms
   - Broadcast updates
   - User tracking

2. **`lib/services/__tests__/conflict-resolution.test.ts`** — Conflict detection
   - Detectar conflictos
   - Resolver con diferentes estrategias
   - Validar integridad

3. **`lib/hooks/__tests__/useRealtime.test.ts`** — Hook de Socket.io
   - Connect/disconnect
   - Join room
   - Emit events

4. **`components/realtime/__tests__/PresenceIndicator.test.tsx`** — Componente
   - Render status
   - Update on presence change
   - Show tooltip

---

## 📝 Tareas en Orden

### Backend (45 min)

- [ ] 1. Instalar `socket.io`, `socket.io-adapter-redis`, `redis`
- [ ] 2. Crear migración Prisma para tabla `activities`
- [ ] 3. Implementar RealtimeService
- [ ] 4. Implementar ConflictResolutionService
- [ ] 5. Implementar ActivityService
- [ ] 6. Crear Socket.io server en `lib/socket.ts`
- [ ] 7. Crear endpoints GET /api/realtime/activity + /presence
- [ ] 8. Integrar WebSocket handler en Next.js

### Frontend (45 min)

- [ ] 9. Crear useRealtime hook
- [ ] 10. Crear usePresence hook
- [ ] 11. Crear useActivity hook
- [ ] 12. Implementar PresenceIndicator componente
- [ ] 13. Implementar ActivityFeed componente
- [ ] 14. Implementar CollaborationBanner componente
- [ ] 15. Implementar PresenceList componente
- [ ] 16. Implementar ConflictResolver modal
- [ ] 17. Integrar en finding detail page

### Socket.io (15 min)

- [ ] 18. Configurar eventos de conexión/desconexión
- [ ] 19. Implementar emit/listen pattern en cliente
- [ ] 20. Agregar reconnection handling

### Testing (15 min)

- [ ] 21. Escribir 4+ test files
- [ ] 22. Verificar >80% coverage
- [ ] 23. Test WebSocket connections

### Documentación (10 min)

- [ ] 24. Crear FASE10_COMPLETION.md
- [ ] 25. Documentar Socket.io events
- [ ] 26. Agregar ejemplos de uso

---

## 🔑 Environment Variables

```bash
# .env.local
REDIS_URL="redis://localhost:6379"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"  # Dev
SOCKET_ADAPTER="redis"  # Para clustering
```

---

## ✅ Definition of Done

- [ ] Todos los servicios creados + testeados
- [ ] Socket.io server configurado + Redis adapter
- [ ] 5 componentes React + 3 hooks implementados
- [ ] 4+ test files con >80% coverage
- [ ] Documentación completada
- [ ] Build exitoso (npm run build)
- [ ] Dev server sin errores (npm run dev)
- [ ] Prueba manual: 2+ usuarios editando simultáneamente
- [ ] Conflict resolution probada

---

## 💡 Tips de Implementación

1. **Redis**: Usar para adaptar Socket.io a múltiples procesos
2. **Optimistic Locking**: Versiones en cada recurso para detectar conflictos
3. **Presence**: Trackear con ttl (time-to-live) para limpiar automáticamente
4. **Activity Logging**: No bloquear en la ruta crítica (usar queue)
5. **Reconnection**: Implementar exponential backoff + state persistence
6. **Testing**: Usar `socket.io-client` en tests para simular conexiones

---

## 🎬 Flujo de Usuario

```
1. Usuario A abre Finding #123
   → Se suscribe via Socket.io (join room)
   → Se actualiza presencia en Redis
   
2. Usuario B abre MISMO Finding #123
   → Socket.io notifica a Usuario A
   → Aparece PresenceIndicator de Usuario B
   
3. Usuario A edita description
   → Envía update via Socket.io (optimistic)
   → Backend detecta versión
   → Notifica a Usuario B en tiempo real
   → UI de Usuario B actualiza automáticamente
   
4. Usuario B intentó editar al mismo tiempo
   → Detecta conflicto (version mismatch)
   → Muestra ConflictResolver modal
   → Usuario elige: Mine / Theirs / Merge
   
5. Resolución guardada
   → Backend guarda versión correcta
   → Notifica a ambos usuarios
   → Activity log actualizado
```

---

## 📚 Referencias

- Socket.io: https://socket.io/docs/
- Redis Adapter: https://socket.io/docs/v4/redis-adapter/
- Operational Transformation: https://en.wikipedia.org/wiki/Operational_transformation
- CRDT: https://crdt.tech/
- Activity Tracking: https://www.elastic.co/guide/en/elasticsearch/guide/current/user-activity.html

---

## 🎓 Notas Técnicas

### Estrategias de Conflict Resolution

1. **Last Write Wins (LWW)** — Simple pero pierde cambios
2. **Client Wins** — Respeta edición del usuario local
3. **Server Wins** — Preserva estado del servidor
4. **Merge** — Combina cambios (requiere OT/CRDT)

### Presencia en Redis

```typescript
// Usar Sorted Sets para tracking
ZADD "presence:finding:123" <timestamp> "user:456"
EXPIRE "presence:finding:123" 300  // 5 min ttl
```

### Activity Logging

```typescript
// Usar Log Structured (JSONL) para audit trail
{
  "ts": "2026-08-10T12:34:56Z",
  "userId": "user-123",
  "action": "FINDING_UPDATED",
  "resourceId": "finding-456",
  "version": 5,
  "changes": { "status": "OPEN→IN_PROGRESS" }
}
```

---

## 🚀 Próximas Fases

### FASE 11 (Sugerido)
- [ ] Analytics Dashboard (Posthog/Mixpanel)
- [ ] Advanced Filtering & Search (Elasticsearch)
- [ ] Mobile App (React Native)

### Mejoras Opcionales
- [ ] End-to-end Encryption para collab
- [ ] Undo/Redo en tiempo real
- [ ] Version History con Diffs
- [ ] Webhooks para integración externa
- [ ] API Documentation (OpenAPI/Swagger)

---

**Status**: Listo para comenzar ✅  
**Next Session**: Activar skill `/senior-fullstack`  
**Expected Output**: FASE 10 completada + FASE 11 roadmap
