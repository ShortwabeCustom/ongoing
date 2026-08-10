# 🔐 RBAC Testing Guide

**Duración**: 15-20 minutos | **Objetivo**: Validar RBAC en 5 endpoints

---

## ⚡ Quick Setup

```bash
# 1. Asegúrate que PostgreSQL corre
psql $DATABASE_URL -c "SELECT 1"

# 2. Aplicar migración (si es primera vez)
npx prisma migrate dev

# 3. Crear test users
npx ts-node scripts/seed-users.ts

# 4. Iniciar servidor
npm run dev
# → http://localhost:3001
```

---

## 👥 Test Users (6 Roles)

**Todos tienen**: Password `TestPassword123`

| Email | Role | Permissions |
|-------|------|-------------|
| owner@test.local | OWNER | Todo |
| qa-lead@test.local | QA_LEAD | Editar/eliminar findings |
| designer@test.local | DESIGNER | Crear findings |
| developer@test.local | DEVELOPER | Crear + evidencia |
| business@test.local | BUSINESS_REVIEWER | Validar |
| viewer@test.local | VIEWER | Solo lectura |

---

## 🧪 Test Endpoints (5 Protegidos)

### 1️⃣ PATCH /api/findings/[id] — Editar Finding

**RBAC**: OWNER, QA_LEAD ✅ | Otros ❌

**Test OWNER (debe funcionar)**:
```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@test.local","password":"TestPassword123"}' \
  -c cookies.txt

# Obtener ID
FINDING_ID=$(curl http://localhost:3001/api/findings -b cookies.txt | jq -r '.data[0].id')

# PATCH (debe retornar 200)
curl -X PATCH http://localhost:3001/api/findings/$FINDING_ID \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"Updated"}'

# ✅ Esperado: { "data": { "id": "...", "title": "Updated" } }
```

**Test VIEWER (debe fallar 403)**:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer@test.local","password":"TestPassword123"}' \
  -c cookies_viewer.txt

curl -X PATCH http://localhost:3001/api/findings/$FINDING_ID \
  -H "Content-Type: application/json" \
  -b cookies_viewer.txt \
  -d '{"title":"Updated"}'

# ❌ Esperado: { "error": "Insufficient permissions" } (403)
```

### 2️⃣ DELETE /api/findings/[id] — Eliminar Finding

**RBAC**: OWNER, QA_LEAD ✅ | Otros ❌

```bash
# OWNER: debe funcionar (200)
curl -X DELETE http://localhost:3001/api/findings/$FINDING_ID \
  -b cookies.txt

# DESIGNER: debe fallar (403)
curl -X DELETE http://localhost:3001/api/findings/$FINDING_ID \
  -b cookies_designer.txt
```

### 3️⃣ POST /api/evidence/upload — Subir Evidencia

**RBAC**: OWNER, QA_LEAD, DESIGNER, DEVELOPER ✅ | BUSINESS_REVIEWER, VIEWER ❌

```bash
# DEVELOPER: debe funcionar (200)
curl -X POST http://localhost:3001/api/evidence/upload \
  -H "Authorization: Bearer token" \
  -F "file=@screenshot.png" \
  -F "findingId=$FINDING_ID" \
  -b cookies_developer.txt

# VIEWER: debe fallar (403)
curl -X POST http://localhost:3001/api/evidence/upload \
  -F "file=@screenshot.png" \
  -F "findingId=$FINDING_ID" \
  -b cookies_viewer.txt
```

### 4️⃣ POST /api/findings/[id]/resolutions — Crear Resolución

**RBAC**: OWNER, QA_LEAD, DESIGNER, DEVELOPER ✅ | Otros ❌

```bash
# DESIGNER: debe funcionar (200)
curl -X POST http://localhost:3001/api/findings/$FINDING_ID/resolutions \
  -H "Content-Type: application/json" \
  -b cookies_designer.txt \
  -d '{"description":"Fixed in PR #123"}'

# VIEWER: debe fallar (403)
curl -X POST http://localhost:3001/api/findings/$FINDING_ID/resolutions \
  -H "Content-Type: application/json" \
  -b cookies_viewer.txt \
  -d '{"description":"..."}'
```

### 5️⃣ PATCH /api/findings/[id]/resolutions/[resId] — Cambiar Estado Resolución

**RBAC**: OWNER, QA_LEAD ✅ | Otros ❌

```bash
# Obtener resolution ID
RES_ID=$(curl http://localhost:3001/api/findings/$FINDING_ID -b cookies.txt | jq -r '.data.resolutions[0].id')

# QA_LEAD: debe funcionar (200)
curl -X PATCH http://localhost:3001/api/findings/$FINDING_ID/resolutions/$RES_ID \
  -H "Content-Type: application/json" \
  -b cookies_qa_lead.txt \
  -d '{"state":"ACCEPTED"}'

# DEVELOPER: debe fallar (403)
curl -X PATCH http://localhost:3001/api/findings/$FINDING_ID/resolutions/$RES_ID \
  -H "Content-Type: application/json" \
  -b cookies_developer.txt \
  -d '{"state":"ACCEPTED"}'
```

---

## ✅ Checklist de Verificación

- [ ] OWNER puede PATCH findings
- [ ] VIEWER no puede PATCH findings (403)
- [ ] OWNER puede DELETE findings
- [ ] DESIGNER no puede DELETE (403)
- [ ] DEVELOPER puede subir evidencia
- [ ] VIEWER no puede subir evidencia (403)
- [ ] QA_LEAD puede cambiar estado de resoluciones
- [ ] DEVELOPER no puede cambiar estado (403)
- [ ] Todos los errores retornan 403 con mensaje claro

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| "Invalid credentials" | Verificar que seed-users.ts corrió exitosamente |
| Todos los endpoints retornan 401 | Cookie session no valida; hacer login primero |
| OWNER no puede PATCH | Verificar que RBAC_PERMISSIONS contiene OWNER con permiso |
| Otros roles pueden PATCH | Bug en checkRBAC(); verificar middleware |

---

## 🔍 Verificación Rápida (1 min)

```bash
# En una terminal
npm run dev

# En otra terminal, script rápido
bash -c '
  # Login + get cookie
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"owner@test.local\",\"password\":\"TestPassword123\"}" \
    -c .cookies.txt

  # Get finding
  curl http://localhost:3001/api/findings -b .cookies.txt | head -20
'
```

---

**Próximo**: Ver [docs/README.md](../README.md) para setup completo
