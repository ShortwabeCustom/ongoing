# 🚀 Master Prompt — Session 2: Production Deployment

**Status**: Ready to Execute  
**Estimated Time**: 90 minutes  
**Skill to Use**: `/senior-backend`  
**Phase**: Deployment (Post FASE 14)

---

## 📖 Pre-Read (5 min)

Before starting, review:
1. `docs/FINAL_DEPLOYMENT_GUIDE.md` (5-step process)
2. `NEXT_SESSION_CHECKLIST.md` (detailed checklist)
3. Memory: `session_2_deployment_prep.md`

---

## 🎯 Mission

**Deploy Pruebas María 2.0 to production and verify it's working.**

Current state:
- ✅ All code in GitHub: https://github.com/ShortwabeCustom/ongoing
- ✅ GitHub Actions ready (CI/CD pipeline)
- ✅ Docker setup ready
- ✅ 11 GitHub Secrets added (values are examples)
- ✅ Documentation complete

What's needed:
- Real Cloudflare R2 credentials
- Real production database (or same dev one)
- Real Elasticsearch (or same dev one)

---

## 📋 Task Breakdown

### Phase 1: Prepare Credentials (15 min)

**Goal**: Update GitHub Secrets with production values

**Steps**:
1. Obtain from Cloudflare R2:
   - [ ] S3_ENDPOINT (https://xxx.r2.cloudflarestorage.com)
   - [ ] S3_ACCESS_KEY_ID
   - [ ] S3_SECRET_ACCESS_KEY

2. Update GitHub Secrets:
   - URL: https://github.com/ShortwabeCustom/ongoing/settings/secrets/actions
   - Update these 3 secrets with real values
   - Keep others as-is (DB_USER, DB_PASSWORD, etc. already correct)

3. Verify:
   - [ ] All 11 secrets show in GitHub UI
   - [ ] No secrets are empty

**Files to Reference**:
- `docs/GITHUB_SECRETS_SETUP.md` (detailed guide)
- Current secrets stored in `.env.local` (reference)

---

### Phase 2: Deploy (30 min)

**Goal**: Run application in production mode

**Choose ONE option:**

#### Option A: Docker (RECOMMENDED)
```bash
cd /var/www/uix.torrax.cloud
docker compose -f docker-compose.prod.yml up -d

# Verify it's running
docker ps | grep pruebas-maria
docker logs pruebas-maria -f
```

**What it does**:
- Builds Docker image
- Starts app + PostgreSQL + Elasticsearch
- Sets up networking
- Runs migrations automatically

#### Option B: PM2 (If already on uix.torrax.cloud)
```bash
cd /var/www/uix.torrax.cloud
git pull origin main
npm ci --omit=dev
npm run build
npx prisma migrate deploy
pm2 restart pruebas-maria
```

#### Option C: Vercel (If using Vercel)
```bash
vercel link
vercel env pull
vercel deploy --prod
```

**After Deploy**:
- [ ] Wait 30 seconds for services to start
- [ ] Check logs for errors
- [ ] Proceed to verification

---

### Phase 3: Verify Deployment (20 min)

**Goal**: Confirm production is working

**API Checks**:
```bash
# 1. Health endpoint
curl https://uix.torrax.cloud/api/health
# Expected: { "status": "healthy", ... }

# 2. Search endpoint
curl -X POST https://uix.torrax.cloud/api/search/findings \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}'
# Expected: array of findings

# 3. Findings list
curl https://uix.torrax.cloud/api/findings?page=1&limit=10
# Expected: paginated findings list
```

**Browser Checks**:
1. Open https://uix.torrax.cloud/findings
2. [ ] Page loads (no 404, no errors)
3. [ ] Search works (type in search box)
4. [ ] Advanced filters work (click filter button)
5. [ ] Create new finding (test form)
6. [ ] Real-time sync (open 2 tabs, create in one, check other)
7. [ ] Batch actions (select multiple, bulk update)

**Database Checks**:
```bash
# Check if data is there
psql $DATABASE_URL -c "SELECT COUNT(*) FROM findings;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM evidence;"

# Check Elasticsearch
curl -s $ELASTICSEARCH_URL/_cat/indices | grep findings
curl -s $ELASTICSEARCH_URL/findings-v1/_count
```

**Verification Checklist**:
- [ ] Health endpoint returns "healthy"
- [ ] Frontend loads without errors
- [ ] Search returns results
- [ ] Can create/update findings
- [ ] Real-time sync works (Socket.io)
- [ ] Database has data
- [ ] Elasticsearch index exists
- [ ] No 5xx errors in logs

---

### Phase 4: Configure Monitoring (25 min)

**Goal**: Set up alerts and error tracking

#### Option 1: Sentry (Error Tracking)
```bash
# 1. Sign up at https://sentry.io
# 2. Create new project (Node.js + Next.js)
# 3. Get SENTRY_DSN
# 4. Add to GitHub Secret: SENTRY_DSN=https://...
# 5. Deploy again
# 6. Trigger error to test
```

#### Option 2: Datadog (Metrics + Errors)
```bash
# 1. Sign up at https://www.datadoghq.com
# 2. Install agent
# 3. Monitor database, app, Elasticsearch
```

#### Option 3: CloudWatch (AWS)
```bash
# 1. Enable CloudWatch logs
# 2. Set up alarms for CPU, memory, errors
# 3. Create dashboard
```

**Minimum Monitoring**:
- [ ] Uptime monitoring (pingdom, uptime robot)
- [ ] Error tracking (Sentry recommended)
- [ ] Database backups automated
- [ ] Logs centralized (CloudWatch or ELK)

---

## ✅ Success Criteria

After deployment, verify ALL of these:

1. **Infrastructure**
   - [ ] All services running (app, DB, ES)
   - [ ] Health endpoint returns 200
   - [ ] No 5xx errors in logs

2. **Features**
   - [ ] Frontend loads
   - [ ] Search works
   - [ ] Filters work
   - [ ] Batch actions work
   - [ ] Real-time sync works

3. **Data**
   - [ ] Database has data
   - [ ] Elasticsearch indexed
   - [ ] Evidence uploads work
   - [ ] Queries are fast (< 500ms)

4. **Monitoring**
   - [ ] Error tracking enabled
   - [ ] Uptime monitoring active
   - [ ] Backups configured
   - [ ] Logs centralized

---

## 🔧 Troubleshooting

### Problem: "Connection refused" to database
**Solution**: 
```bash
# Verify DATABASE_URL is correct
echo $DATABASE_URL

# Check if PostgreSQL is running
psql $DATABASE_URL -c "SELECT 1"

# If not running, start it
docker compose -f docker-compose.prod.yml up -d postgres
```

### Problem: "Health endpoint returns 503"
**Solution**:
```bash
# Check app logs
docker logs pruebas-maria --tail 50

# Check which component is unhealthy
curl -s $ELASTICSEARCH_URL/_cluster/health
psql $DATABASE_URL -c "SELECT 1"

# Restart failing service
docker restart pruebas-maria  # or elasticsearch, postgres
```

### Problem: "Elasticsearch health is red/yellow"
**Solution**:
```bash
# Check ES status
curl -s $ELASTICSEARCH_URL/_cluster/health | jq .

# Check disk space
curl -s $ELASTICSEARCH_URL/_cat/allocation?v

# If disk full, clean up old indices
curl -X DELETE $ELASTICSEARCH_URL/findings-v1-old
```

### Problem: "GitHub Actions failing"
**Solution**:
- [ ] Check secrets are all configured: https://github.com/ShortwabeCustom/ongoing/settings/secrets/actions
- [ ] Check logs: https://github.com/ShortwabeCustom/ongoing/actions
- [ ] Make sure all 11 secrets have values (not empty)
- [ ] Run pre-flight check: `./scripts/production-checklist.sh`

---

## 📊 Performance Baselines

After deployment, check these metrics:

| Metric | Target | Command |
|--------|--------|---------|
| Health endpoint latency | < 100ms | `curl -w "@curl-format.txt" /api/health` |
| Search latency | < 500ms | Time a search query |
| API response | < 200ms | Check Network tab in DevTools |
| Build time | < 15s | `npm run build` |
| Database query | < 100ms | Check Prisma logs |

---

## 📞 Reference Links

- **Deployment Guide**: `docs/FINAL_DEPLOYMENT_GUIDE.md`
- **Security**: `docs/SECURITY_CHECKLIST.md`
- **Runbook**: `docs/PRODUCTION_RUNBOOK.md`
- **GitHub Secrets**: `docs/GITHUB_SECRETS_SETUP.md`
- **Repository**: https://github.com/ShortwabeCustom/ongoing
- **GitHub Actions**: https://github.com/ShortwabeCustom/ongoing/actions
- **Secrets Config**: https://github.com/ShortwabeCustom/ongoing/settings/secrets/actions

---

## 🎯 Timeline

```
00:00-00:15  Prepare credentials (R2, DB, ES)
00:15-00:45  Deploy (Docker/PM2/Vercel)
00:45-01:05  Verify (API + browser + database)
01:05-01:30  Configure monitoring
01:30        ✅ PRODUCTION READY
```

---

## 🚨 Critical Reminders

1. **Never commit secrets** — Use GitHub Secrets only
2. **Verify DATABASE_URL** before deploy — Wrong URL = data loss risk
3. **Test health endpoint** immediately after deploy — Not optional
4. **Monitor logs** during deploy — Catch issues early
5. **Back up database** before deploy — Just in case

---

## 📝 Deliverables (After This Session)

You should have:
- [ ] Production app running at https://uix.torrax.cloud/findings
- [ ] All features working (search, filters, batch actions, real-time)
- [ ] Monitoring configured (Sentry/Datadog/CloudWatch)
- [ ] Backups automated
- [ ] Documentation updated
- [ ] Incident response plan ready (`docs/PRODUCTION_RUNBOOK.md`)

---

## 🎊 Success

Once deployment is complete and verified, Pruebas María 2.0 is **LIVE** in production.

Next phase: Maintenance, monitoring, and feature improvements based on real usage data.

---

**Start Session 2 with**: Read `docs/FINAL_DEPLOYMENT_GUIDE.md` (5 min), then execute Phase 1-4 above.
