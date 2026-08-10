# Quick Start — Próxima Sesión (PostgreSQL Requerido)

**Status Actual**:
- ✅ npm install completado (Lucia 3.2.2, Argon2 2.0.2)
- ✅ Build exitoso (68s compile time)
- ✅ RBAC integrado en 5 endpoints
- ✅ Migración lista (prisma/migrations/add_auth_session/)
- ✅ Script seed listo (scripts/seed-users.ts)
- ⏳ Esperando: PostgreSQL disponible

---

## Cuando PostgreSQL Esté Disponible

### Paso 1: Conectar BD (30 segundos)
```bash
export DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
echo $DATABASE_URL  # Verificar
```

### Paso 2: Aplicar Migración (2 minutos)
```bash
npx prisma migrate dev
npx prisma generate
```

### Paso 3: Crear Test Users (1 minuto)
```bash
npx ts-node scripts/seed-users.ts
```

Usuarios creados:
```
owner@test.local         (OWNER)
qa-lead@test.local       (QA_LEAD)
designer@test.local      (DESIGNER)
developer@test.local     (DEVELOPER)
business@test.local      (BUSINESS_REVIEWER)
viewer@test.local        (VIEWER)
```

Contraseña para todos: `TestPassword123`

### Paso 4: Iniciar Server (5 minutos)
```bash
npm run dev
# Accede a http://localhost:3000
```

### Paso 5: Test RBAC (10-15 minutos)

**Test 1: Login exitoso**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c /tmp/cookies.txt \
  -d '{"email":"owner@test.local","password":"TestPassword123"}'
```

**Test 2: Verificar RBAC (debe retornar 403)**
```bash
# Login como VIEWER
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c /tmp/cookies.txt \
  -d '{"email":"viewer@test.local","password":"TestPassword123"}'

# Intentar editar finding (VIEWER no puede)
curl -X PATCH http://localhost:3000/api/findings/[FINDING_ID] \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"status":"IN_PROGRESS","version":1}'
```

Detalles: Ver `RBAC_TESTING_GUIDE.md`

---

## Después de Testing RBAC ✅

Entonces comienza **FASE 8: PWA + Offline Sync**
- Service Worker
- IndexedDB cache
- Sync queue para cambios offline
- Offline indicators

---

## Archivos de Referencia

- `SESSION_2026_08_09_SUMMARY.md` — Resumen completo de sesión
- `RBAC_TESTING_GUIDE.md` — 450+ líneas con todos los casos
- `FASE8_ENTRY_POINT.md` — Roadmap PWA
- `SESSION_FINAL_STATUS.md` — Estado final detallado

---

## Commit Reference

```
Hash: 043fe5e
Mensaje: feat(rbac): integrate RBAC enforcement into existing endpoints (FASE 7)
```

---

**Total Time When BD Available**: ~30 min (migration + seed + testing)  
**Then**: FASE 8 (2-3 hours)
