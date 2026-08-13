---
title: Troubleshooting
purpose: Common issues and solutions
audience: All developers
time: ⏱️ varies
---

# 🐛 Troubleshooting Guide

**Objetivo**: Resolver problemas comunes de setup y desarrollo

---

## 📦 npm install Falla

### Error: "conflicting peer dependencies"
```bash
error: npm ERR! Could not resolve dependency: peer
npm ERR! peer lucia@"^3.x" from @lucia-auth/adapter-prisma@4.0.1
```

**Solución**:
```bash
# Usar --no-dedupe (NO --legacy-peer-deps)
npm install --no-dedupe

# Si sigue fallando:
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --no-dedupe
```

### Error: "Timeout waiting for package"
```bash
npm ERR! fetch failed: https://registry.npmjs.org/...
```

**Soluciones**:
```bash
# Opción 1: Aumentar timeout
npm install --timeout=120000

# Opción 2: Cambiar registry
npm config set registry https://registry.npmjs.org/
npm install

# Opción 3: Limpiar cache
npm cache clean --force
npm install
```

---

## 🗄️ Database Connection Fails

### Error: "connect ECONNREFUSED 127.0.0.1:5432"
```bash
error: connect ECONNREFUSED 127.0.0.1:5432
at TCPConnectWrap.afterConnect [as oncomplete] (net.js:...)
```

**Checklist**:
1. ¿PostgreSQL corriendo?
```bash
# macOS
brew services list | grep postgres

# Linux
sudo systemctl status postgresql

# Docker
docker-compose ps | grep postgres
```

2. ¿DATABASE_URL correcto?
```bash
echo $DATABASE_URL
# Debe ser: postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev?schema=public
```

3. ¿Base de datos existe?
```bash
psql -U torrax_user -d pruebas_maria_dev -c "SELECT 1;"
```

**Soluciones**:
```bash
# Iniciar PostgreSQL (macOS)
brew services start postgresql

# Iniciar PostgreSQL (Docker)
docker-compose up -d

# Recrear DB si está corrupta
psql -U postgres -c "DROP DATABASE pruebas_maria_dev;"
psql -U postgres -c "CREATE DATABASE pruebas_maria_dev OWNER torrax_user;"
npx prisma migrate dev
```

---

## 🔨 Build Falla con TypeScript Errors

### Error: "Property 'X' does not exist on type 'Y'"
```bash
$ npm run build
✖ Type checking failed...
lib/services/search-service.ts:42:10
Type 'undefined' is not assignable to type 'FacetResponse'
```

**Soluciones**:
```bash
# 1. Limpiar cache Next.js
rm -rf .next
npm run build

# 2. Regenerar Prisma Client
npx prisma generate
npm run build

# 3. Verificar imports están correctos
# Archivo debe importar tipo/interfaz que usa

# 4. Si persiste, limpiar todo
rm -rf node_modules .next
npm install --no-dedupe
npx prisma generate
npm run build
```

---

## 🔍 Dev Server No Inicia

### Error: "Port 3001 already in use"
```bash
error: listen EADDRINUSE: address already in use :::3001
```

**Soluciones**:
```bash
# Opción 1: Matar proceso en puerto 3001
lsof -i :3001      # listar proceso
kill -9 <PID>      # matar

# Opción 2: Cambiar puerto
PORT=3002 npm run dev

# Opción 3: Docker cleanup
docker-compose down
docker system prune -a
```

### Error: "Cannot find module 'next'"
```bash
Error: Cannot find module 'next'
```

**Solución**:
```bash
# Reinstalar dependencias
npm install
npm run dev
```

---

## 🔐 Elasticsearch No Responde

### Error: "connect ECONNREFUSED 127.0.0.1:9200"
```bash
Error: connect ECONNREFUSED 127.0.0.1:9200
```

**Checklist**:
1. ¿Elasticsearch corriendo?
```bash
curl http://localhost:9200/_cluster/health
# Debe retornar JSON con status

# Si no:
docker-compose up -d elasticsearch
sleep 30  # Esperar a que inicie
curl http://localhost:9200/_cluster/health
```

2. ¿Imagen correcta?
```bash
docker-compose ps
# Debe mostrar imagen elasticsearch:8.11.0
```

### Error: "index_not_found_exception"
```bash
IndexNotFoundException: [findings-v1]
```

