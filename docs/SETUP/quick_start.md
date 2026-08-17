---
title: Quick Start
purpose: Get the project running in 5 steps
audience: All developers (new & returning)
time: ⏱️ 15 minutes
---

# 🚀 QUICK START — Pruebas María 2.0

**Última actualización**: 2026-08-10

## ⚡ Setup en 5 Pasos (15 min)

### 1️⃣ Verificar Dependencias
```bash
# PostgreSQL corriendo
psql postgresql://torrax_user:<DEV_DB_PASSWORD>@localhost:5432/pruebas_maria_dev -c "SELECT COUNT(*) FROM users;"

# Elasticsearch corriendo
curl http://localhost:9200/_cluster/health

# Node.js + npm
node --version    # ≥20.0
npm --version     # ≥10.0
```

### 2️⃣ Instalar Dependencias (si es primera vez)
```bash
cd /var/www/uix.torrax.cloud
npm install --no-dedupe  # ⚠️ IMPORTANTE: --no-dedupe para Prisma + Lucia
npm run build
```

### 3️⃣ Inicializar Base de Datos (si es primera vez)
```bash
# Aplicar migración de Prisma
npx prisma migrate dev

# Seed test users (6 roles)
npx ts-node scripts/seed-users.ts
```

### 4️⃣ Iniciar Dev Server
```bash
npm run dev
# → http://localhost:3001
# → Turbopack enabled (46s build)
# → Hot reload activado
```

### 5️⃣ Verificar que Todo Funciona
```bash
# En otra terminal
curl http://localhost:3001/api/findings
# Debe retornar JSON (posiblemente vacío si BD está vacía)

# En navegador
open http://localhost:3001
```

---

## 📚 Lee Esto Primero (por FASE)

### FASE 14 (Actual)
**Estado**: Backend ✅ | Frontend 🚀

1. **[doc./readme.md](./readme.md)** — Índice maestro (5 min)
2. **[doc./phases/fase_14.md](./phases/fase_14.md)** — Especificación completa (15 min)
3. **[FASE14_FRONTEND_SPEC.md](../FASE14_FRONTEND_SPEc.md)** — si vas a implementar ui (30 min)

**Bloqueantes primero** (25 min total):
- ⚠️ Fix RBAC en `app/api/findings/bulk-update/route.ts` (15 min)
- ⚠️ Fix `hasEvidence` field en Elasticsearch (10 min)

---

## 🔐 Datos de Configuración

### PostgreSQL
```bash
Database: pruebas_maria_dev
User: torrax_user
Password: <DEV_DB_PASSWORD>
Host: localhost:5432
Port: 5432

# Connection String
DATABASE_URL=postgresql://torrax_user:<DEV_DB_PASSWORD>@localhost:5432/pruebas_maria_dev?schema=public
```

### Test Users (6 roles, password: TestPassword123)
```
owner@test.local              → OWNER (todas las acciones)
qa-lead@test.local            → QA_LEAD (editar/eliminar findings)
designer@test.local           → DESIGNER (crear findings)
developer@test.local          → DEVELOPER (crear findings + evidencia)
business@test.local           → BUSINESS_REVIEWER (ver todos)
viewer@test.local             → VIEWER (ver solo asignados)
```

### Elasticsearch
```bash
URL: http://localhost:9200
Index: findings-v1
```

---

## 🛠️ Comandos Útiles

### Desarrollo
```bash
npm run dev              # Servidor local (localhost:3001)
npm run build            # Build producción
npm run lint             # Linter (ESLint)
```

### Database
```bash
# Prisma
npx prisma migrate dev    # Crear + aplicar migración
npx prisma db push        # Push schema a DB sin migración
npx prisma studio        # GUI para inspeccionar DB (localhost:5555)

# PostgreSQL CLI
psql $DATABASE_URL
\dt                       # Listar tablas
SELECT * FROM users;      # Query ejemplo
```

