# Production Mode Deployment — Critical Guide

**Última actualización**: 2026-08-13  
**Status**: ✅ CRITICAL DOCUMENTATION  
**Audience**: DevOps, SRE, Production Maintainers

---

## 🚨 The Critical Mistake We Made

On 2026-08-13, the production application was accidentally deployed in **DEV mode** (`next dev`) instead of **PRODUCTION mode** (`next start`).

**Impact**:
- ❌ Chunks returned with stale hashes
- ❌ Browser requests old chunks that don't exist
- ❌ 404 errors on chunk loading
- ❌ Application completely broken
- ❌ Misleading "WebSocket errors" in console (actually chunk loading failures)
- ❌ Users see "This page couldn't load" error

**Root Cause**: PM2 process configuration was incorrect, running `next dev` instead of `npm start` (which runs `next start`).

---

## ✅ How to Prevent This

### Rule 1: Always Use Production Build

**CORRECT** ✅
```bash
# Production deployment
npm start                 # Runs: next start
pm2 start "npm start" --name uix
```

**WRONG** ❌
```bash
# Development mode (rebuilds on every request)
npm run dev              # Runs: next dev
pm2 start "npm run dev" --name uix
```

### Rule 2: Verify the Mode Before Restart

```bash
# Check what command PM2 is running
pm2 describe uix | grep -A 2 "command"

# Check logs for dev/prod mode indicators
pm2 logs uix --lines 20 --nostream

# LOOK FOR:
# ✅ Production:  "▲ Next.js X.X.X" (no "Turbopack" in startup)
# ❌ Dev mode:    "▲ Next.js X.X.X (Turbopack)" or "next dev" in logs
```

### Rule 3: Verify Chunk Hashes Match

After deployment, verify the built chunks exist and are served:

```bash
# List actual chunks in .next build directory
ls .next/static/chunks/app/findings/page-*.js

# Check what chunks the server is serving
curl -s https://uix.productdesign.mx/findings | grep -o 'page-[a-f0-9]*\.js' | sort -u

# These should MATCH. If they don't, the app is not running the production build.
```

### Rule 4: PM2 Configuration Best Practice

Create an `ecosystem.config.js` file to lock the configuration:

```javascript
module.exports = {
  apps: [
    {
      name: 'uix',
      script: 'npm',
      args: 'start',  // ← PRODUCTION ONLY
      instances: 1,
      exec_mode: 'fork',
      port: 3000,
      node_args: '--max-old-space-size=2048',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      max_memory_restart: '500M',
      autorestart: false,  // ← Explicit: don't auto-restart on crash
      watch: false,        // ← Explicit: don't watch for changes
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
```

Then start with:
```bash
pm2 start ecosystem.config.js
pm2 save
```

---

## 🔍 How to Detect This Problem

### Symptom 1: "This page couldn't load" Error

```
⚠️ User sees blank page with error
⚠️ Console shows: ERR_ABORTED 404 (Not Found)
⚠️ Chunk files return 404
```

### Symptom 2: MIME Type Mismatch

```
⚠️ Console error: "Refused to execute script because MIME type is 'text/plain'"
⚠️ Chunks are downloaded as plain text instead of JavaScript
```

### Symptom 3: Hash Mismatch

```bash
# Run this check:
ACTUAL_CHUNKS=$(ls .next/static/chunks/app/findings/page-*.js | sed 's/.*page-/page-/' | sed 's/\.js$//')
SERVED_CHUNKS=$(curl -s https://uix.productdesign.mx/findings | grep -o 'page-[a-f0-9]*\.js' | sed 's/\.js$//' | sort -u)

if [ "$ACTUAL_CHUNKS" != "$SERVED_CHUNKS" ]; then
  echo "❌ CRITICAL: Hash mismatch - app not serving production build"
else
  echo "✅ Chunks match - app is correct"
fi
```

---

## 🔧 How to Fix If It Happens Again

### Step 1: Stop the Broken Process

```bash
pm2 stop uix
pm2 delete uix
```

### Step 2: Kill Any Leftover Node Processes

```bash
pkill -9 node || true
pkill -9 "next" || true
sleep 2
```

### Step 3: Verify Port is Free

```bash
lsof -i :3000 || echo "Port 3000 is free"
```

### Step 4: Start Production Mode

```bash
# Option A: Using ecosystem.config.js (RECOMMENDED)
pm2 start ecosystem.config.js
pm2 save

# Option B: Direct command
pm2 start "npm start" --name uix --no-autorestart
pm2 save
```

### Step 5: Verify Deployment

```bash
# Check PM2 status
pm2 list

# Check logs for production mode
pm2 logs uix --lines 10

# Verify chunks match
ACTUAL=$(ls .next/static/chunks/app/findings/page-*.js | grep -o 'page-[a-f0-9]*')
SERVED=$(curl -s https://uix.productdesign.mx/findings | grep -o 'page-[a-f0-9]*\.js' | sed 's/\.js//')
[ "$ACTUAL" = "$SERVED" ] && echo "✅ OK" || echo "❌ MISMATCH"
```

---

## 📋 Pre-Deployment Checklist

**Before restarting production, verify ALL of these:**

- [ ] Code is built: `npm run build` exits with code 0
- [ ] `.next` directory exists and has chunks: `ls .next/static/chunks/`
- [ ] No syntax errors in `next.config.mjs`
- [ ] PM2 will start with `npm start` (production, not `npm run dev`)
- [ ] Port 3000 is free: `lsof -i :3000`
- [ ] Environment variables are set: `echo $NODE_ENV`
- [ ] After restart, verify chunks: See "Step 5" above

---

## 🚨 How This Got Past Us

**Lessons Learned**:

1. **No ecosystem.config.js** → PM2 command was manually entered
2. **No pre-deployment verification** → Didn't check if app was in dev/prod mode
3. **No chunk hash validation** → Didn't verify chunks existed before serving
4. **Relied on error messages** → "WebSocket errors" distracted from root cause (chunks)

**Going Forward**:
- ✅ Use `ecosystem.config.js` to lock deployment config
- ✅ Add CI/CD step to verify `npm start` mode before deploy
- ✅ Add health check: compare actual chunks vs served chunks
- ✅ Document this incident

---

## 📞 Quick Reference

```bash
# Is app in dev or prod mode?
pm2 logs uix --lines 5 --nostream | grep -E "next dev|next start"

# What chunks should be served?
ls .next/static/chunks/app/findings/page-*.js | grep -o 'page-[a-f0-9]*'

# What chunks are being served?
curl -s https://uix.productdesign.mx/findings | grep -o 'page-[a-f0-9]*\.js'

# Is the app healthy?
curl -s https://uix.productdesign.mx/findings | grep -q "page-" && echo "✅ OK" || echo "❌ BROKEN"
```

---

## 📅 Incident Timeline

**2026-08-13 05:30** — Dev mode app deployed by accident  
**2026-08-13 06:45** — User reports "page couldn't load" error  
**2026-08-13 07:15** — Root cause identified: `next dev` instead of `next start`  
**2026-08-13 07:30** — Fixed: Production mode deployed  
**2026-08-13 08:00** — Documentation written  

---

**Status**: ✅ PRODUCTION RESTORED  
**Fix Verified**: Yes, chunks now load correctly  
**Prevention**: See "How to Prevent This" section above
