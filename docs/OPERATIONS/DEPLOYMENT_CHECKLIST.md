# Deployment Checklist — Before Every Production Restart

**Quick reference for safe deployments**

---

## ⚠️ SUPERSEDED (2026-08-26) — read this before anything below

**`https://uix.productdesign.mx` is currently NOT served by `pm2 start
ecosystem.config.js` / the `uix` process on port 3000.** nginx's
`proxy_pass` points at a specific `uix-release-<sha>` process on its own
localhost port (see `docs/ADR/ADR_BLUE_GREEN_UIX_DEPLOYMENT.md` for the
full topology and why).

Running Steps 5-9 below (`pm2 delete uix` / `pm2 start
ecosystem.config.js` on port 3000) **does not affect public traffic at
all** — it restarts an orphaned process nobody visits. It will *look*
successful (`pm2 list` shows `online`) while production keeps serving
whatever `uix-release-<sha>` process nginx currently points to. This is
a **ghost deployment**: every check in this file will pass and nothing
in production will have changed.

**Use the canonical blue/green procedure instead**, summarized here and
detailed in the ADR:

```text
1. git worktree add --detach /var/www/apps/uix-release-<sha> <sha>
2. ln -s /var/www/apps/uix/.env /var/www/apps/uix-release-<sha>/.env
   (never copy the .env — symlink to the single source of truth)
3. cd /var/www/apps/uix-release-<sha>
   npm ci                     # reproducible install, no updates
   npm exec -- prisma generate  # codegen only, never migrate/db push here
   npm run build
4. Write ecosystem.deploy.config.js in that directory (not committed):
   name = uix-release-<sha>, cwd = that directory, its own free port
   (check: `ss -lntp | grep ':<port>'` and `pm2 describe uix-release-<sha>`
   must both come back empty before you claim the port)
5. pm2 start ecosystem.deploy.config.js
6. Smoke DIRECTLY against 127.0.0.1:<port> — do not touch nginx yet
7. Confirm current nginx upstream first: `cat /etc/nginx/sites-enabled/uix.productdesign.mx`
   Back up to /var/backups/nginx/ — NEVER inside sites-enabled/ (a file
   left in sites-enabled is parsed as an active server block and will
   break `nginx -t` with a duplicate server_name/listen error before
   you ever reload)
8. Edit ONLY the proxy_pass port, then: sudo nginx -t && sudo systemctl reload nginx
9. Verify chunk consistency against the PUBLIC domain (see Step 11
   below, same technique — just compare against the new release
   directory's .next, not against ecosystem.config.js's uix)
10. pm2 save only after the public check passes
11. Keep the previous uix-release-<sha> process running — it is the
    one-line rollback (revert proxy_pass, nginx -t, reload)
```

Do not delete/stop the old `uix-release-<sha>` slot, `uix-canary`, or
the orphaned `uix`/3000 process as part of a routine deploy — that is a
separate, explicit PM2 inventory audit (see the ADR's "Known
operational debt" section).

The steps below (original checklist) are kept as historical reference
for the `ecosystem.config.js`/`uix`/3000 path itself, in case that slot
is ever deliberately made the live path again — but as of 2026-08-26
they are **not** what drives `uix.productdesign.mx`.

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
