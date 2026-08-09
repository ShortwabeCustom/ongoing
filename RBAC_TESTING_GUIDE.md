# RBAC Testing Guide — FASE 7.5 Verification

**Fecha**: 09 Agosto 2026 | **Duración**: 15-20 minutos | **Objetivo**: Validar RBAC antes de FASE 8

---

## Prerequisitos

```bash
# 1. PostgreSQL conexión
export DATABASE_URL="postgresql://user:pass@host:port/db"

# 2. Aplicar migración
npx prisma migrate dev
npx prisma generate

# 3. Crear usuarios de prueba
npx ts-node scripts/seed-users.ts

# 4. Iniciar servidor
npm run dev
# Esperado: Server running on http://localhost:3000
```

---

## Test Users (6 Roles)

**Credenciales (todas)**:
- Email: `[role]@test.local`
- Password: `TestPassword123`

| Role | Email | Permisos | Test |
|------|-------|----------|------|
| OWNER | owner@test.local | Todo (master) | ✓ PATCH, DELETE findings |
| QA_LEAD | qa-lead@test.local | Editar, eliminar, validar | ✓ PATCH findings, validar |
| DESIGNER | designer@test.local | Crear, editar, validar | ✓ POST evidence, validar |
| DEVELOPER | developer@test.local | Crear, editar, validar | ✓ POST evidence, validar |
| BUSINESS_REVIEWER | business@test.local | Validar solo | ✓ PATCH resolutions (validar) |
| VIEWER | viewer@test.local | Solo lectura | ✗ No puede PATCH/DELETE |

---

## Test Endpoints (5 Protegidos por RBAC)

### 1. PATCH /api/findings/[id] — Editar Finding

**RBAC Requerido**: `OWNER`, `QA_LEAD`

**Test Case 1.1: OWNER (✓ Debe funcionar)**
```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@test.local",
    "password": "TestPassword123"
  }' \
  -c cookies.txt

# 2. Obtener un finding ID
curl http://localhost:3000/api/findings \
  -b cookies.txt | jq '.data[0].id'

# 3. PATCH finding (debe funcionar: 200)
curl -X PATCH http://localhost:3000/api/findings/[finding-id] \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Actualizado por OWNER",
    "status": "IN_PROGRESS"
  }'

# Esperado: { "data": { "id": "...", "title": "Actualizado por OWNER" }, "success": true }
```

**Test Case 1.2: DESIGNER (✗ Debe fallar 403)**
```bash
# 1. Login como DESIGNER
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "designer@test.local",
    "password": "TestPassword123"
  }' \
  -c cookies_designer.txt

# 2. Intentar PATCH (debe fallar: 403)
curl -X PATCH http://localhost:3000/api/findings/[finding-id] \
  -H "Content-Type: application/json" \
  -b cookies_designer.txt \
  -d '{
    "title": "Actualizado por DESIGNER"
  }'

# Esperado: { "error": "Insufficient permissions", "code": "FORBIDDEN" }
```

**Test Case 1.3: VIEWER (✗ Debe fallar 403)**
```bash
# 1. Login como VIEWER
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "viewer@test.local",
    "password": "TestPassword123"
  }' \
  -c cookies_viewer.txt

# 2. Intentar PATCH (debe fallar: 403)
curl -X PATCH http://localhost:3000/api/findings/[finding-id] \
  -H "Content-Type: application/json" \
  -b cookies_viewer.txt \
  -d '{"title": "Hack"}'

# Esperado: { "error": "Insufficient permissions", "code": "FORBIDDEN" }
```

---

### 2. DELETE /api/findings/[id] — Eliminar Finding

**RBAC Requerido**: `OWNER`, `QA_LEAD`

**Test Case 2.1: QA_LEAD (✓ Debe funcionar)**
```bash
# 1. Login como QA_LEAD
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "qa-lead@test.local",
    "password": "TestPassword123"
  }' \
  -c cookies_qa.txt

# 2. DELETE finding (debe funcionar: 200)
curl -X DELETE http://localhost:3000/api/findings/[finding-id] \
  -b cookies_qa.txt

# Esperado: { "success": true, "message": "Finding deleted" }
```

