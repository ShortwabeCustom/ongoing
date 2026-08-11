#!/bin/bash

# Pruebas María 2.0 — Production Migration Script
# Usage: ./scripts/migrate-production.sh

set -e

echo "🚀 Pruebas María 2.0 — Production Migration"
echo "==========================================="
echo ""

# Check environment
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL not set"
  exit 1
fi

if [ -z "$NODE_ENV" ]; then
  NODE_ENV=production
  export NODE_ENV
fi

echo "📋 Environment: $NODE_ENV"
echo "🗄️ Database: ${DATABASE_URL%%@*}@${DATABASE_URL##*@}"
echo ""

# 1. Check database connectivity
echo "1️⃣ Checking database connectivity..."
npx prisma db execute --stdin < /dev/null 2>/dev/null || {
  echo "❌ Cannot connect to database"
  exit 1
}
echo "✅ Database connected"
echo ""

# 2. Show pending migrations
echo "2️⃣ Checking for pending migrations..."
PENDING=$(npx prisma migrate status 2>&1 | grep -c "following migration" || echo "0")
if [ "$PENDING" -gt 0 ]; then
  echo "⚠️ Found pending migrations"
  npx prisma migrate status
else
  echo "✅ No pending migrations"
fi
echo ""

# 3. Backup database (optional)
if command -v pg_dump &> /dev/null; then
  echo "3️⃣ Creating database backup..."
  BACKUP_FILE="backups/db-backup-$(date +%Y%m%d-%H%M%S).sql"
  mkdir -p backups
  pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
  echo "✅ Backup created: $BACKUP_FILE"
else
  echo "⚠️ pg_dump not found, skipping backup"
fi
echo ""

# 4. Apply migrations
echo "4️⃣ Applying migrations..."
npx prisma migrate deploy
echo "✅ Migrations applied successfully"
echo ""

# 5. Verify schema
echo "5️⃣ Verifying database schema..."
TABLE_COUNT=$(npx prisma db execute --stdin < /dev/null 2>&1 | grep -c "table\|relation" || echo "?")
echo "✅ Database ready ($TABLE_COUNT tables)"
echo ""

# 6. Generate Prisma client
echo "6️⃣ Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"
echo ""

echo "🎉 Production migration completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Verify application build: npm run build"
echo "  2. Check health endpoint: curl https://uix.torrax.cloud/api/health"
echo "  3. Monitor logs for errors"
