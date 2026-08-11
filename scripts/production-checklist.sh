#!/bin/bash

# Pruebas María 2.0 — Production Pre-Flight Checklist
# Usage: ./scripts/production-checklist.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

check() {
  local msg=$1
  local cmd=$2

  echo -n "$msg ... "
  if eval "$cmd" &>/dev/null; then
    echo -e "${GREEN}✅${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌${NC}"
    ((FAILED++))
  fi
}

echo "🚀 Pruebas María 2.0 — Production Pre-Flight Checklist"
echo "======================================================"
echo ""

echo "📋 Environment Checks"
check "Node.js installed" "command -v node"
check "npm installed" "command -v npm"
check "git installed" "command -v git"
check "Working directory clean" "git status --porcelain | wc -l | grep -q '^0$'"
echo ""

echo "📦 Dependency Checks"
check "node_modules exists" "[ -d node_modules ]"
check "package-lock.json exists" "[ -f package-lock.json ]"
check "No audit vulnerabilities" "npm audit 2>&1 | grep -q 'no vulnerabilities' || npm audit --audit-level=moderate 2>&1 | grep -q '0 vulnerabilities'"
echo ""

echo "🔧 Code Quality"
check "ESLint passes" "npm run lint 2>&1 | grep -q 'ESLint' || npm run lint"
check "TypeScript compiles" "npx tsc --noEmit"
check "No deprecated APIs" "grep -r 'UNSAFE_' app/ || true | wc -l | grep -q '^0$'"
echo ""

echo "🏗️ Build"
echo -n "Next.js builds ... "
if npm run build &>/dev/null; then
  if [ -d ".next" ]; then
    echo -e "${GREEN}✅${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌${NC} (.next directory missing)"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌${NC}"
  ((FAILED++))
fi
echo ""

echo "🗄️ Database"
check "DATABASE_URL set" "[ ! -z \"\$DATABASE_URL\" ]"
check "Prisma schema valid" "npx prisma validate"
check "No pending migrations" "npx prisma migrate status 2>&1 | grep -q 'No pending migrations' || npx prisma migrate status 2>&1 | grep -qv 'migrations'"
echo ""

echo "🔒 Security"
check "No hardcoded secrets" "grep -r 'password.*=' app/ lib/ 2>/dev/null | grep -qv 'PASSWORD' || true | wc -l | grep -q '^0$'"
check "No .env in repo" "! git ls-files --stage | grep -q '\\.env$'"
check "Git secrets hook" "command -v pre-commit || echo 'Consider installing pre-commit hooks'"
echo ""

echo "📁 Configuration"
check ".env.production exists" "[ -f .env.production ]"
check "GitHub Actions workflow exists" "[ -f .github/workflows/deploy.yml ]"
check "Documentation exists" "[ -f docs/DEPLOYMENT.md ]"
check "Security checklist exists" "[ -f docs/SECURITY_CHECKLIST.md ]"
echo ""

echo "🔗 API Health"
if [ ! -z "$NEXT_PUBLIC_API_URL" ]; then
  check "Health endpoint exists" "[ -f app/api/health/route.ts ]"
fi
echo ""

# Summary
TOTAL=$((PASSED + FAILED))
echo "======================================================"
echo "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC} (out of $TOTAL)"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! Ready for production.${NC}"
  exit 0
else
  echo -e "${RED}❌ Fix $FAILED issues before deploying to production.${NC}"
  exit 1
fi