**Test Case 2.2: BUSINESS_REVIEWER (✗ Debe fallar 403)**
```bash
# 1. Login como BUSINESS_REVIEWER
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "business@test.local",
    "password": "TestPassword123"
  }' \
  -c cookies_business.txt

# 2. Intentar DELETE (debe fallar: 403)
curl -X DELETE http://localhost:3000/api/findings/[finding-id] \
  -b cookies_business.txt

# Esperado: 403 Forbidden
```

---

### 3. POST /api/evidence/upload — Crear Evidencia

**RBAC Requerido**: `CREATE_FINDING` (OWNER, QA_LEAD, DESIGNER, DEVELOPER)

**Test Case 3.1: DESIGNER (✓ Debe funcionar)**
```bash
# 1. Login como DESIGNER
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "designer@test.local",
    "password": "TestPassword123"
  }' \
  -c cookies_designer.txt

# 2. POST evidence (debe funcionar: 201)
# Crear archivo de prueba
echo "Test evidence content" > /tmp/test.txt

curl -X POST http://localhost:3000/api/evidence/upload \
  -F "file=@/tmp/test.txt" \
  -F "findingId=[finding-id]" \
  -F "title=Test Evidence" \
  -F "type=DOCUMENT" \
  -b cookies_designer.txt

# Esperado: { "data": { "id": "...", "url": "signed-url..." }, "success": true }
```

**Test Case 3.2: VIEWER (✗ Debe fallar 403)**
```bash
# 1. Login como VIEWER
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "viewer@test.local",
    "password": "TestPassword123"
  }' \
  -c cookies_viewer.txt

# 2. Intentar POST evidence (debe fallar: 403)
curl -X POST http://localhost:3000/api/evidence/upload \
  -F "file=@/tmp/test.txt" \
  -F "findingId=[finding-id]" \
  -F "title=Hack" \
  -F "type=DOCUMENT" \
  -b cookies_viewer.txt

# Esperado: 403 Forbidden
```

---

### 4. POST /api/findings/[id]/resolutions — Crear Resolución

**RBAC Requerido**: `CREATE_RESOLUTION` (OWNER, QA_LEAD, DESIGNER, DEVELOPER)

**Test Case 4.1: DEVELOPER (✓ Debe funcionar)**
```bash
# 1. Login como DEVELOPER
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@test.local",
    "password": "TestPassword123"
  }' \
  -c cookies_dev.txt

# 2. POST resolution (debe funcionar: 201)
curl -X POST http://localhost:3000/api/findings/[finding-id]/resolutions \
  -H "Content-Type: application/json" \
  -b cookies_dev.txt \
  -d '{
    "description": "Fixed in PR #123",
    "status": "PROPOSED"
  }'

# Esperado: { "data": { "id": "...", "status": "PROPOSED" }, "success": true }
```

**Test Case 4.2: VIEWER (✗ Debe fallar 403)**
```bash
curl -X POST http://localhost:3000/api/findings/[finding-id]/resolutions \
  -H "Content-Type: application/json" \
  -b cookies_viewer.txt \
  -d '{"description": "Hack", "status": "PROPOSED"}'

# Esperado: 403 Forbidden
```

---

### 5. PATCH /api/findings/[id]/resolutions/[resId] — Validar Resolución

**RBAC Requerido**: `CHANGE_RESOLUTION_STATE` (OWNER, QA_LEAD, BUSINESS_REVIEWER)

**Test Case 5.1: BUSINESS_REVIEWER (✓ Debe funcionar)**
```bash
# 1. Login como BUSINESS_REVIEWER
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "business@test.local",
    "password": "TestPassword123"
  }' \
  -c cookies_business.txt

# 2. Obtener resolution ID (primero)
curl http://localhost:3000/api/findings/[finding-id] \
  -b cookies_business.txt | jq '.data.resolutions[0].id'

# 3. PATCH resolution status (debe funcionar: 200)
curl -X PATCH http://localhost:3000/api/findings/[finding-id]/resolutions/[res-id] \
  -H "Content-Type: application/json" \
  -b cookies_business.txt \
  -d '{
    "status": "VALIDATED",
    "notes": "Approved by reviewer"
  }'

# Esperado: { "data": { "id": "...", "status": "VALIDATED" }, "success": true }
```

