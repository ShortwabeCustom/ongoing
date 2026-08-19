# Deployment Checklist — Before Every Production Restart

**Quick reference for safe deployments**

---

## Pre-Deployment (5 minutes)

```bash
# 1. Verify build succeeds
npm run build
# Expected: Exit code 0, "Ready in Xs"

# 2. Verify .next chunks exist
ls -la .next/static/chunks/app/findings/ | head -5
# Expected: page-[HASH].js files exist

# 3. Check no syntax errors
npm run lint
# Expected: Exit code 0 or warnings only

# 4. Verify ecosystem config file exists
cat ecosystem.config.js | grep "args: 'start'"
# Expected: See args: 'start' (NOT args: 'dev')
```

---

## Deployment (3 minutes)

```bash
# 5. Stop old process
pm2 delete uix || true

# 6. Kill zombie processes
pkill -9 node || true
sleep 2

# 7. Verify port is free
lsof -i :3000 || echo "✅ Port free"

# 8. Start with ecosystem config
pm2 start ecosystem.config.js
pm2 save

# 9. Wait for startup
sleep 5
pm2 list
```

---

## Post-Deployment Verification (2 minutes)

```bash
# 10. Check app is in PRODUCTION mode (not dev)
pm2 logs uix --lines 3 --nostream | grep -E "next start|Ready"
# Expected: See "next start" and "Ready"
# NOT: "Turbopack" or "next dev"

# 11. Verify chunks hash match (CRITICAL)
ACTUAL=$(ls .next/static/chunks/app/findings/page-*.js | sed 's/.*page-//' | sed 's/.js//')
SERVED=$(curl -s https://uix.productdesign.mx/findings 2>/dev/null | grep -o 'page-[a-f0-9]*\.js' | sed 's/.js//' | head -1)

if [ "$ACTUAL" = "$SERVED" ]; then
  echo "✅ PASS: Chunks match - deployment successful"
else
  echo "❌ FAIL: Chunks mismatch!"
  echo "   Expected: $ACTUAL"
  echo "   Served:   $SERVED"
  echo "   → App may still be running old build"
  exit 1
fi

# 12. Verify app loads without errors
curl -s https://uix.productdesign.mx/findings | head -100
# Expected: See HTML with correct chunk hashes
# NOT: "page couldn't load" error or 404s
```

---

## If Deployment Fails

### Symptom: "This page couldn't load"

```bash
# 1. Check chunks hash mismatch
echo "Actual chunks:"
ls .next/static/chunks/app/findings/page-*.js

echo "Served chunks:"
curl -s https://uix.productdesign.mx/findings 2>/dev/null | grep -o 'page-[a-f0-9]*\.js'

# 2. If they don't match:
# → App is still running old build
# → Kill and restart with ecosystem.config.js

pm2 delete uix
pkill -9 node
sleep 3
pm2 start ecosystem.config.js
```

### Symptom: "Port 3000 already in use"

```bash
lsof -i :3000
# Kill the process
kill -9 [PID]
# or
pkill -9 node
# Restart
pm2 start ecosystem.config.js
```

### Symptom: "MIME type is 'text/plain'"

```bash
# This means app is in DEV mode
# Check logs:
pm2 logs uix --lines 10 --nostream

# If you see "Turbopack" or "next dev":
# → App started with wrong command
# → Fix: Use ecosystem.config.js only
pm2 delete uix
pm2 start ecosystem.config.js
```

---

## Golden Rules 🔒

1. ✅ **ALWAYS** use `ecosystem.config.js` to start
2. ✅ **NEVER** use `npm run dev` in production
3. ✅ **ALWAYS** verify chunks match after restart
4. ✅ **ALWAYS** save PM2 state: `pm2 save`
5. ✅ **NEVER** skip the verification step

---

## Incident Reference

If you're confused about dev vs prod mode, see:
- `docs/OPERATIONS/PRODUCTION_MODE_DEPLOYMENT.md` (full explanation)
- This file (quick checklist)

**Last incident**: 2026-08-13 (app deployed in dev mode, broke chunks)  
**Fix**: Switched to `ecosystem.config.js` with `npm start`
