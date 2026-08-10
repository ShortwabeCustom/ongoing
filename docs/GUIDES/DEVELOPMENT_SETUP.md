# 🛠️ Development Setup Guide

**Duración**: 30 minutos | **Objetivo**: Setup local completo

---

## 📋 Prerequisites

### System Requirements
```
Node.js:       ≥20.0
npm:           ≥10.0
PostgreSQL:    ≥14
Elasticsearch: 8.11.0 (via docker-compose)
Git:           ≥2.30
```

### Verificar Versiones
```bash
node --version
npm --version
psql --version
git --version
```

---

## 1️⃣ Database Setup (PostgreSQL)

### Opción A: PostgreSQL Local (macOS)
```bash
# Instalar via Homebrew
brew install postgresql

# Iniciar servicio
brew services start postgresql

# Crear usuario + base de datos
psql postgres -c "CREATE USER torrax_user WITH PASSWORD 'TorraxDev123!';"
psql postgres -c "CREATE DATABASE pruebas_maria_dev OWNER torrax_user;"

# Verificar
psql -U torrax_user -d pruebas_maria_dev -c "SELECT 1;"
```

### Opción B: PostgreSQL Local (Linux)
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Crear usuario
sudo -u postgres psql -c "CREATE USER torrax_user WITH PASSWORD 'TorraxDev123!';"
sudo -u postgres psql -c "CREATE DATABASE pruebas_maria_dev OWNER torrax_user;"

# Verificar
psql -U torrax_user -h localhost -d pruebas_maria_dev -c "SELECT 1;"
```

### Opción C: Docker (Recomendado)
```bash
# Crear archivo .env.local
cat > .env.local << 'EOF'
DATABASE_URL=postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev?schema=public
POSTGRES_USER=torrax_user
POSTGRES_PASSWORD=TorraxDev123!
POSTGRES_DB=pruebas_maria_dev
EOF

# docker-compose.yml ya existe — ejecutar
docker-compose up -d

# Verificar
docker-compose ps
psql postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev -c "SELECT 1;"
```

---

## 2️⃣ Environment Variables

### Crear .env.local
```bash
# Database
DATABASE_URL=postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev?schema=public

# Auth (Lucia)
NEXTAUTH_SECRET=your-secret-key-here-min-32-chars

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Cloudflare R2 (evidencia storage)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=findings-evidence

# Redis (real-time, opcional por ahora)
REDIS_URL=redis://localhost:6379

# Development
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

---

## 3️⃣ Project Setup

### Clone Repository
```bash
cd /var/www/uix.torrax.cloud
# (o clone si no existe)
git clone <repo-url> /var/www/uix.torrax.cloud
```

### Install Dependencies
```bash
cd /var/www/uix.torrax.cloud

# ⚠️ IMPORTANTE: Usar --no-dedupe para evitar conflictos Prisma + Lucia
npm install --no-dedupe

# Si falla, limpiar e reintentar
rm -rf node_modules package-lock.json
npm install --no-dedupe
```

### Database Migrations
```bash
# Aplicar esquema Prisma
npx prisma migrate dev

# Generar Prisma Client
npx prisma generate

# Verificar tablas creadas
npx prisma studio
# → http://localhost:5555 (GUI)
```

### Seed Test Users (6 roles)
```bash
npx ts-node scripts/seed-users.ts

# Verificar
npx prisma studio
# → Click "User" table → deberían aparecer 6 usuarios
```

---

## 4️⃣ Elasticsearch Setup

### Opción A: Docker Compose
```bash
# Ejecutar en background
docker-compose up -d elasticsearch

# Esperar a que inicie (~30s)
sleep 30

# Verificar
curl http://localhost:9200/_cluster/health

# Esperado: { "cluster_name": "elasticsearch", "status": "green", ... }
```

### Opción B: Manual Local (macOS)
```bash
# Descargar Elasticsearch 8.11.0
curl -O https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.11.0-darwin-x86_64.tar.gz
tar -xzf elasticsearch-8.11.0-darwin-x86_64.tar.gz
cd elasticsearch-8.11.0

# Iniciar (sin seguridad para desarrollo)
./bin/elasticsearch \
  -E xpack.security.enabled=false \
  -E discovery.type=single-node

# En otra terminal
curl http://localhost:9200/_cluster/health
```

---

## 5️⃣ Development Server

### Start Dev Server
```bash
npm run dev

# Esperado:
# ▲ Next.js 16.3
# - Local:        http://localhost:3001
# - Turbopack enabled
# - Ready in 46s
```

### Verificar Setup
```bash
# En navegador
open http://localhost:3001

# En terminal (otro tab)
curl http://localhost:3001/api/findings

# Esperado: JSON response (posiblemente vacío [])
```

---

## 6️⃣ Optional: IDE Setup

### VS Code Extensions Recomendadas
```
- Prisma (Prisma labs)
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin
- ESLint
- Prettier
```

### VS Code Settings (.vscode/settings.json)
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## ✅ Checklist Final

- [ ] Node.js ≥20.0
- [ ] PostgreSQL corriendo (`psql ...` conecta)
- [ ] Elasticsearch corriendo (`curl localhost:9200`)
- [ ] `.env.local` con DATABASE_URL
- [ ] `npm install` exitoso
- [ ] `npx prisma migrate dev` exitoso
- [ ] `npx ts-node scripts/seed-users.ts` exitoso
- [ ] `npm run dev` ejecutándose
- [ ] http://localhost:3001 carga en navegador
- [ ] `curl http://localhost:3001/api/findings` retorna JSON

---

## 🚀 Próximo Paso

Ejecutar RBAC testing:
```bash
# Ver docs/GUIDES/RBAC_TESTING.md
```

---

**Duración estimada**: 30 minutos  
**Problemas**: Ver [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