**Test Case 5.2: DESIGNER (✗ Debe fallar 403)**
```bash
# 1. Login como DESIGNER
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "designer@test.local",
    "password": "TestPassword123"
  }' \
  -c cookies_designer.txt

# 2. Intentar PATCH resolution (debe fallar: 403)
curl -X PATCH http://localhost:3000/api/findings/[finding-id]/resolutions/[res-id] \
  -H "Content-Type: application/json" \
  -b cookies_designer.txt \
  -d '{"status": "VALIDATED"}'

# Esperado: 403 Forbidden
```

---

## Checklist de Testing

### ✓ Autenticación
- [ ] Login funciona para todos los 6 usuarios
- [ ] Password correcto: `TestPassword123`
- [ ] Cookies se generan correctamente
- [ ] Logout funciona (DELETE /api/auth/logout)

### ✓ RBAC Enforcement
- [ ] PATCH /findings: OWNER ✓, QA_LEAD ✓, DESIGNER ✗
- [ ] DELETE /findings: OWNER ✓, QA_LEAD ✓, VIEWER ✗
- [ ] POST /evidence: DESIGNER ✓, VIEWER ✗
- [ ] POST /resolutions: DEVELOPER ✓, VIEWER ✗
- [ ] PATCH /resolutions: BUSINESS_REVIEWER ✓, DESIGNER ✗

### ✓ User Tracking
- [ ] Cada cambio registra `user.id` (no 'system')
- [ ] Campo `createdBy` es user.id auténtico
- [ ] Campo `updatedBy` es user.id actual

### ✓ Errores 403
- [ ] Response code es 403 (no 400, 500, etc)
- [ ] Mensaje: "Insufficient permissions"
- [ ] Code: "FORBIDDEN" (o similar)

### ✓ Base de Datos
- [ ] Tablas: users, sessions, findings, evidence, resolutions
- [ ] Índices creados (createdAt, status, assigneeId)
- [ ] Soft deletes funcionales (deletedAt field)

---

## Troubleshooting

### Error: "DATABASE_URL not set"
```bash
# Verificar
echo $DATABASE_URL

# Establecer
export DATABASE_URL="postgresql://user:pass@host:port/db"

# Luego
npx prisma migrate dev
```

### Error: "No migration found"
```bash
# Reiniciar prisma
rm -rf prisma/migrations
npx prisma migrate dev --name init
```

### Error: "Foreign key constraint failed"
```bash
# Verificar que finding existe
curl http://localhost:3000/api/findings -b cookies.txt | jq '.data[0].id'

# Usar ese ID en los tests
```

### Error: "Session not found"
```bash
# Cookies expiradas - hacer login de nuevo
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@test.local","password":"TestPassword123"}' \
  -c cookies.txt
```

---

## Resultado Esperado

Cuando todos los tests pasen ✓:

```
✓ OWNER puede PATCH/DELETE findings
✓ QA_LEAD puede PATCH/DELETE findings
✓ DESIGNER puede POST evidence/resolutions
✓ DEVELOPER puede POST evidence/resolutions
✓ BUSINESS_REVIEWER puede PATCH resolutions (validar)
✓ VIEWER solo puede leer (GET)
✓ Todos reciben 403 si no tienen permisos
✓ User tracking funciona (createdBy = user.id auténtico)

RBAC ✅ Funcional → Proceder a FASE 8
```

---

## Comandos Útiles

```bash
# Limpiar cookies
rm -f cookies*.txt

# Ver todos los usuarios creados
curl http://localhost:3000/api/admin/users -b cookies.txt

# Ver un finding con resolutions
curl http://localhost:3000/api/findings/[id] -b cookies.txt | jq '.'

# Ver sesiones activas
npx prisma db execute --stdin < "SELECT * FROM sessions LIMIT 5;"

# Resetear datos (si necesitas)
npx prisma db push --force-reset
npx ts-node scripts/seed-users.ts
```

---

## Notas Importantes

1. **Idempotent requests**: Los tests pueden correr múltiples veces sin duplicar datos
2. **Order**: Hacer login ANTES de cada test
3. **Finding ID**: Cambiar `[finding-id]` por ID real (GET /api/findings)
4. **Timeline**: ~15-20 min si todo funciona, ~40 min si hay issues

---

**Siguiente Paso**: Cuando RBAC ✅ esté validado → Proceder a FASE 8 (PWA + Offline Sync)
