# FASE 10 ENTRY POINT — Real-time Collaboration

**Fecha de Inicio**: Próxima sesión  
**Skill a Activar**: `/senior-fullstack`  
**Prerequisito**: Leer `FASE10_MASTER_PROMPT.md` primero  
**Duración Estimada**: 2-2.5 horas

---

## ✅ Prerequisitos Completados (FASE 9)

- ✅ PostgreSQL: `pruebas_maria_dev` con 15 tablas
- ✅ Auth: Lucia + Argon2id + RBAC (6 roles)
- ✅ Push Notifications: Web Push API + Service Worker
- ✅ 6 test users creados
- ✅ Dev server: Corriendo en port 3001

---

## 🚀 Quick Start (Próxima Sesión)

```bash
# 1. Set environment
export DATABASE_URL="postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev"
export REDIS_URL="redis://localhost:6379"  # NUEVO

# 2. Instalar dependencias
npm install socket.io socket.io-adapter-redis redis

# 3. Start Redis (en otro terminal)
redis-server --port 6379

# 4. Start dev server
npm run dev

# 5. Follow FASE10_MASTER_PROMPT.md paso a paso
```

---

## 📊 FASE 10 Checklist

### Backend (45 min)
- [ ] npm install socket.io + redis
- [ ] Create Prisma migration: `activities` table
- [ ] Implement RealtimeService
- [ ] Implement ConflictResolutionService
- [ ] Implement ActivityService
- [ ] Create Socket.io server
- [ ] Create API endpoints: /activity, /presence
- [ ] Integrate WebSocket in Next.js

### Frontend (45 min)
- [ ] Create useRealtime hook
- [ ] Create usePresence hook
- [ ] Create useActivity hook
- [ ] Create PresenceIndicator component
- [ ] Create ActivityFeed component
- [ ] Create CollaborationBanner component
- [ ] Create PresenceList component
- [ ] Create ConflictResolver modal
- [ ] Integrate in finding detail page

### Socket.io (15 min)
- [ ] Configure connection/disconnection events
- [ ] Implement emit/listen pattern
- [ ] Add reconnection handling

### Testing (15 min)
- [ ] Write 4+ test files
- [ ] Verify >80% coverage
- [ ] Test WebSocket connections

### Documentation (10 min)
- [ ] Create FASE10_COMPLETION.md
- [ ] Document Socket.io events
- [ ] Add usage examples

---

## 🔑 Critical Files to Reference

**Master Prompt**:
```
/var/www/uix.torrax.cloud/FASE10_MASTER_PROMPT.md
```

**FASE 9 Completion** (reference):
```
/var/www/uix.torrax.cloud/FASE9_COMPLETION.md
```

**Current Architecture** (reference):
```
/var/www/uix.torrax.cloud/FASE9_MASTER_PROMPT.md
```

---

## 🎯 Success Criteria

- [ ] Socket.io server starts without errors
- [ ] Redis adapter works (multiple processes)
- [ ] 2+ users can edit same finding simultaneously
- [ ] Presence indicator shows active users
- [ ] Conflict detection works correctly
- [ ] Activity feed updates in real-time
- [ ] 4+ test files with >80% coverage
- [ ] Build runs successfully: `npm run build`
- [ ] Dev server runs without errors: `npm run dev`
- [ ] Manual test: 2 users editing → conflict → resolve

---

## ⚠️ Known Considerations

1. **Redis Installation**: Requiere Redis server corriendo
   - macOS: `brew install redis`
   - Linux: `apt-get install redis-server`
   - Docker: `docker run -p 6379:6379 redis:latest`

2. **Port Configuration**: Socket.io usa mismo puerto que Next.js (3001)
   - No hay puerto adicional necesario
   - Auto-upgrade HTTP → WebSocket

3. **Presence Cleanup**: Redis TTL automático (5 min default)
   - Usuarios desconectados se limpian automáticamente
   - No requiere cleanup manual

4. **Conflict Resolution**: OT (Operational Transform) es complejo
   - Implementar Last Write Wins primero
   - Merge strategy opcional para FASE 11

---

## 💡 Implementation Strategy

### Phase 1: Socket.io Setup (15 min)
1. Install deps
2. Create socket.ts server
3. Configure Redis adapter
4. Test connection

### Phase 2: Activity Logging (15 min)
1. Create activities table
2. ActivityService implementation
3. Auto-log changes via middleware

### Phase 3: Real-time UI (60 min)
1. Presence tracking
2. Hooks implementation
3. Components + integration
4. Conflict handling

### Phase 4: Testing & Polish (30 min)
1. Write tests
2. Manual testing
3. Documentation

---

## 📞 Questions to Ask Yourself

- ✅ Is Redis installed and running?
- ✅ Can you connect to PostgreSQL?
- ✅ Does `npm run dev` start successfully?
- ✅ Can you open localhost:3001 in browser?
- ✅ Do test users exist in database?

If any of these fail, review FASE9_COMPLETION.md for troubleshooting.

---

## 🔐 Environment Checklist

```bash
# Before starting:

# 1. PostgreSQL running
psql postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev -c "SELECT 1;"

# 2. Redis running
redis-cli ping
# Should output: PONG

# 3. Node.js version
node --version  # v20+

# 4. npm packages
npm list socket.io  # Should exist after install
npm list redis      # Should exist after install

# 5. DEV SERVER
npm run dev
# Should start on port 3001 without errors
```

---

## 🎬 Quick Demo (After Setup)

```typescript
// En otro terminal, conectar 2 clientes
import io from 'socket.io-client'

const socket1 = io('http://localhost:3001')
const socket2 = io('http://localhost:3001')

socket1.emit('finding:join', { findingId: 'finding-123' })
socket2.emit('finding:join', { findingId: 'finding-123' })

// Socket1 actualiza
socket1.emit('finding:update', {
  findingId: 'finding-123',
  data: { status: 'IN_PROGRESS' },
  version: 1
})

// Socket2 recibe en tiempo real
socket2.on('finding:updated', (data) => {
  console.log('Update received:', data)
})
```

---

## 📚 Learning Resources

- Socket.io Tutorial: https://socket.io/docs/v4/
- Redis Adapter: https://socket.io/docs/v4/redis-adapter/
- Real-time Collab: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
- OT Algorithms: https://operational-transformation.github.io/

---

**Status**: Ready for implementation ✅  
**Next**: Activate `/senior-fullstack` skill + follow FASE10_MASTER_PROMPT.md  
**Expected Output**: FASE 10 complete + FASE 11 planned
