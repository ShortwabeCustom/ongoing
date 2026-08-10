# Troubleshooting de Instalación de Dependencias — FASE 7.5

**Problema**: npm falla al instalar lucia y dependencias de auth con error:
```
Cannot read properties of null (reading 'matches')
```

**Causa**: Bug conocido en npm v10.8.2 al deduplicar dependencias complejas

---

## Soluciones Intentadas y Resultados

### ❌ Intento 1: `npm install ... --legacy-peer-deps`
**Resultado**: Error de deduplicación en npm arborist  
**Acción**: Fallido

### ❌ Intento 2: `npm install ... --legacy-peer-deps --verbose`
**Resultado**: Mismo error, con más detalles  
**Acción**: Fallido

### 🔄 Intento 3: `npm install ... --legacy-peer-deps --no-dedupe`
**Resultado**: En progreso (~3-5 minutos)  
**Acción**: Esperando...

### Si Intento 3 falla:

#### Opción A: Limpiar y usar `npm ci`
```bash
rm -rf node_modules package-lock.json
npm ci --legacy-peer-deps
```

#### Opción B: Instalar una por una (es más lento)
```bash
npm install lucia --legacy-peer-deps
npm install @lucia-auth/adapter-prisma --legacy-peer-deps
npm install @node-rs/argon2 --legacy-peer-deps
npm install oslo --legacy-peer-deps
npm install cookie --legacy-peer-deps
```

#### Opción C: Usar pnpm (alternativa a npm)
```bash
pnpm install lucia @lucia-auth/adapter-prisma @node-rs/argon2 oslo cookie
```

#### Opción D: Usar yarn
```bash
yarn add lucia @lucia-auth/adapter-prisma @node-rs/argon2 oslo cookie
```

#### Opción E: Actualizar npm
```bash
npm install -g npm@latest
npm install lucia @lucia-auth/adapter-prisma @node-rs/argon2 oslo cookie --legacy-peer-deps
```

---

## Verificación de Instalación

Una vez que npm termine, verificar:

```bash
# 1. Verificar Lucia
test -f node_modules/lucia/package.json && echo "✅ Lucia" || echo "❌ Lucia"

# 2. Verificar adapter
test -f node_modules/@lucia-auth/adapter-prisma/package.json && echo "✅ Adapter" || echo "❌ Adapter"

# 3. Verificar argon2
test -f node_modules/@node-rs/argon2/package.json && echo "✅ Argon2" || echo "❌ Argon2"

# 4. Full list
npm list lucia @lucia-auth/adapter-prisma @node-rs/argon2 oslo cookie
```

---

## Próximos Pasos (Si npm Termina Exitosamente)

```bash
# 1. Build
npm run build

# 2. Migración (si BD disponible)
npx prisma migrate dev

# 3. Seed usuarios
npx ts-node scripts/seed-users.ts

# 4. Dev server
npm run dev

# 5. Test RBAC
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@test.local","password":"TestPassword123"}'
```

---

## Recursos

- npm Bug Report: https://github.com/npm/cli/issues
- Lucia Docs: https://lucia.dev
- Argon2: https://github.com/Yengas/node-argon2