### Git
```bash
git status               # Ver cambios
git log --oneline        # Ver commits
git add .
git commit -m "mensaje"
git push                 # Empujar a origin
```

### Elasticsearch
```bash
# Verificar cluster
curl http://localhost:9200/_cluster/health

# Ver índices
curl http://localhost:9200/_cat/indices

# Ver mapping del índice findings-v1
curl http://localhost:9200/findings-v1/_mapping

# Reindexar (si es necesario)
# Ver doc./guides/troubleshooting.md
```

---

## 📋 Checklist de Nueva Sesión

- [ ] PostgreSQL corriendo (`psql ...`)
- [ ] Elasticsearch corriendo (`curl localhost:9200`)
- [ ] `npm install` completado
- [ ] `npm run build` exitoso
- [ ] `npm run dev` ejecutándose
- [ ] Navegador: http://localhost:3001 carga ✅
- [ ] Lee doc./readme.md
- [ ] Lee doc./phases/fase_14.md (si es FASE 14)

---

## 🔍 Troubleshooting Rápido

### npm install falla
```bash
# Solución: usar --no-dedupe
npm install --no-dedupe

# Si sigue fallando
rm -rf node_modules package-lock.json
npm install --no-dedupe
```

### Build falla con error de TypeScript
```bash
# Limpiar cache Next.js
rm -rf .next
npm run build
```

### Database connection error
```bash
# Verificar variables de entorno
echo $DATABASE_URL

# Verificar PostgreSQL corriendo
psql $DATABASE_URL -c "\dt"
```

### Elasticsearch no responde
```bash
# Verificar contenedor Docker
docker-compose ps

# Reiniciar si es necesario
docker-compose down
docker-compose up -d
```

**Más**: Ver [doc./guides/troubleshooting.md](./guides/troubleshooting.md)

---

## 🚀 Próximos Pasos (después de setup)

### Si es tu primera vez
1. Lee [doc./readme.md](./readme.md) (índice maestro)
2. Revisa [doc./phases/](./phases/) para tu FASE actual
3. Consulta [doc./guides/development_setup.md](./guides/development_setup.md)

### Si vas a hacer feature
1. Lee la especificación de tu FASE
2. Activa skill recomendada (`/frontend-developer`, `/senior-fullstack`, etc)
3. Sigue el master prompt de tu FASE
4. Test + commit + push

### Si hay bug
1. Reproduce en dev server
2. Busca en [doc./guides/troubleshooting.md](./guides/troubleshooting.md)
3. Si no encuentras, crea issue en GitHub

---

## 📊 Stack Actual

```
Next.js 16.3
React 19
Prisma 7.9.1
PostgreSQL
Elasticsearch 8.11.0
Lucia 3.2.2
Tailwind CSS v4
TypeScript
```

Detalles: Ver [doc./readme.md#-tech-stack-actual-fase-14](./readme.md#-tech-stack-actual-fase-14)

---

## 🔗 Links Importantes

| Link | Descripción |
|------|-------------|
| [doc./readme.md](./readme.md) | Índice maestro + estado proyecto |
| [doc./phases/](./phases/) | Documentación de cada FASE |
| [doc./guides/](./guides/) | Guías prácticas (RBAC, setup, troubleshooting) |
| [doc./archive/](./archive/) | Archivos FASE 1-8 (referencia histórica) |
| [../FASE14_FRONTEND_SPEC.md](../FASE14_FRONTEND_SPEc.md) | spec frontend fase 14 (si aplica) |

---

## 💡 Tips

- **Mantén dev server corriendo**: Turbopack hace hot reload más rápido
- **Usa `npm run build` regularmente**: Detecta errores de TypeScript temprano
- **Guarda cambios regularmente**: Git es tu amigo
- **Documenta mientras codificas**: Actualiza docs al mismo tiempo que código

---

**¿Listo?** → Abre http://localhost:3001 en tu navegador 🎉

Próximo: Lee [doc./readme.md](./readme.md) para entender la estructura completa.