**Solución**:
```bash
# Crear índice automáticamente
# En código: `await searchService.ensureIndexExists()`

# O en DB console:
npx prisma studio
# Ejecutar: await prisma.finding.findMany()
# (trigger ensureIndexExists via API call)
```

---

## 🔑 Auth/RBAC Issues

### Error: "Invalid session"
```bash
Error: Invalid session cookie
```

**Soluciones**:
```bash
# 1. Limpiar cookies del navegador
# DevTools → Application → Cookies → Delete all

# 2. Hacer login nuevamente
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@test.local","password":"TestPassword123"}' \
  -c cookies.txt

# 3. Verificar DB tiene sessions table
npx prisma studio
# → Ver "Session" table
```

### Error: "User not found after login"
```bash
Error: User not found
```

**Soluciones**:
```bash
# 1. Recrear test users
npx ts-node scripts/seed-users.ts

# 2. Verificar en DB
npx prisma studio
# → Ver "User" table, debe haber 6 usuarios

# 3. Verificar credenciales exactas
# Email: owner@test.local (sin mayúsculas)
# Password: TestPassword123 (exactamente)
```

---

## 🎨 Frontend Issues

### Styles no se aplican (Tailwind)
```
Página se carga pero estilos faltan (clase Tailwind no funciona)
```

**Soluciones**:
```bash
# 1. Limpiar cache Tailwind
rm -rf .next
npm run dev

# 2. Verificar tailwind.config.ts contiene content paths
# Debe incluir: './app/**/*.tsx', './components/**/*.tsx'

# 3. Rebuild
npm run build
```

### Mobile emulation en Chrome DevTools
```
viewport mobile pero componentes no responden
```

**Checklist**:
1. F12 → Ctrl+Shift+M (toggle device toolbar)
2. Seleccionar device: iPhone 12, Pixel 7, etc
3. Recargar página (F5)
4. Verificar media queries en DevTools:
   ```bash
   console: window.matchMedia('(min-width: 768px)').matches
   # mobile viewport: debe retornar false
   # desktop viewport: debe retornar true
   ```

---

## 🔄 Git Issues

### Error: "EACCES: permission denied"
```bash
error: Permission denied (publickey)
```

**Soluciones**:
```bash
# 1. Configurar SSH keys
ssh-keygen -t ed25519 -C "email@example.com"
ssh-add ~/.ssh/id_ed25519

# 2. O usar HTTPS en lugar de SSH
git remote set-url origin https://github.com/user/repo.git
```

### Merge conflicts
```bash
error: Your local changes to 'file.ts' would be overwritten by merge
```

**Solución**:
```bash
# Stash cambios locales
git stash

# Luego pull/merge
git pull origin main

# Aplicar cambios de vuelta
git stash pop

# Resolver conflictos manualmente si hay
```

---

## 🧪 Testing Issues

### Tests fallan con "Cannot find module"
```bash
Error: Cannot find module 'lib/services/search-service'
```

**Soluciones**:
```bash
# 1. Actualizar tsconfig.json paths
# Verificar que "lib/*" mapea a "./lib/*"

# 2. Limpiar cache Jest
npm test -- --clearCache
npm test
```

---

## 📊 Performance Issues

### Build toma >60 segundos
```bash
$ npm run build
⠼ Compiling client... (2m 34s)
```

**Soluciones**:
```bash
# 1. Verificar que SWC está habilitado
# next.config.mjs debe tener: swcMinify: true

# 2. Verificar Turbopack está habilitado en dev
# npm run dev debe mostrar: "Turbopack enabled"

# 3. Limpiar y reconstruir
rm -rf .next
npm run build --verbose
```

---

## 🆘 Aún No Funciona?

### Debug Mode
```bash
# Ejecutar con logs detallados
DEBUG=* npm run dev

# O específico para servicio
DEBUG=lib:* npm run dev
```

### Nuclear Option (Último Recurso)
```bash
# Limpiar completamente y reiniciar
rm -rf node_modules .next
npm cache clean --force
npm install --no-dedupe
npx prisma generate
npx prisma migrate dev
npm run dev
```

---

## 📞 Si Aún No Funciona

1. **Revisar logs**: `npm run dev` muestra errores detallados
2. **Consultar docs**: [doc./readme.md](../readme.md)
3. **Verificar prerequisites**: [DEVELOPMENT_SETUP.md](./development_setup.md)
4. **Abrir issue**: Con logs + versiones

---

**Última actualización**: 2026-08-10  
**Próximo**: Ejecutar `npm run dev` y verificar http://localhost:3001
